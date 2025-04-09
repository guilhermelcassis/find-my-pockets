'use client';

import { useEffect, useRef } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AdminMapComponentProps {
  initialCoordinates?: Coordinates;
  onMapReady?: (map: google.maps.Map, marker: google.maps.Marker) => void;
  onMarkerPositionChange?: (lat: number, lng: number) => void;
}

export default function AdminMapComponent({
  initialCoordinates = { latitude: -8.017558, longitude: -34.949283 }, // Default to Recife
  onMapReady,
  onMarkerPositionChange
}: AdminMapComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const listenerRefs = useRef<google.maps.MapsEventListener[]>([]);

  // Initialize the map
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google?.maps) {
      console.warn('Google Maps API not loaded');
      return;
    }

    if (!mapContainerRef.current) {
      console.warn('Map container not found');
      return;
    }

    // Initial coordinates
    const position = {
      lat: initialCoordinates.latitude,
      lng: initialCoordinates.longitude
    };

    // Create map
    const mapOptions: google.maps.MapOptions = {
      center: position,
      zoom: 16,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT
      },
      fullscreenControl: true,
      streetViewControl: true,
      zoomControl: true
    };

    const map = new google.maps.Map(mapContainerRef.current, mapOptions);
    mapRef.current = map;

    // Create marker
    const marker = new google.maps.Marker({
      position,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP
    });
    markerRef.current = marker;

    // Add event listeners
    const dragEndListener = marker.addListener('dragend', () => {
      const newPosition = marker.getPosition();
      if (newPosition && onMarkerPositionChange) {
        onMarkerPositionChange(newPosition.lat(), newPosition.lng());
      }
    });
    
    const clickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng && markerRef.current) {
        markerRef.current.setPosition(event.latLng);
        if (onMarkerPositionChange) {
          onMarkerPositionChange(event.latLng.lat(), event.latLng.lng());
        }
      }
    });

    // Add resize listener to fix map rendering issues
    const resizeListener = window.addEventListener('resize', () => {
      if (map) {
        google.maps.event.trigger(map, 'resize');
        if (marker && marker.getPosition()) {
          map.setCenter(marker.getPosition()!);
        }
      }
    });

    // Trigger resize after a short delay to ensure the map renders properly
    setTimeout(() => {
      google.maps.event.trigger(map, 'resize');
    }, 100);

    // Store listeners for cleanup
    listenerRefs.current = [dragEndListener, clickListener];

    // Notify parent component that map is ready
    if (onMapReady) {
      onMapReady(map, marker);
    }

    // Clean up
    return () => {
      listenerRefs.current.forEach(listener => {
        google.maps.event.removeListener(listener);
      });
      
      window.removeEventListener('resize', resizeListener as any);
      
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      
      mapRef.current = null;
    };
  }, [initialCoordinates, onMapReady, onMarkerPositionChange]);

  // Update marker position when coordinates change
  useEffect(() => {
    if (
      mapRef.current && 
      markerRef.current && 
      (
        markerRef.current.getPosition()?.lat() !== initialCoordinates.latitude || 
        markerRef.current.getPosition()?.lng() !== initialCoordinates.longitude
      )
    ) {
      const newPosition = {
        lat: initialCoordinates.latitude,
        lng: initialCoordinates.longitude
      };
      
      markerRef.current.setPosition(newPosition);
      mapRef.current.setCenter(newPosition);
    }
  }, [initialCoordinates]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
      className="google-map-container"
    ></div>
  );
} 