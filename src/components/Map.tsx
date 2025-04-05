'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Group } from '../lib/interfaces';

// Export interface to define the map ref methods
export interface MapRef {
  fitBoundsToMarkers: () => void;
  showGroupDetails: (groupId: string) => void;
  zoomToGroup: (groupId: string) => void;
  clearMapClicks: () => void;
}

interface MapProps {
  groups: Group[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  selectedGroupId?: string | null;
  onMarkerClick?: (groupId: string) => void;
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
    // Add property to track if user is typing to prevent focus stealing
    isUserTyping?: boolean;
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
}

// Convert to forwardRef to expose methods to parent
const Map = forwardRef<MapRef, MapProps>(({ 
  groups, 
  centerLat = -24.64970962763454, 
  centerLng = -47.8806330986609, 
  zoom = 6,
  height = '500px',
  selectedGroupId = null,
  onMarkerClick
}, ref) => {
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
  // Store previous group IDs to prevent unnecessary redraws
  const prevGroupIds = useRef<string>('');

  // Add a ref to track whether the marker was selected from the map or the list
  const selectedFromMapRef = useRef<boolean>(false);

  // Add a new ref to track the last group ID we've centered on
  const lastCenteredGroupIdRef = useRef<string | null>(null);

  // Add another ref to persistently track which markers were selected via map clicks
  const markerClickIdsRef = useRef<Set<string>>(new Set());

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
      console.error("Map container is not available (mapRef.current is null)");
      setLoadError("Map container is not available. Please refresh the page.");
      return;
    }
    
    // Debug container dimensions
    const containerRect = mapRef.current.getBoundingClientRect();
    console.log("Map container dimensions:", {
      width: containerRect.width,
      height: containerRect.height,
      visible: containerRect.width > 0 && containerRect.height > 0,
      offsetWidth: mapRef.current.offsetWidth,
      offsetHeight: mapRef.current.offsetHeight,
      clientWidth: mapRef.current.clientWidth,
      clientHeight: mapRef.current.clientHeight
    });
    
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn("Map container has zero width or height. Map will not display correctly.");
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
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '8f077ee2408e83c5',
      };

      // Create new map instance
      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      
      // Create info window
      const newInfoWindow = new window.google.maps.InfoWindow({
        maxWidth: 320,
        pixelOffset: new window.google.maps.Size(0, -5),
        disableAutoPan: false
      });
      
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

  // Load Google Maps API
  const loadGoogleMapsAPI = useCallback(async (): Promise<void> => {
    // Don't try to load if already loaded
    if (window.google?.maps?.Map) {
      console.log("Google Maps API already loaded");
      initializeMap();
      return;
    }
    
    // Don't try to load if already loading
    if (googleMapsLoadingRef.current) {
      console.log("Google Maps API already loading");
      return;
    }
    
    googleMapsLoadingRef.current = true;
    
    return new Promise((resolve, reject) => {
      try {
        console.log("Starting Google Maps API load");
        
        // Set global callback for API
        window.initializeGoogleMaps = () => {
          if (!componentMountedRef.current) {
            console.log("Component unmounted before API loaded, aborting initialization");
            return;
          }
          
          console.log("Google Maps API loaded via callback");
          googleMapsLoadingRef.current = false;
          
          try {
            initializeMap();
            resolve();
          } catch (error) {
            console.error("Error in initialization callback:", error);
            reject(error);
          }
        };
        
        // Check if script already exists (to avoid duplicates)
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
          console.log("Google Maps script already exists in document");
          // If script exists but API not available, it's probably still loading
          return;
        }
        
        // Create script element
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        console.log("API Key available:", !!apiKey, "Length:", apiKey ? apiKey.length : 0);
        if (!apiKey) {
          const error = new Error("Google Maps API key is missing");
          setLoadError(error.message);
          reject(error);
          return;
        }
        
        const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '8f077ee2408e83c5';
        
        // Create and configure the script element
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        
        // Fix the loading warning by setting the proper attributes in the correct order
        // Set type="text/javascript" first
        script.type = 'text/javascript';
        
        // Set loading="async" for better performance (addressing the warning)
        script.setAttribute('loading', 'async');
        
        // Keep the regular async attribute too
        script.async = true;
        script.defer = true;
        
        // Set the src last
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initializeGoogleMaps&libraries=marker&v=beta&mapIds=${mapId}`;
        
        script.onerror = (error) => {
          console.error("Error loading Google Maps script:", error);
          googleMapsLoadingRef.current = false;
          setLoadError("Failed to load Google Maps. Please check your connection and try again.");
          reject(new Error("Failed to load Google Maps script"));
        };
        
        console.log("Script URL created successfully, attempting to add to document head");
        
        document.head.appendChild(script);
        console.log("Added Google Maps script to document");
        
        // Set a timeout to prevent hanging indefinitely
        loadTimeoutRef.current = setTimeout(() => {
          if (googleMapsLoadingRef.current) {
            console.error("Google Maps API load timed out");
            googleMapsLoadingRef.current = false;
            setLoadError("Google Maps failed to load within the expected time. Please refresh the page.");
            reject(new Error("Google Maps API load timeout"));
          }
        }, 15000); // 15 seconds timeout
        
      } catch (error) {
        console.error("Error during API load setup:", error);
        googleMapsLoadingRef.current = false;
        setLoadError(`Failed to load Google Maps: ${error instanceof Error ? error.message : 'Unknown error'}`);
        reject(error);
      }
    });
  }, [initializeMap]);

  // Setup and initialize the map - Run only once on mount
  useEffect(() => {
    componentMountedRef.current = true;
    let isMounted = true;
    let initialRun = true;
    
    // Reset any remnants from previous mounts - Add more aggressive cleanup
    mapInitializedRef.current = false;
    googleMapsLoadingRef.current = false;
    initAttemptRef.current = 0;
    
    // Clear any existing markers to prevent memory leaks
    Object.values(markersRef.current).forEach(marker => {
      if (marker) {
        if ('setMap' in marker) {
          marker.setMap(null);
        }
      }
    });
    markersRef.current = {};
    
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
      // Component unmounting - Enhanced cleanup
      console.log("Map component unmounting, cleaning up");
      componentMountedRef.current = false;
      isMounted = false;
      initialRun = false;
      
      // Clear any pending timeouts
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      // Clean up all markers
      Object.values(markersRef.current).forEach(marker => {
        if (marker) {
          if ('setMap' in marker) {
            marker.setMap(null);
          }
        }
      });
      markersRef.current = {};
      
      // Clean up global callback to prevent multiple registrations
      if (window.initializeGoogleMaps) {
        window.initializeGoogleMaps = () => {
          console.log("Ignored callback after component unmounted");
        };
      }
    };
  }, []);

  // Function to create a advanced marker with fallbacks
  const createAdvancedMarker = useCallback((
    group: Group,
    isSelected: boolean,
    map: google.maps.Map
  ): google.maps.marker.AdvancedMarkerElement | null => {
    try {
      // Make sure the element exists before trying to use it
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        return null;
      }
      
      // Create marker element with proper styling
      const markerSize = isSelected ? 40 : 32; // Make selected markers larger
      const markerColor = isSelected ? '#2563eb' : '#3b82f6'; // Use a darker blue for selected
      const shadowSize = isSelected ? '0 4px 8px rgba(37, 99, 235, 0.5)' : '0 2px 4px rgba(0, 0, 0, 0.2)';
      
      // Create container for the marker
      const container = document.createElement('div');
      container.className = 'marker-container';
      container.innerHTML = `
        <div class="pocket-marker" style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          background-color: ${markerColor};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: ${shadowSize};
          transition: all 0.3s ease;
          cursor: pointer;
          border: ${isSelected ? '2px solid white' : 'none'};
        ">
          <div style="
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: ${isSelected ? '16px' : '14px'};
            font-family: Arial, sans-serif;
          ">
            ${group.university.charAt(0)}
        </div>
        </div>
        ${isSelected ? '<div class="marker-pulse"></div>' : ''}
      `;
      
      // Add CSS for the pulse effect
      if (isSelected) {
        const style = document.createElement('style');
        style.textContent = `
          .marker-container {
            position: relative;
          }
          .marker-pulse {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${markerSize + 20}px;
            height: ${markerSize + 20}px;
            border-radius: 50%;
            background-color: rgba(37, 99, 235, 0.3);
            animation: pulse 1.5s infinite;
            z-index: -1;
          }
          @keyframes pulse {
            0% {
              transform: translate(-50%, -50%) scale(0.8);
              opacity: 0.7;
            }
            70% {
              transform: translate(-50%, -50%) scale(1.3);
              opacity: 0;
            }
            100% {
              transform: translate(-50%, -50%) scale(0.8);
              opacity: 0;
            }
          }
        `;
        container.appendChild(style);
      }

      // Get the marker element to add interactivity
      const markerElement = container.querySelector('.pocket-marker') as HTMLElement;
      
      // Add hover effects
      if (markerElement) {
        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.transform = 'rotate(-45deg) scale(1.1)';
          markerElement.style.boxShadow = shadowSize;
        });
        
        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.transform = 'rotate(-45deg) scale(1)';
          markerElement.style.boxShadow = shadowSize;
        });
      }

      // Create the advanced marker with our styled element
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: { 
          lat: group.coordinates.latitude, 
          lng: group.coordinates.longitude 
        },
        map,
        content: container,
        title: group.name,
        zIndex: isSelected ? 1000 : 100, // Put selected markers on top
        gmpClickable: true, // Explicitly make the marker clickable for accessibility
        gmpDraggable: false
      });

      // For accessibility, add tooltip
      if (marker.element) {
        marker.element.setAttribute('role', 'button');
        marker.element.setAttribute('aria-label', `${group.name} - ${group.university} in ${group.city}`);
        marker.element.setAttribute('tabindex', '0');
      }

      // Don't add the click event listener here, as it will be added later
      // when all markers are processed
      
      return marker;
    } catch (error) {
      console.error('Error creating advanced marker:', error);
      return null;
    }
  }, []);

  // Function to create a legacy marker (used as fallback)
  const createLegacyMarker = useCallback((
    group: Group,
    isSelected: boolean,
    map: google.maps.Map
  ): google.maps.Marker | null => {
    try {
      // Create a marker with legacy API
      const marker = new window.google.maps.Marker({
        position: { 
          lat: group.coordinates.latitude, 
          lng: group.coordinates.longitude 
        },
        map,
        title: group.name,
        cursor: 'pointer',
        zIndex: isSelected ? 1000 : 100, // Selected markers above others
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: isSelected ? '#2563eb' : '#3b82f6',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: isSelected ? 2 : 1,
          scale: isSelected ? 12 : 10
        },
        label: {
          text: group.university.charAt(0),
          color: 'white',
          fontWeight: 'bold',
          fontSize: isSelected ? '14px' : '12px'
        }
      });

      // Add animation for selected marker, but stop after a short time
      if (isSelected && marker.getAnimation() === window.google.maps.Animation.BOUNCE) {
        setTimeout(() => {
          marker.setAnimation(null);
        }, 1500); // Stop bouncing after 1.5 seconds
      }
      
      return marker;
    } catch (error) {
      console.error('Error creating legacy marker:', error);
      return null;
    }
  }, []);

  // Function to generate formatted info window content
  const generateInfoWindowContent = (group: Group): string => {
    // Format the meeting day and time
    const meetingSchedule = group.dayofweek && group.time 
      ? `${group.dayofweek} at ${group.time}`
      : 'Contact for schedule';

    // Format the leader information
    const leaderInfo = group.leader?.name 
      ? `<strong>${group.leader.name}</strong>${group.leader.curso ? ` (${group.leader.curso})` : ''}`
      : 'Contact for leader information';

    // Format the contact options
    let contactOptions = '';
    if (group.leader?.phone) {
      contactOptions += `<a href="https://wa.me/${(group.leader.phone || '').replace(/\D/g, '')}" target="_blank" class="contact-btn whatsapp">WhatsApp</a>`;
    }
    if (group.instagram) {
      contactOptions += `<a href="https://instagram.com/${group.instagram.replace('@', '')}" target="_blank" class="contact-btn instagram">Instagram</a>`;
    }
    
    if (!contactOptions) {
      contactOptions = '<span class="no-contact">No contact information available</span>';
    }

    return `
      <div class="info-window-content">
        <style>
          .info-window-content {
            font-family: 'Roboto', Arial, sans-serif;
            padding: 8px;
            max-width: 300px;
            color: #333;
          }
          .group-name {
            font-size: 18px;
            font-weight: bold;
            color: #1a73e8;
            margin-bottom: 8px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          .university {
            font-size: 18px;
            font-weight: bold;
            color: #1a73e8;
            margin-bottom: 8px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          .info-section {
            margin-bottom: 6px;
          }
          .info-label {
            font-weight: 600;
            color: #555;
          }
          .address {
            font-style: italic;
            color: #666;
            margin-bottom: 8px;
          }
          .meeting-info {
            background-color: #f5f5f5;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 8px;
            font-size: 13px;
          }
          .contact-section {
            margin-top: 10px;
            border-top: 1px solid #eee;
            padding-top: 8px;
          }
          .contact-options {
            display: flex;
            gap: 6px;
            margin-top: 8px;
            flex-wrap: wrap;
          }
          .contact-btn {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            text-decoration: none;
            color: white;
            font-size: 12px;
            font-weight: 500;
          }
          .whatsapp {
            background-color: #25D366;
          }
          .instagram {
            background-color: #E1306C;
          }
          .facebook {
            background-color: #1877F2;
          }
          .no-contact {
            font-style: italic;
            color: #999;
            font-size: 12px;
          }
        </style>
        <div class="university">${group.university || 'Independent Group'}</div>
        
        <div class="info-section">
          <div class="info-label">Location:</div>
          <div>${group.city}${group.state ? `, ${group.state}` : ''}</div>
        </div>
        
        ${group.fulladdress ? `<div class="address">${group.fulladdress}</div>` : ''}
        
        <div class="meeting-info">
          <div class="info-label">Meetings:</div>
          <div>${meetingSchedule}</div>
          ${group.local ? `<div>Location: ${group.local}</div>` : ''}
        </div>
        
        <div class="contact-section">
          <div class="info-label">Leader:</div>
          <div>${leaderInfo}</div>
          
          <div class="contact-options">
            ${contactOptions}
          </div>
        </div>
      </div>
    `;
  };

  // Update the effect that adds the markers to use the generateInfoWindowContent
  useEffect(() => {
    // Only run when map and infoWindow are available and in ready state
    if (!isMapReady || !map || !infoWindow) {
      return;
    }

    // Skip if we're currently updating markers to prevent race conditions
    if (isUpdatingMarkers.current) return;
    
    // Check if groups array has the same ids as before - if so, don't redraw markers
    // This prevents unnecessary marker redraws when only isTyping state changes
    const currentGroupIds = groups.map(g => g.id).sort().join(',');
    
    // If nothing has changed, only selectedGroupId, don't redraw all markers
    // The key change: We now properly handle selectedGroupId by not redrawing all markers
    // just because the selectedGroupId changed - instead we'll handle that in the other effect
    if (currentGroupIds === prevGroupIds.current) {
      // Don't redraw markers just because a marker was selected
      console.log("Skipping marker redraw - groups haven't changed");
      return;
    }
    
    console.log("Drawing markers - group IDs have changed");
    
    // Update the reference for next comparison
    prevGroupIds.current = currentGroupIds;
    
    // Set flag to prevent parallel updates
    isUpdatingMarkers.current = true;

    // Keep track of timeouts to clear when the component unmounts
    const timeoutIds: NodeJS.Timeout[] = [];
    
    try {
      // Check that map is still valid before proceeding
      if (!map || typeof map.getBounds !== 'function') {
        console.warn('Map is not ready or invalid, skipping marker update');
        isUpdatingMarkers.current = false;
        return;
      }
      
      // Filter out inactive groups and handle bad data
      const validGroups = groups.filter(group => {
        return (
          group.active !== false &&
          group.coordinates && 
          typeof group.coordinates === 'object' &&
          'latitude' in group.coordinates &&
          'longitude' in group.coordinates &&
          !isNaN(Number(group.coordinates.latitude)) &&
          !isNaN(Number(group.coordinates.longitude))
        );
      });

      console.log("Adding", validGroups.length, "markers to map");
      console.log("Found", validGroups.length, "valid active groups out of", groups.length, "total groups");

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

        // Generate the info window content using our helper function
        const content = generateInfoWindowContent(group);

        // Add event listeners for markers
        if (marker) {
          // For legacy marker
          if (marker instanceof google.maps.Marker) {
            marker.addListener('click', () => {
              console.log('Legacy marker clicked for group:', group.id, group.university);
              
              // Flag that this was selected from the map
              selectedFromMapRef.current = true;
              
              // Also add the ID to our persistent set of markers selected via map clicks
              markerClickIdsRef.current.add(group.id);
              
              // First set the info window directly without triggering a full redraw
              infoWindow.close();
              
              // Generate the content
              const content = generateInfoWindowContent(group);
              infoWindow.setContent(content);
              
              // Open the info window
              infoWindow.open(map, marker);
              
              // DO NOT center the map or change zoom - just show the info window
              
              // Only call the onMarkerClick callback at the very end
              // This will update selectedGroupId in the parent component
              if (onMarkerClick) {
                // Add a small delay to prevent immediate re-renders
                setTimeout(() => {
                  onMarkerClick(group.id);
                }, 10);
              }
            });
          } else {
            // For advanced marker - use the standard 'click' event for AdvancedMarkerElement
            const position = { 
              lat: group.coordinates.latitude, 
              lng: group.coordinates.longitude 
            };
            
            marker.addListener('click', () => {
              console.log('Advanced marker clicked for group:', group.id, group.university);
              
              // Flag that this was selected from the map
              selectedFromMapRef.current = true;
              
              // Also add the ID to our persistent set of markers selected via map clicks
              markerClickIdsRef.current.add(group.id);
              
              // First set the info window directly without triggering a full redraw
              infoWindow.close();
              
              // Generate the content
              const content = generateInfoWindowContent(group);
              infoWindow.setContent(content);
              
              // Position and open the info window WITHOUT changing map center or zoom
              infoWindow.setPosition(position);
              infoWindow.open(map);
              
              // DO NOT center the map or change zoom - just show the info window
              
              // Add visual feedback - temporarily highlight the marker
              if (marker.content) {
                // Cast content to HTMLElement to use querySelector
                const content = marker.content as HTMLElement;
                const markerEl = content.querySelector('.pocket-marker') as HTMLElement;
                if (markerEl) {
                  // Save original transform
                  const originalTransform = markerEl.style.transform;
                  const originalShadow = markerEl.style.boxShadow;
                  
                  // Apply highlight effect
                  markerEl.style.transform = 'rotate(-45deg) scale(1.2)';
                  markerEl.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.8)';
                  
                  // Reset after animation
                  setTimeout(() => {
                    markerEl.style.transform = originalTransform;
                    markerEl.style.boxShadow = originalShadow;
                  }, 300);
                }
              }
              
              // Only call the onMarkerClick callback at the very end
              // This will update selectedGroupId in the parent component
              if (onMarkerClick) {
                // Add a small delay to prevent immediate re-renders
                setTimeout(() => {
                  onMarkerClick(group.id);
                }, 10);
              }
            });
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
        
        console.log('Initial positioning for selected group:', selectedGroup.university);
        
        // Center map once - don't need to do this again since we have the separate effect
        map.setCenter(centerPosition);
        map.setZoom(15);
        
        // The info window opening for selected markers is now handled in the selectedGroupId effect
        // This prevents duplicate info window opening and reduces render cycles
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
  }, [isMapReady, map, infoWindow, groups, selectedGroupId, centerLat, centerLng, zoom, supportsAdvancedMarkers, createAdvancedMarker, createLegacyMarker, initialZoomDone, generateInfoWindowContent, onMarkerClick]);

  // Update the separate effect for selectedGroupId to use the generateInfoWindowContent function
  useEffect(() => {
    // Skip if map or infoWindow is not ready yet
    if (!map || !infoWindow || !isMapReady) return;
    
    // Don't proceed if we're in the middle of updating markers
    if (isUpdatingMarkers.current) return;
    
    // Get the reference to the marker directly from our map
    const marker = selectedGroupId ? markersRef.current[selectedGroupId] : null;
    
    // Find the selected group
    const selectedGroup = selectedGroupId 
      ? groups.find(g => g.id === selectedGroupId) 
      : null;
    
    if (selectedGroup && marker) {
      console.log('Handling selected marker for:', selectedGroup.university, 'without full redraw');
      
      // Prepare position for info window
      const position = {
        lat: selectedGroup.coordinates.latitude,
        lng: selectedGroup.coordinates.longitude
      };
      
      // Only zoom and center if:
      // 1. NOT selected directly from the map (using both the flag and our persistent set)
      // 2. AND this is a different group than the last one we centered on
      const wasClickedOnMap = selectedFromMapRef.current || 
        (selectedGroupId ? markerClickIdsRef.current.has(selectedGroupId) : false);
      
      // Skip map updating completely if the user is currently typing
      // This prevents map operations from stealing focus from the search input
      if (window.isUserTyping === true) {
        console.log('Skipping map update completely - user is currently typing');
        return;
      }
      
      if (!wasClickedOnMap && selectedGroupId !== lastCenteredGroupIdRef.current) {
        console.log('Centering map - selection was NOT from map click and is a different group');
        // Center the map without forcing a full marker redraw
        map.setCenter(position);
        map.setZoom(15);
        
        // Update the last centered group ID
        lastCenteredGroupIdRef.current = selectedGroupId;
      } else {
        if (wasClickedOnMap) {
          console.log('Skipping map centering - selection was from map click');
        } else {
          console.log('Skipping map centering - same group ID as last centered');
        }
      }
      
      // Generate info window content using our helper function
      const content = generateInfoWindowContent(selectedGroup);
        
      // Open info window on the marker
      infoWindow.setContent(content);
      
      if (marker instanceof google.maps.Marker) {
        infoWindow.open(map, marker);
      } else {
        // For advanced marker
        infoWindow.setPosition(position);
        infoWindow.open(map);
      }
      
      // Reset the flag after handling this selection
      selectedFromMapRef.current = false;
    } else if (selectedGroupId) {
      console.warn('Selected group or marker not found for ID:', selectedGroupId);
    }
  }, [selectedGroupId, map, infoWindow, isMapReady, groups, generateInfoWindowContent]);

  // Configure the info window to look better
  useEffect(() => {
    if (infoWindow) {
      // Add custom styling to infoWindow if supported
      google.maps.event.addListener(infoWindow, 'domready', () => {
        try {
          // Find and style the InfoWindow elements
          const iwOuter = document.querySelector('.gm-style-iw-a') as HTMLElement;
          if (iwOuter) {
            // Add shadow and rounded corners
            iwOuter.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
            iwOuter.style.borderRadius = '8px';
            
            // Find close button and style it
            const closeButton = document.querySelector('.gm-ui-hover-effect') as HTMLElement;
            if (closeButton) {
              closeButton.style.opacity = '1';
              closeButton.style.right = '8px';
              closeButton.style.top = '8px';
              closeButton.style.borderRadius = '50%';
            }
          }
        } catch (e) {
          console.warn('Error styling info window:', e);
        }
      });
    }
  }, [infoWindow]);

  // Apply a skeleton loader style to mimic the map before it loads
  const skeletonStyle = {
    backgroundImage: `linear-gradient(90deg, #f0f0f0 0px, #f8f8f8 40px, #f0f0f0 80px)`,
    backgroundSize: '1000px 100%',
    animation: 'pulse 1.5s ease-in-out infinite, shimmer 2s infinite linear',
  };

  // Function to fit bounds to all markers
  const fitBoundsToMarkers = useCallback(() => {
    if (!map || !isMapReady || Object.keys(markersRef.current).length === 0) {
      console.log("Cannot fit bounds - map not ready or no markers");
      return;
    }

    try {
      console.log("Fitting bounds to show all markers");
      const bounds = new window.google.maps.LatLngBounds();
      
      // Add all marker positions to the bounds
      Object.values(markersRef.current).forEach(marker => {
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
      
      // Check if bounds are valid (not empty)
      if (bounds.isEmpty()) {
        console.warn("No valid marker positions to fit bounds");
        return;
      }
      
      // Apply bounds with padding
      map.fitBounds(bounds, 40);
      
      // Don't zoom in too far
      const zoomChangedListener = google.maps.event.addListener(map, 'idle', () => {
        const currentZoom = map.getZoom();
        if (currentZoom !== undefined && currentZoom > 15) {
          map.setZoom(15);
        }
        google.maps.event.removeListener(zoomChangedListener);
      });
      
      console.log("Map bounds fitted to markers");
    } catch (error) {
      console.error("Error fitting bounds to markers:", error);
    }
  }, [map, isMapReady]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    fitBoundsToMarkers,
    showGroupDetails: (groupId: string) => {
      // Find the group
      const group = groups.find(g => g.id === groupId);
      if (!group || !map) {
        console.log('Cannot show details: map not initialized or group not found');
        return;
      }
      
      // Find the marker for this group
      const marker = markersRef.current[groupId];
      if (!marker) {
        console.log('Cannot show details: marker not found for group', groupId);
        return;
      }
      
      // Skip if info window is not available
      if (!infoWindow) {
        console.log('Cannot show details: infoWindow is not initialized');
        return;
      }
      
      // Set flags to indicate this was NOT selected from the map
      selectedFromMapRef.current = false;
      lastCenteredGroupIdRef.current = groupId; // Prevent re-centering on future selectedGroupId updates
      
      // If this is called from the list, remove the ID from the set of map-clicked markers
      markerClickIdsRef.current.delete(groupId);
      
      // Close any open info windows first
      infoWindow.close();
      
      // Generate the info window content
      const content = generateInfoWindowContent(group);
      infoWindow.setContent(content);
      
      // Open the info window without changing map center or zoom
      if (marker instanceof google.maps.Marker) {
        infoWindow.open(map, marker);
      } else {
        // For advanced marker
        const position = {
          lat: group.coordinates.latitude,
          lng: group.coordinates.longitude
        };
        infoWindow.setPosition(position);
        infoWindow.open(map);
      }
      
      // Notify parent component about the marker click (without zooming)
      if (onMarkerClick) {
        onMarkerClick(groupId);
      }
      
      console.log(`Showing details for group ${groupId} without zooming`);
    },
    zoomToGroup: (groupId: string) => {
      // Find the group
      const group = groups.find(g => g.id === groupId);
      if (!group || !map) {
        console.log('Cannot zoom to group: map not initialized or group not found');
        return;
      }

      // Check that coordinates exist
      if (!group.coordinates || !group.coordinates.latitude || !group.coordinates.longitude) {
        console.log('Cannot zoom to group: invalid coordinates');
        return;
      }

      // Flag that this is a deliberate zoom action (not from map click)
      selectedFromMapRef.current = false;
      
      // Update the last centered group ID to prevent re-centering in the selectedGroupId effect
      lastCenteredGroupIdRef.current = groupId;
      
      // Remove from map-clicked markers since this was called from the list view
      markerClickIdsRef.current.delete(groupId);

      // Create position object
      const position = {
        lat: group.coordinates.latitude,
        lng: group.coordinates.longitude
      };

      // Animate zoom to position
      console.log(`Zooming to group ${groupId}: ${group.university}`);
      map.panTo(position);
      map.setZoom(15); // Set appropriate zoom level
    },
    clearMapClicks: () => {
      console.log('Clearing map clicked markers');
      markerClickIdsRef.current.clear();
    }
  }), [groups, map, infoWindow, markersRef, onMarkerClick, generateInfoWindowContent, fitBoundsToMarkers]);

  // Adjust return to ensure map container has proper dimensions
  return (
    <div className="relative w-full h-full">
      {/* Add global styles for InfoWindow */}
      <style jsx global>{`
        /* InfoWindow styling */
        .gm-style-iw {
          padding: 2px !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
        }

        .gm-style-iw-d {
          overflow: hidden !important;
          max-height: none !important;
        }

        .gm-ui-hover-effect {
          opacity: 0.8 !important;
          background: #ffffff !important;
          border-radius: 50% !important;
          width: 26px !important;
          height: 26px !important;
          top: 6px !important;
          right: 6px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }

        .gm-ui-hover-effect img {
          width: 16px !important;
          height: 16px !important;
          margin: 0 !important;
        }

        .gm-ui-hover-effect:hover {
          opacity: 1 !important;
        }
      `}</style>
      
      {/* Map container with fallback background color */}
      <div 
        ref={mapRef} 
        className="rounded-lg overflow-hidden w-full"
        style={{ 
          height: height || '500px',
          backgroundColor: '#e5e7eb', // Light gray fallback
          position: 'relative',
        }}
      ></div>
      
      {/* Error message overlay */}
      {loadError && (
        <div 
          className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4 z-50 rounded-lg"
        >
          <div className="text-red-600 font-semibold text-lg mb-3">
            {loadError}
            </div>
            <button 
              onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
            Reload Page
            </button>
        </div>
      )}
      
      {/* Loading indicator */}
      {!isMapReady && !loadError && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center z-40 rounded-lg">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-gray-700">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default Map; 