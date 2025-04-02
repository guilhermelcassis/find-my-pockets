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

// Updated Google Maps type definitions including AdvancedMarkerElement
declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: GoogleMapOptions) => google.maps.Map;
        InfoWindow: new (options?: google.maps.InfoWindowOptions) => google.maps.InfoWindow;
        LatLngBounds: new () => google.maps.LatLngBounds;
        Animation: {
          DROP: number;
          BOUNCE: number;
        };
        LatLng: new (lat: number, lng: number) => google.maps.LatLng;
        Size: new (width: number, height: number) => google.maps.Size;
        Point: new (x: number, y: number) => google.maps.Point;
        // Legacy marker (deprecated)
        Marker: new (options: google.maps.MarkerOptions) => google.maps.Marker;
        // Advanced markers
        marker: {
          AdvancedMarkerElement: new (options: AdvancedMarkerOptions) => google.maps.marker.AdvancedMarkerElement;
          PinElement: new (options: PinElementOptions) => google.maps.marker.PinElement;
        };
      };
    };
    initializeGoogleMaps: () => void;
    googleMapsLoaded: boolean;
    // Add new guard properties
    initializeGoogleMapsGuarded?: () => void;
    __GOOGLE_MAPS_INIT_GUARD?: {
      initialized: boolean;
      loading: boolean;
      callbacks: Array<() => void>;
    };
  }
}

// Advanced Marker options type definition
interface AdvancedMarkerOptions {
  position: { lat: number; lng: number };
  map?: google.maps.Map;
  title?: string;
  content?: HTMLElement;
  zIndex?: number;
  gmpClickable?: boolean;
  gmpDraggable?: boolean;
}

// Pin Element options type definition
interface PinElementOptions {
  scale?: number;
  background?: string;
  borderColor?: string;
  glyphColor?: string;
  glyph?: string;
}

// Basic map options type
interface GoogleMapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  zoomControl?: boolean;
  mapId?: string;
  styles?: Array<{
    featureType?: string;
    elementType?: string;
    stylers: Array<{ [key: string]: string }>;
  }>;
}

const Map = ({ 
  groups, 
  centerLat = -24.64970962763454, 
  centerLng = -47.8806330986609, 
  zoom = 8,
  height = '500px',
  selectedGroupId = null
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Update type to handle both legacy and advanced markers
  const [markers, setMarkers] = useState<Array<google.maps.Marker | google.maps.marker.AdvancedMarkerElement>>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [supportsAdvancedMarkers, setSupportsAdvancedMarkers] = useState(false);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  
  // Create a stable reference to markers by ID
  const markersRef = useRef<{[id: string]: google.maps.Marker | google.maps.marker.AdvancedMarkerElement}>({});
  
  // Store state about whether markers are being updated
  const isUpdatingMarkers = useRef(false);
  const googleMapsLoadingRef = useRef<boolean>(false);
  const mapInitializedRef = useRef<boolean>(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a counter to track initialization attempts and prevent loops
  const initAttemptRef = useRef<number>(0);
  const componentMountedRef = useRef<boolean>(false);

  // Initialize map function (called after Google Maps is loaded)
  const initializeMap = useCallback(() => {
    // Prevent multiple initializations
    if (mapInitializedRef.current) {
      console.log("Map already initialized, skipping re-initialization");
      return;
    }
    
    // Track initialization attempts to prevent infinite loops
    initAttemptRef.current += 1;
    
    // Safety check - if we've tried to initialize too many times, bail out
    if (initAttemptRef.current > 3) {
      console.error("Too many initialization attempts, aborting to prevent loop");
      setLoadError("Map initialization failed. Please refresh the page.");
      return;
    }

    if (!mapRef.current) {
      setLoadError("Map container is not available. Please refresh the page.");
      return;
    }
    
    if (!window.google?.maps) {
      setLoadError("Google Maps API failed to load. Please refresh the page.");
      return;
    }

    try {
      console.log("Initializing map...");
      mapInitializedRef.current = true;
      
      // Check if Advanced Markers are supported
      const hasAdvancedMarkers = !!(window.google.maps.marker?.AdvancedMarkerElement);
      setSupportsAdvancedMarkers(hasAdvancedMarkers);
      
      // Configure map options with mapId for advanced features
      const mapOptions: GoogleMapOptions = {
        center: { lat: centerLat, lng: centerLng },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        // Adding a default mapId for advanced markers
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '8f077ee2408e83c5',
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
      
      // Set state without delay - the map container is already visible
      setMap(newMap);
      setInfoWindow(newInfoWindow);
      setIsMapReady(true);
      setInitialZoomDone(true); // Mark initial zoom as done to prevent auto-zoom
      
      console.log("Map initialized successfully");
      
    } catch (error) {
      console.error("Error during map initialization:", error);
      setLoadError(`Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`);
      mapInitializedRef.current = false;
    }
  }, [centerLat, centerLng, zoom]);

  // Function to load Google Maps API once
  const loadGoogleMapsAPI = useCallback(() => {
    // Don't load if already loaded or loading
    if (window.google?.maps) {
      console.log("Google Maps already loaded, initializing map");
      initializeMap();
      return Promise.resolve();
    }
    
    if (googleMapsLoadingRef.current) {
      console.log("Google Maps is already loading, waiting");
      return Promise.resolve();
    }

    // Check the global guard if available
    if (window.__GOOGLE_MAPS_INIT_GUARD) {
      if (window.__GOOGLE_MAPS_INIT_GUARD.initialized) {
        console.log("Google Maps already initialized via global guard");
        initializeMap();
        return Promise.resolve();
      }
      
      if (window.__GOOGLE_MAPS_INIT_GUARD.loading) {
        console.log("Google Maps already loading via global guard");
        return new Promise<void>((resolve) => {
          if (window.__GOOGLE_MAPS_INIT_GUARD?.callbacks) {
            window.__GOOGLE_MAPS_INIT_GUARD.callbacks.push(() => {
              resolve();
              initializeMap();
            });
          } else {
            // Fallback in case callbacks array is not available
            setTimeout(() => {
              resolve();
              initializeMap();
            }, 1000);
          }
        });
      }
      
      // Mark as loading in the global guard
      window.__GOOGLE_MAPS_INIT_GUARD.loading = true;
    }

    googleMapsLoadingRef.current = true;
    console.log("Starting Google Maps API load");

    return new Promise<void>((resolve, reject) => {
      // Set a timeout to detect if loading takes too long
      loadTimeoutRef.current = setTimeout(() => {
        setLoadError("Google Maps took too long to load. Please refresh the page.");
        googleMapsLoadingRef.current = false;
        if (window.__GOOGLE_MAPS_INIT_GUARD) {
          window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
        }
        reject(new Error("Google Maps loading timeout"));
      }, 20000); // 20 seconds timeout - increased to be more patient

      // Create a global callback function
      window.initializeGoogleMaps = () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        window.googleMapsLoaded = true;
        googleMapsLoadingRef.current = false;
        console.log("Google Maps API loaded via callback");
        resolve();
        
        // Initialize the map after the callback is triggered
        if (componentMountedRef.current) {
          initializeMap();
        }
      };

      try {
        // Check if the script is already in the document
        const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        if (existingScript) {
          console.log("Google Maps script already exists, not adding again");
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          googleMapsLoadingRef.current = false;
          
          // If the API is already loaded but not initialized properly, try again
          if (window.google?.maps) {
            resolve();
            initializeMap();
          }
          return;
        }
        
        const script = document.createElement('script');
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setLoadError("Google Maps API key is missing. Please check your environment variables.");
          googleMapsLoadingRef.current = false;
          if (window.__GOOGLE_MAPS_INIT_GUARD) {
            window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
          }
          reject(new Error("Google Maps API key is missing"));
          return;
        }
        
        // Update script URL to include marker library for Advanced Markers
        // Use the guarded callback if available
        const callbackName = window.initializeGoogleMapsGuarded ? 'initializeGoogleMapsGuarded' : 'initializeGoogleMaps';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=beta&loading=async&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        
        script.onerror = (error) => {
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
            loadTimeoutRef.current = null;
          }
          setLoadError("Failed to load Google Maps. Please check your internet connection and try again.");
          googleMapsLoadingRef.current = false;
          if (window.__GOOGLE_MAPS_INIT_GUARD) {
            window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
          }
          reject(error);
        };
        
        document.head.appendChild(script);
        console.log("Added Google Maps script to document");
      } catch (error) {
        console.error("Error adding Google Maps script:", error);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        setLoadError("An error occurred while loading Google Maps.");
        googleMapsLoadingRef.current = false;
        if (window.__GOOGLE_MAPS_INIT_GUARD) {
          window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
        }
        reject(error);
      }
    });
  }, [initializeMap]);

  // Setup and initialize the map - Run only once on mount
  useEffect(() => {
    componentMountedRef.current = true;
    let isMounted = true;
    let initialRun = true;
    
    // Reset any remnants from previous mounts
    mapInitializedRef.current = false;
    googleMapsLoadingRef.current = false;
    initAttemptRef.current = 0;
    
    const setupMap = async () => {
      if (!isMounted || !initialRun) return;
      
      // Important: prevent repeated initialization
      initialRun = false;
      
      try {
        console.log("Setting up map");
        await loadGoogleMapsAPI();
      } catch (error) {
        console.error("Error setting up map:", error);
        if (isMounted) {
          setLoadError("Failed to initialize map. Please refresh the page.");
        }
      }
    };

    setupMap();

    return () => {
      // Component unmounting
      console.log("Map component unmounting, cleaning up");
      componentMountedRef.current = false;
      isMounted = false;
      initialRun = false;
      
      // Clear any pending timeouts
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      // Clean up global callback to prevent multiple registrations
      if (window.initializeGoogleMaps) {
        window.initializeGoogleMaps = () => {
          console.log("Ignored callback after component unmounted");
        };
      }
    };
  }, []); // Empty dependency array - setup only on mount

  // Function to create an advanced marker (used if supported)
  const createAdvancedMarker = useCallback((group: Group, isSelected: boolean, map: google.maps.Map) => {
    if (!window.google?.maps?.marker) return null;

    try {
      // Create a pin with different appearance for selected markers
      const pin = new window.google.maps.marker.PinElement({
        scale: isSelected ? 1.4 : 1.0,
        background: isSelected ? '#4285F4' : '#E53935',
        borderColor: isSelected ? '#2A56C6' : '#B31412',
        glyphColor: 'white',
      });
      
      // Create the advanced marker - using pin.element instead of pin directly
      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: { 
          lat: group.coordinates.latitude, 
          lng: group.coordinates.longitude 
        },
        map: map,
        title: group.university,
        content: pin.element, // Fixed: accessing the element property of PinElement
        zIndex: isSelected ? 1000 : 1, // Selected marker appears on top
        gmpClickable: true,
      });
      
      return advancedMarker;
    } catch (error) {
      console.error("Error creating advanced marker:", error);
      return null;
    }
  }, []);

  // Function to create a legacy marker (used as fallback)
  const createLegacyMarker = useCallback((group: Group, isSelected: boolean, map: google.maps.Map) => {
    try {
      // Use different icon for selected marker - make it larger
      const markerIcon = {
        url: isSelected 
          ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new window.google.maps.Size(isSelected ? 48 : 32, isSelected ? 48 : 32),
        origin: new window.google.maps.Point(0, 0),
        anchor: new window.google.maps.Point(isSelected ? 24 : 16, isSelected ? 48 : 32)
      };

      // Create and add the marker - use DROP animation only when selected
      const marker = new window.google.maps.Marker({
        position: { 
          lat: group.coordinates.latitude, 
          lng: group.coordinates.longitude 
        },
        map: map,
        title: group.university,
        animation: isSelected ? window.google.maps.Animation.DROP : undefined,
        icon: markerIcon,
        zIndex: isSelected ? 1000 : 1 // Selected marker appears on top
      });
      
      return marker;
    } catch (error) {
      console.error("Error creating legacy marker:", error);
      return null;
    }
  }, []);

  // Add markers when groups change and map is ready - including fixed dependency array
  useEffect(() => {
    // Only run when map and infoWindow are available and in ready state
    if (!isMapReady || !map || !infoWindow) {
      return;
    }

    // Prevent concurrent marker updates
    if (isUpdatingMarkers.current) {
      return;
    }

    console.log(`Adding ${groups?.length || 0} markers to map`);
    isUpdatingMarkers.current = true;

    // Track any setTimeout IDs we create for later cleanup
    const timeoutIds: NodeJS.Timeout[] = [];

    try {
      // First close any open info windows to reset state
      if (infoWindow) {
        infoWindow.close();
      }
      
      // Clear existing markers from the map
      markers.forEach(marker => {
        if (marker) {
          if (marker instanceof google.maps.Marker) {
            marker.setMap(null);
          } else {
            // For AdvancedMarkerElement
            marker.map = null;
          }
        }
      });

      // Don't proceed if there are no groups
      if (!groups || groups.length === 0) {
        setMarkers([]);
        markersRef.current = {};
        isUpdatingMarkers.current = false;
        return;
      }

      // Filter valid groups first
      const validGroups = groups.filter(group => 
        group.coordinates?.latitude && 
        group.coordinates?.longitude
      );

      if (validGroups.length === 0) {
        setMarkers([]);
        markersRef.current = {};
        isUpdatingMarkers.current = false;
        return;
      }

      // Find the selected group first if any
      const selectedGroup = selectedGroupId 
        ? validGroups.find(g => g.id === selectedGroupId) 
        : null;
      
      if (selectedGroup) {
        console.log('Selected group found:', selectedGroup.university, 
                   'ID:', selectedGroup.id,
                   'Coordinates:', selectedGroup.coordinates.latitude, selectedGroup.coordinates.longitude);
      } else if (selectedGroupId) {
        console.log('Selected group NOT found. Looking for ID:', selectedGroupId, 
                   'Available IDs:', validGroups.map(g => g.id).join(', '));
      }

      // Create new arrays to store markers
      const newMarkersArray: Array<google.maps.Marker | google.maps.marker.AdvancedMarkerElement> = [];
      const newMarkersMap: {[id: string]: google.maps.Marker | google.maps.marker.AdvancedMarkerElement} = {};

      // Process each valid group
      validGroups.forEach(group => {
        // Check if selected
        const isSelected = group.id === selectedGroupId;
        
        // Create marker based on available API version
        let marker: google.maps.Marker | google.maps.marker.AdvancedMarkerElement | null = null;
        
        if (supportsAdvancedMarkers) {
          marker = createAdvancedMarker(group, isSelected, map);
        }
        
        // Fallback to legacy marker if advanced marker creation failed or isn't supported
        if (!marker) {
          marker = createLegacyMarker(group, isSelected, map);
        }
        
        if (!marker) {
          return; // Skip if marker creation failed
        }

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
        if (marker instanceof google.maps.Marker) {
          // For legacy marker
          marker.addListener('click', () => {
            infoWindow.close();
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
            
            // Also center on this marker when clicked
            const position = marker.getPosition();
            if (position) {
              map.panTo(position);
              map.setZoom(14);
            }
          });
          
          // If this marker is selected, open its info window immediately
          if (isSelected) {
            // Log position data for debugging
            console.log('Opening info window for legacy marker:', group.university);
            
            setTimeout(() => {
              infoWindow.setContent(content);
              infoWindow.open(map, marker);
              
              // Ensure map is centered on this marker
              const position = marker.getPosition();
              if (position) {
                console.log('Centering map on position:', position.lat(), position.lng());
                map.setCenter(position);
                map.setZoom(14);
              }
            }, 200);
          }
        } else {
          // For advanced marker
          const position = { 
            lat: group.coordinates.latitude, 
            lng: group.coordinates.longitude 
          };
          
          marker.addEventListener('click', () => {
            infoWindow.close();
            infoWindow.setContent(content);
            infoWindow.open(map);
            infoWindow.setPosition(position);
            
            // Also center on this marker when clicked
            map.panTo(position);
            map.setZoom(14);
          });
          
          // If this marker is selected, open its info window immediately
          if (isSelected) {
            // Log position data for debugging
            console.log('Opening info window for advanced marker:', group.university);
            console.log('Position:', position);
            
            setTimeout(() => {
              infoWindow.setContent(content);
              infoWindow.open(map);
              infoWindow.setPosition(position);
              
              // Ensure map is centered on this marker
              map.setCenter(position);
              map.setZoom(14);
            }, 200);
          }
        }
      });

      // Update state with new markers
      setMarkers(newMarkersArray);
      markersRef.current = newMarkersMap;

      // Update immediate centering for selected group
      if (selectedGroup && map) {
        const centerPosition = {
          lat: selectedGroup.coordinates.latitude,
          lng: selectedGroup.coordinates.longitude
        };
        
        console.log('Setting map center for selected group with ID:', selectedGroupId);
        console.log('Center position:', centerPosition);
        
        // More aggressive centering - set both center and pan with higher zoom
        map.setCenter(centerPosition);
        map.panTo(centerPosition);
        map.setZoom(15); // Higher zoom level for better visibility
        
        // Add a slight delay to ensure markers are rendered before we open the info window
        const centeringTimeout = setTimeout(() => {
          // Double-check that map and selectedGroup still exist
          if (map && selectedGroup) {
            // Re-center again in case map has moved
            map.panTo(centerPosition);
            
            // Open info window for the selected marker
            const selectedMarker = newMarkersMap[selectedGroup.id];
            if (selectedMarker && infoWindow) {
              console.log('Found marker for selected group:', selectedGroup.id, 
                         'Marker type:', selectedMarker instanceof google.maps.Marker ? 'Legacy' : 'Advanced');
              
              // Use the same rich content template as defined for regular markers
              const content = `
                <div style="padding: 8px; max-width: 300px; font-family: Arial, sans-serif;">
                  <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${selectedGroup.university}</h3>
                  <p style="margin: 4px 0; color: #555;">${selectedGroup.city}, ${selectedGroup.state}, ${selectedGroup.country}</p>
                  
                  <div style="margin-top: 8px;">
                    <p style="margin: 4px 0; font-size: 14px;">
                      <span style="font-weight: 500;">Encontros:</span> Toda ${selectedGroup.dayofweek} às ${selectedGroup.time}
                    </p>
                    ${selectedGroup.local ? 
                      `<p style="margin: 4px 0; font-size: 14px;">
                        <span style="font-weight: 500;">Local:</span> ${selectedGroup.local}
                      </p>` : ''}
                  </div>

                  ${selectedGroup.fulladdress ? 
                    `<div style="margin-top: 8px;">
                      <p style="margin: 4px 0; font-size: 14px;">
                        <span style="font-weight: 500;">Endereço:</span> ${selectedGroup.fulladdress}
                      </p>
                      <a 
                        href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedGroup.fulladdress)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        style="color: #4285F4; text-decoration: none; font-size: 13px; display: inline-block; margin-top: 4px;"
                      >
                        🗺️ Como Chegar
                      </a>
                    </div>` : ''}

                  <div style="margin-top: 8px;">
                    <p style="margin: 4px 0; font-size: 14px;">
                      <span style="font-weight: 500;">Líder:</span> ${selectedGroup.leader?.name || 'Desconhecido'}
                    </p>
                    ${selectedGroup.leader?.email ? 
                      `<p style="margin: 4px 0; font-size: 14px;">
                        <span style="font-weight: 500;">E-mail:</span> ${selectedGroup.leader?.email}
                      </p>` : ''}
                  </div>

                  <div style="margin-top: 10px; display: flex; gap: 8px;">
                    ${selectedGroup.leader?.phone ? 
                      `<a 
                        href="https://wa.me/${(selectedGroup.leader?.phone || '').replace(/\D/g, '')}"
                        target="_blank" 
                        rel="noopener noreferrer"
                        style="background-color: #25D366; color: white; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 13px;"
                      >
                        WhatsApp
                      </a>` : ''}
                    
                    ${selectedGroup.instagram ? 
                      `<a 
                        href="https://instagram.com/${selectedGroup.instagram.replace('@', '')}"
                        target="_blank" 
                        rel="noopener noreferrer"
                        style="background-color: #E1306C; color: white; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 13px;"
                      >
                        Instagram
                      </a>` : ''}
                  </div>
                </div>
              `;
              
              infoWindow.setContent(content);
              
              // Open the info window appropriately based on marker type
              if (selectedMarker instanceof google.maps.Marker) {
                infoWindow.open(map, selectedMarker);
              } else {
                // For advanced marker
                infoWindow.setPosition(centerPosition);
                infoWindow.open(map);
              }
              
              console.log('Opened info window for selected group:', selectedGroup.university);
            }
          }
        }, 300);
        
        // Store timeout ID for cleanup
        timeoutIds.push(centeringTimeout);
      } else if (newMarkersArray.length > 0 && !initialZoomDone) {
        // Only fit bounds on initial load or when no specific selection
        try {
          const bounds = new window.google.maps.LatLngBounds();
          
          newMarkersArray.forEach(marker => {
            let position;
            
            if (marker instanceof google.maps.Marker) {
              position = marker.getPosition();
            } else {
              // For AdvancedMarkerElement, get position differently
              const pos = marker.position as unknown as { lat: number, lng: number };
              if (pos && pos.lat && pos.lng) {
                position = new window.google.maps.LatLng(pos.lat, pos.lng);
              }
            }
            
            if (position) {
              bounds.extend(position);
            }
          });
          
          // Apply bounds with padding
          map.fitBounds(bounds, 40);
          
          // Don't zoom in too far on single marker, and maintain initial zoom
          setTimeout(() => {
            const currentZoom = map.getZoom();
            if (currentZoom !== undefined && currentZoom > Math.min(zoom + 2, 15)) {
              map.setZoom(Math.min(zoom + 2, 15));
            }
          }, 300);
          
          setInitialZoomDone(true);
        } catch (error) {
          console.error("Error setting map bounds:", error);
          map.setCenter({ lat: centerLat, lng: centerLng });
          map.setZoom(zoom);
        }
      }
    } catch (error) {
      console.error("Error adding markers to map:", error);
    } finally {
      isUpdatingMarkers.current = false;
    }
    
    // Cleanup function to clear any timeouts
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [isMapReady, map, infoWindow, groups, selectedGroupId, centerLat, centerLng, zoom, supportsAdvancedMarkers, createAdvancedMarker, createLegacyMarker, initialZoomDone]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      console.log("Cleanup effect running");
      // Clean up all markers
      markers.forEach(marker => {
        if (marker) {
          if (marker instanceof google.maps.Marker) {
            marker.setMap(null);
          } else {
            // For AdvancedMarkerElement
            marker.map = null;
          }
        }
      });
      
      // Close info window
      if (infoWindow) {
        infoWindow.close();
      }
      
      // Reset internal marker references
      markersRef.current = {};
      
      // Reset flags
      mapInitializedRef.current = false;
      googleMapsLoadingRef.current = false;
      initAttemptRef.current = 0;
    };
  }, [markers, infoWindow]);

  // Apply a skeleton loader style to mimic the map before it loads
  const skeletonStyle = {
    backgroundImage: `linear-gradient(90deg, #f0f0f0 0px, #f8f8f8 40px, #f0f0f0 80px)`,
    backgroundSize: '1000px 100%',
    animation: 'pulse 1.5s ease-in-out infinite, shimmer 2s infinite linear',
  };

  // No more showing loading states, just have the map container ready and show the error if needed
  return (
    <div className="relative rounded-lg shadow-inner" style={{ width: '100%', height }}>
      {/* Always visible map container with skeleton background while loading */}
      <div 
        ref={mapRef} 
        className="absolute inset-0 rounded-lg transition-all duration-1000 ease-in-out"
        style={{ 
          width: '100%', 
          height: '100%',
          ...(!isMapReady && !loadError ? skeletonStyle : {})
        }} 
      />
      
      {/* Only show error message if there is an error */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg p-4 z-10 transition-opacity duration-300">
          <div className="text-center max-w-md">
            <div className="inline-block p-2 rounded-full bg-red-100 text-red-500 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800">Unable to load map</h3>
            <p className="mt-1 text-sm text-gray-600">{loadError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
      
      {/* Add global styles for enhanced animations */}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.8; }
          100% { opacity: 0.6; }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .gm-style-iw {
          transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out !important;
          transform-origin: 50% 100%;
        }
      `}</style>
    </div>
  );
};

export default Map; 