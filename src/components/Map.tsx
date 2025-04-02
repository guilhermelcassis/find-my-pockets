'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Group } from '../lib/interfaces';

interface MapProps {
  groups: Group[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  selectedGroupId?: string | null;
}

// Melhorando as definições do Google Maps para evitar recursão
declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: GoogleMapOptions) => google.maps.Map;
        Marker: new (options: google.maps.MarkerOptions) => google.maps.Marker;
        InfoWindow: new (options?: google.maps.InfoWindowOptions) => google.maps.InfoWindow;
        LatLngBounds: new () => google.maps.LatLngBounds;
        Animation: {
          DROP: number;
          BOUNCE: number;
        };
        LatLng: new (lat: number, lng: number) => google.maps.LatLng;
        Size: new (width: number, height: number) => google.maps.Size;
        Point: new (x: number, y: number) => google.maps.Point;
      };
    };
    googleMapsInitialized: boolean;
  }
}

// Tipo básico para as opções do mapa
interface GoogleMapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  zoomControl?: boolean;
  styles?: Array<{
    featureType?: string;
    elementType?: string;
    stylers: Array<{ [key: string]: string }>;
  }>;
}

const Map = ({ 
  groups, 
  centerLat = 39.8283, 
  centerLng = -98.5795, 
  zoom = 4,
  height = '100%',
  selectedGroupId = null
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const markersRef = useRef<{[id: string]: google.maps.Marker}>({});

  // Store state about whether markers are being created
  const isUpdatingMarkers = useRef(false);

  // Implementação de initializeMap usando useCallback
  const initializeMap = useCallback(() => {
    // Ensure we have both the DOM element and Google Maps API
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.log("Condições de inicialização do mapa não atendidas");
      return;
    }

    try {
      const mapOptions: GoogleMapOptions = {
        center: { lat: centerLat, lng: centerLng },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }]
          }
        ]
      };

      // Create new map instance
      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      
      // Create info window
      const newInfoWindow = new window.google.maps.InfoWindow();
      
      // Set state
      setMap(newMap);
      setInfoWindow(newInfoWindow);
      setIsMapReady(true);
      
      console.log("Mapa inicializado com sucesso");
    } catch (error) {
      console.error("Erro ao inicializar o mapa:", error);
    }
  }, [centerLat, centerLng, zoom]);

  // Initialize the map
  useEffect(() => {
    // Create a variable to track if component is mounted
    let isMounted = true;

    // Function to load Google Maps script
    const loadGoogleMapsScript = () => {
      // Set flag to prevent duplicate script loading
      window.googleMapsInitialized = true;
      
      return new Promise<void>((resolve, reject) => {
        try {
          // Create script element
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=Function.prototype`;
          script.async = true;
          script.defer = true;
          
          // Handle script load
          script.onload = () => resolve();
          script.onerror = (error) => reject(error);
          
          // Add script to page
          document.head.appendChild(script);
        } catch (error) {
          reject(error);
        }
      });
    };

    // Function to initialize map
    const setupMap = async () => {
      // If the component was unmounted, don't proceed
      if (!isMounted) return;

      // Check if the Google Maps script is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // If the initialization flag is set but Google isn't available, we need to load it
      if (window.googleMapsInitialized && !window.google) {
        try {
          await loadGoogleMapsScript();
          if (isMounted) initializeMap();
        } catch (error) {
          console.error("Failed to load Google Maps:", error);
        }
        return;
      }

      // First time loading
      if (!window.googleMapsInitialized) {
        try {
          // Check if a script is already in the DOM
          if (!document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`)) {
            await loadGoogleMapsScript();
          } else {
            // Script tag exists but might not be loaded yet
            window.googleMapsInitialized = true;
          }
          
          // Wait for Google Maps to load
          if (window.google && window.google.maps) {
            if (isMounted) initializeMap();
          } else {
            // Poll for Google Maps to become available
            const checkGoogleMaps = setInterval(() => {
              if (window.google && window.google.maps) {
                clearInterval(checkGoogleMaps);
                if (isMounted) initializeMap();
              }
            }, 100);
            
            // Give up after 10 seconds to avoid infinite polling
            setTimeout(() => {
              clearInterval(checkGoogleMaps);
              console.error("Timeout waiting for Google Maps to load");
            }, 10000);
          }
        } catch (error) {
          console.error("Error loading Google Maps:", error);
        }
      }
    };

    // Start the map setup process
    setupMap();

    // Cleanup function
    return () => {
      isMounted = false;
      
      // Also clean up any existing markers to prevent memory leaks
      if (markers.length > 0) {
        markers.forEach(marker => {
          if (marker) marker.setMap(null);
        });
      }
    };
  }, [initializeMap, markers]);

  // Add markers when map is ready and groups change
  useEffect(() => {
    if (!isMapReady || !map || !infoWindow) {
      console.log("Mapa ou janela de informações não estão prontos");
      return;
    }

    // Prevent concurrent marker updates to avoid memory leaks
    if (isUpdatingMarkers.current) {
      return;
    }

    isUpdatingMarkers.current = true;

    try {
      // Don't proceed if there are no groups
      if (!groups || groups.length === 0) {
        // Clear existing markers if no groups
        markers.forEach(marker => {
          if (marker) marker.setMap(null);
        });
        setMarkers([]);
        markersRef.current = {};
        console.log("Nenhum grupo para adicionar ao mapa");
        isUpdatingMarkers.current = false;
        return;
      }

      // Filter valid groups first
      const validGroups = groups.filter(group => 
        group.coordinates?.latitude && 
        group.coordinates?.longitude
      );

      if (validGroups.length === 0) {
        // Clear existing markers if no valid groups
        markers.forEach(marker => {
          if (marker) marker.setMap(null);
        });
        setMarkers([]);
        markersRef.current = {};
        console.log("Nenhuma coordenada válida nos grupos");
        isUpdatingMarkers.current = false;
        return;
      }

      console.log(`Adicionando ${validGroups.length} marcadores ao mapa`);

      // Collect markers to remove
      const markersToRemove = [...markers];
      const newMarkersArray: google.maps.Marker[] = [];
      const newMarkersMap: {[id: string]: google.maps.Marker} = {};

      // Process each valid group
      validGroups.forEach(group => {
        // Default marker image
        const isSelected = group.id === selectedGroupId;
        
        // Use different icon for selected marker - make it larger for selected
        const markerIcon = {
          url: isSelected 
            ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new window.google.maps.Size(isSelected ? 48 : 32, isSelected ? 48 : 32),
          origin: new window.google.maps.Point(0, 0),
          anchor: new window.google.maps.Point(isSelected ? 24 : 16, isSelected ? 48 : 32)
        };

        // Create and add the marker - use DROP animation for all markers
        const marker = new window.google.maps.Marker({
          position: { 
            lat: group.coordinates.latitude, 
            lng: group.coordinates.longitude 
          },
          map: map,
          title: group.university,
          animation: window.google.maps.Animation.DROP,
          icon: markerIcon,
          zIndex: isSelected ? 1000 : 1 // Selected marker appears on top
        });

        // Store reference to marker
        newMarkersArray.push(marker);
        newMarkersMap[group.id] = marker;

        // Create info window content with enhanced styling and contact info
        const content = `
          <div style="padding: 8px; max-width: 300px; font-family: Arial, sans-serif;">
            <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${group.university}</h3>
            <p style="margin: 4px 0; color: #555;">${group.city}, ${group.state}, ${group.country}</p>
            
            <div style="margin-top: 8px;">
              <p style="margin: 4px 0; font-size: 14px;">
                <span style="font-weight: 500;">Encontros:</span> Toda ${group.dayofweek} às ${group.time}
              </p>
              ${group.local ? 
                `<p style="margin: 4px 0; font-size: 14px;">
                  <span style="font-weight: 500;">Local:</span> ${group.local}
                </p>` : ''}
            </div>

            ${group.fulladdress ? 
              `<div style="margin-top: 8px;">
                <p style="margin: 4px 0; font-size: 14px;">
                  <span style="font-weight: 500;">Endereço:</span> ${group.fulladdress}
                </p>
                <a 
                  href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.fulladdress)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="color: #4285F4; text-decoration: none; font-size: 13px; display: inline-block; margin-top: 4px;"
                >
                  🗺️ Como Chegar
                </a>
              </div>` : ''}

            <div style="margin-top: 8px;">
              <p style="margin: 4px 0; font-size: 14px;">
                <span style="font-weight: 500;">Líder:</span> ${group.leader?.name || 'Desconhecido'}
              </p>
              ${group.leader?.email ? 
                `<p style="margin: 4px 0; font-size: 14px;">
                  <span style="font-weight: 500;">E-mail:</span> ${group.leader?.email}
                </p>` : ''}
            </div>

            <div style="margin-top: 10px; display: flex; gap: 8px;">
              ${group.leader?.phone ? 
                `<a 
                  href="https://wa.me/${(group.leader?.phone || '').replace(/\D/g, '')}"
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="background-color: #25D366; color: white; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 13px;"
                >
                  WhatsApp
                </a>` : ''}
              
              ${group.instagram ? 
                `<a 
                  href="https://instagram.com/${group.instagram.replace('@', '')}"
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="background-color: #E1306C; color: white; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 13px;"
                >
                  Instagram
                </a>` : ''}
            </div>
          </div>
        `;

        // Add click listener to open info window
        marker.addListener('click', () => {
          infoWindow.setContent(content);
          infoWindow.open(map, marker);
        });

        // If this marker is selected, open its info window automatically
        if (isSelected) {
          infoWindow.setContent(content);
          infoWindow.open(map, marker);
        }
      });

      // Remove old markers
      markersToRemove.forEach(marker => {
        if (marker) marker.setMap(null);
      });

      // Update state
      setMarkers(newMarkersArray);
      markersRef.current = newMarkersMap;

      // Auto-fit bounds if we have markers
      if (newMarkersArray.length > 0) {
        try {
          // If there's a selected marker, center on it with higher zoom
          if (selectedGroupId) {
            const selectedGroup = validGroups.find(g => g.id === selectedGroupId);
            if (selectedGroup && selectedGroup.coordinates) {
              // Smooth pan to the selected location
              map.panTo({
                lat: selectedGroup.coordinates.latitude,
                lng: selectedGroup.coordinates.longitude
              });
              
              // Zoom in closer to the selected marker
              map.setZoom(14);
              isUpdatingMarkers.current = false;
              return; // Skip the bounds fitting
            }
          }
          
          // If no selected group or selected group not found, fit all markers
          const bounds = new window.google.maps.LatLngBounds();
          
          newMarkersArray.forEach(marker => {
            if (marker && marker.getPosition()) {
              const position = marker.getPosition();
              if (position) {
                bounds.extend(position);
              }
            }
          });
          
          map.fitBounds(bounds);
          
          // Don't zoom in too far on single marker
          const currentZoom = map.getZoom();
          if (currentZoom !== undefined && currentZoom > 15) {
            map.setZoom(15);
          }
        } catch (error) {
          console.error("Erro ao definir limites do mapa:", error);
          // Fall back to center and zoom
          map.setCenter({ lat: centerLat, lng: centerLng });
          map.setZoom(zoom);
        }
      }
    } catch (error) {
      console.error("Erro ao adicionar marcadores ao mapa:", error);
    } finally {
      isUpdatingMarkers.current = false;
    }
  }, [isMapReady, map, infoWindow, groups, selectedGroupId, centerLat, centerLng, zoom]);

  // Handle changes to selectedGroupId
  useEffect(() => {
    if (!map || !isMapReady || !selectedGroupId) return;
    
    // Find the selected marker
    const selectedMarker = markersRef.current[selectedGroupId];
    if (selectedMarker && selectedMarker.getPosition()) {
      // Pan to the selected marker
      const position = selectedMarker.getPosition();
      if (position) {
        map.panTo(position);
        // Zoom in
        map.setZoom(14);
      }
    }
  }, [selectedGroupId, isMapReady, map]);

  // Cleanup effect for map when component unmounts
  useEffect(() => {
    return () => {
      // Close info window if it exists
      if (infoWindow) {
        infoWindow.close();
      }
      
      // Clear markers
      markers.forEach(marker => {
        if (marker) marker.setMap(null);
      });
      
      // Clear internal marker references
      markersRef.current = {};
    };
  }, [infoWindow, markers]);

  return (
    <div ref={mapRef} className="rounded-lg shadow-inner" style={{ width: '100%', height }} />
  );
};

export default Map; 