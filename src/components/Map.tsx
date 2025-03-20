'use client';

import { useEffect, useRef, useState } from 'react';
import { Group } from '../lib/interfaces';

interface MapProps {
  groups: Group[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
}

declare global {
  interface Window {
    google: any;
  }
}

const Map = ({ groups, centerLat = 39.8283, centerLng = -98.5795, zoom = 4 }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  // Initialize the map
  useEffect(() => {
    // Check if the Google Maps script is already loaded
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = initializeMap;
      
      return () => {
        document.head.removeChild(script);
      };
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      const mapOptions = {
        center: { lat: centerLat, lng: centerLng },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      setMap(newMap);
      setInfoWindow(new window.google.maps.InfoWindow());
    }
  };

  // Add markers when map is loaded and groups change
  useEffect(() => {
    if (!map || !infoWindow) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    // Add new markers
    const newMarkers = groups.map(group => {
      const marker = new window.google.maps.Marker({
        position: { 
          lat: group.coordinates.latitude, 
          lng: group.coordinates.longitude 
        },
        map: map,
        title: group.university,
      });

      // Create info window content
      const content = `
        <div>
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${group.university}</h3>
          <p>${group.city}</p>
          <p>${group.state}, ${group.country}</p>
        </div>
      `;

      // Add click listener to open info window
      marker.addListener('click', () => {
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
      });

      return marker;
    });

    setMarkers(newMarkers);

    // Auto-fit bounds if we have markers
    if (newMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      map.fitBounds(bounds);
      
      // Don't zoom in too far on single marker
      if (map.getZoom() > 15) {
        map.setZoom(15);
      }
    }
  }, [map, infoWindow, groups]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '500px', borderRadius: '8px' }} />
  );
};

export default Map; 