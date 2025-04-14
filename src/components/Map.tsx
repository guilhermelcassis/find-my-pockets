'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Group } from '../lib/interfaces';
import CustomInfoWindow from './CustomInfoWindow';

// Export interface to define the map ref methods
export interface MapRef {
  fitBoundsToMarkers: () => void;
  showGroupDetails: (groupId: string, permanent?: boolean) => void;
  zoomToGroup: (groupId: string, showPopup?: boolean) => void;
  clearMapClicks: () => void;
  getUserLocation: () => Promise<void>;
}

interface MapProps {
  groups: Group[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  selectedGroupId?: string | null;
  onMarkerClick?: (groupId: string) => void;
  enableClustering?: boolean;
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
  onMarkerClick,
  enableClustering = false
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
  // Let's add a ref that tracks the same value to avoid stale closures
  const initialZoomDoneRef = useRef(false);
  
  // Update the ref when state changes
  useEffect(() => {
    initialZoomDoneRef.current = initialZoomDone;
  }, [initialZoomDone]);
  
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

  // Add state for user location
  const [userLocation, setUserLocation] = useState<google.maps.Marker | google.maps.marker.AdvancedMarkerElement | null>(null);
  const [userLocationError, setUserLocationError] = useState<string | null>(null);

  // Removed showLegend state
  const [showClustering, setShowClustering] = useState<boolean>(false); // Changed from enableClustering to false directly

  // Add a flag to track if we've tried requesting location
  const [hasTriedLocationRequest, setHasTriedLocationRequest] = useState(false);

  // NEW: State for the selected group and info window
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(null);

  // Handle when a marker is clicked - declare this before it's used
  const handleMarkerClick = useCallback((group: Group) => {
    // Flag that this was selected from the map
    selectedFromMapRef.current = true;
    
    // Add the ID to our persistent set of markers selected via map clicks
    markerClickIdsRef.current.add(group.id);
    
    // Set selected group for InfoWindow
    setSelectedGroup(group);
    setSelectedPosition({
      lat: group.coordinates.latitude,
      lng: group.coordinates.longitude
    });
    
    // Call the marker click callback
    if (onMarkerClick) {
      setTimeout(() => {
        onMarkerClick(group.id);
      }, 10);
    }
  }, [onMarkerClick]);

  // Handle closing the InfoWindow
  const handleInfoWindowClose = useCallback(() => {
    setSelectedGroup(null);
    setSelectedPosition(null);
  }, []);

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
      initialZoomDoneRef.current = true; // Update the ref as well
      
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
      // Use darker purple with light orange border
      const markerColor = isSelected ? '#ff5864' : '#3d1870'; // Dark purple for regular markers
      const borderColor = isSelected ? '#ff5864' : '#ff8b4c'; // Light orange border (using the gradient end color)
      const borderWidth = isSelected ? '1px' : '1px';
      const shadowSize = isSelected ? '0 4px 8px rgba(255, 88, 100, 0.5)' : '0 2px 4px rgba(0, 0, 0, 0.2)';
      
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
          border: ${borderWidth} solid ${borderColor};
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
            background-color: rgba(255, 88, 100, 0.3);
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
        title: group.university,
        zIndex: isSelected ? 1000 : 100, // Put selected markers on top
        gmpClickable: true, // Explicitly make the marker clickable for accessibility
        gmpDraggable: false
      });

      // For accessibility, add tooltip
      if (marker.element) {
        marker.element.setAttribute('role', 'button');
        marker.element.setAttribute('aria-label', `${group.university} in ${group.city}`);
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
        title: group.university,
        cursor: 'pointer',
        zIndex: isSelected ? 1000 : 100, // Selected markers above others
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: isSelected ? '#ff5864' : '#3d1870', // Dark purple for regular markers
          fillOpacity: 1,
          strokeColor: isSelected ? '#ff5864' : '#ff8b4c', // Light orange border
          strokeWeight: isSelected ? 3 : 2,
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
    // Format meeting times for display
    const meetingSchedule = group.meetingTimes && group.meetingTimes.length > 0
      ? group.meetingTimes.map(meeting => {
          let meetingText = `${meeting.dayofweek} às ${meeting.time}`;
          if (meeting.local) {
            meetingText += ` <span class="meeting-local">(${meeting.local})</span>`;
          }
          return meetingText;
        }).join('<br>')
      : 'Horários não disponíveis';
    
    // Format the leader information
    const leaderInfo = group.leader?.name
      ? `${group.leader.name}${group.leader.curso ? ` <span class="leader-curso">(${group.leader.curso})</span>` : ''}`
      : 'Informações do líder não disponíveis';
    
    // Generate contact options
    let contactOptions = '';
    
    if (group.instagram) {
      const instagramUsername = group.instagram.startsWith('@') ? 
        group.instagram.substring(1) : 
        group.instagram;
        
      contactOptions += `
        <a href="https://instagram.com/${instagramUsername}" class="contact-button instagram-button" target="_blank" rel="noopener noreferrer">
          <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <span>Instagram</span>
        </a>
      `;
    }
    
    // Add Google Maps directions
    if (group.coordinates) {
      contactOptions += `
        <a href="https://www.google.com/maps/search/?api=1&query=${group.coordinates.latitude},${group.coordinates.longitude}" class="contact-button maps-button" target="_blank" rel="noopener noreferrer">
          <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Como Chegar</span>
        </a>
      `;
    }
    
    // Return the full HTML content with improved styling
    return `
      <div class="info-window">
        <style>
          .info-window {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: 0;
            width: 100%;
            max-width: 320px;
            color: #1f2937;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
          }
          
          .info-header {
            background: linear-gradient(135deg, #4299e1, #3182ce);
            padding: 16px 20px;
            position: relative;
            color: white;
          }
          
          .university-icon {
            width: 40px;
            height: 40px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }
          
          .university-icon svg {
            width: 24px;
            height: 24px;
            color: white;
          }
          
          .info-window h3 {
            margin: 0 0 6px 0;
            font-size: 18px;
            font-weight: 700;
            color: white;
            line-height: 1.3;
          }
          
          .info-content {
            padding: 16px;
            background: white;
          }
          
          .info-window .location {
            display: flex;
            align-items: center;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.95);
            font-weight: 500;
          }
          
          .info-window .location-icon {
            width: 14px;
            height: 14px;
            margin-right: 6px;
            color: white;
            flex-shrink: 0;
          }
          
          .info-window .address {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 4px;
            padding-left: 20px;
          }
          
          .info-section {
            padding-bottom: 16px;
            margin-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .info-section:last-child {
            padding-bottom: 0;
            margin-bottom: 0;
            border-bottom: none;
          }
          
          .info-label {
            font-weight: 600;
            font-size: 14px;
            color: #4b5563;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
          }
          
          .info-icon {
            width: 16px;
            height: 16px;
            margin-right: 8px;
            color: #3b82f6;
            flex-shrink: 0;
          }
          
          .meeting-info, .leader-info {
            font-size: 14px;
            color: #4b5563;
            padding-left: 24px;
            line-height: 1.5;
          }
          
          .leader-curso, .meeting-local {
            color: #6b7280;
            font-weight: normal;
          }
          
          .contact-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
          }
          
          .contact-button {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 12px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          
          .social-icon {
            width: 16px;
            height: 16px;
            margin-right: 8px;
          }
          
          .whatsapp-button {
            background-color: #25D366;
            color: white;
            border: none;
          }
          
          .instagram-button {
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            color: white;
            border: none;
          }
          
          .maps-button {
            background-color: #4285F4;
            color: white;
            border: none;
          }
        </style>
        
        <div class="info-header">
          <div class="university-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          
          <h3>${group.university}</h3>
          <div class="location">
            <svg class="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${group.city}, ${group.state}
          </div>
          
          ${group.fulladdress ? `<div class="address">${group.fulladdress}</div>` : ''}
        </div>
        
        <div class="info-content">
          <div class="info-section">
            <div class="info-label">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Horários de Encontro
            </div>
            <div class="meeting-info">${meetingSchedule}</div>
          </div>
          
          <div class="info-section">
            <div class="info-label">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Líder
            </div>
            <div class="leader-info">${leaderInfo}</div>
            
            <div class="contact-options">
              ${contactOptions}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Update the effect that adds the markers to use the generateInfoWindowContent
  useEffect(() => {
    // Only run when map is available and in ready state
    if (!isMapReady || !map) {
      return;
    }

    // Skip if we're currently updating markers to prevent race conditions
    if (isUpdatingMarkers.current) return;
    
    // Check if groups array has the same ids as before - if so, don't redraw markers
    const currentGroupIds = groups.map(g => g.id).sort().join(',');
    
    // If nothing has changed, only selectedGroupId, don't redraw all markers
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

      // Clear selected group state when rebuilding markers
      if (selectedGroup === null || !validGroups.some(g => g.id === selectedGroup.id)) {
        setSelectedGroup(null);
        setSelectedPosition(null);
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

        // Add event listeners for markers
        if (marker) {
          // For legacy marker
          if (marker instanceof google.maps.Marker) {
            marker.addListener('click', () => {
              console.log('Legacy marker clicked for group:', group.id, group.university);
              handleMarkerClick(group);
            });
          } else {
            // For advanced marker
            marker.addListener('click', () => {
              console.log('Advanced marker clicked for group:', group.id, group.university);
              
              // Find the marker element to add a visual effect
              const marker = markersRef.current[group.id];
              if (marker) {
                // Check if this is an AdvancedMarkerElement with content property
                if ('content' in marker && marker.content) {
                  // Apply a subtle highlight effect
                  const content = marker.content as HTMLElement;
                  const markerEl = content.querySelector('.pocket-marker') as HTMLElement;
                  if (markerEl) {
                    // Apply a subtle pulse effect
                    markerEl.style.transform = 'rotate(-45deg) scale(1.2)';
                    markerEl.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.8)';
                    
                    // Return to normal after a short animation
                    setTimeout(() => {
                      markerEl.style.transform = 'rotate(-45deg) scale(1)';
                      markerEl.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                    }, 300);
                  }
                } else if (marker instanceof google.maps.Marker) {
                  // For legacy markers, use a different animation
                  marker.setAnimation(google.maps.Animation.BOUNCE);
                  
                  // Stop the animation after a short time
                  setTimeout(() => {
                    marker.setAnimation(null);
                  }, 300);
                }
              }
              
              handleMarkerClick(group);
            });
          }
        }
      });

      // Update state with new markers
      setMarkers(newMarkersArray);
      markersRef.current = newMarkersMap;

      // Update immediate centering for selected group
      if (selectedGroupId && map) {
        const selectedGroup = validGroups.find(g => g.id === selectedGroupId);
        if (selectedGroup) {
          const centerPosition = {
            lat: selectedGroup.coordinates.latitude,
            lng: selectedGroup.coordinates.longitude
          };
          
          console.log('Initial positioning for selected group:', selectedGroup.university);
          
          // Center map once
          map.setCenter(centerPosition);
          map.setZoom(15);
        }
      } else if (newMarkersArray.length > 0 && !initialZoomDoneRef.current) {
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
          
          // Ensure we have at least two markers or the bounds are valid
          if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            // If there's only one marker, zoom in appropriately
            map.setZoom(13);
          } else {
            // Fit to all markers
            console.log('Setting initial bounds to fit all markers');
            map.fitBounds(bounds);
          }
          
          // Mark initial zoom as done
          setInitialZoomDone(true);
          initialZoomDoneRef.current = true; // Update the ref immediately
        } catch (e) {
          console.warn('Error setting bounds:', e);
        }
      }
    } catch (error) {
      console.error('Error creating markers:', error);
    } finally {
      // Reset the updating flag
      isUpdatingMarkers.current = false;
    }
  }, [map, groups, selectedGroupId, markers, isMapReady, supportsAdvancedMarkers, handleMarkerClick, selectedGroup]);

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
            iwOuter.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.12)';
            iwOuter.style.borderRadius = '12px';
            
            // Find close button and style it
            const closeButton = document.querySelector('.gm-ui-hover-effect') as HTMLElement;
            if (closeButton) {
              closeButton.style.opacity = '0.6';
              closeButton.style.right = '6px';
              closeButton.style.top = '6px';
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

  // Update getUserLocation to not use the removed state variables
  const getUserLocation = useCallback(async () => {
    if (!map || !isMapReady) {
      console.log('Map not ready, cannot get user location');
      return;
    }

    try {
      console.log('----- GETTING USER LOCATION - CLEARING ALL UNIVERSITY SELECTIONS -----');

      // 1. AGGRESSIVELY CLEAR ALL REFERENCES TO SELECTED UNIVERSITIES
      
      // Close any open info windows immediately
      if (infoWindow) {
        infoWindow.close();
      }
      
      // Clear the map-clicked markers set
      markerClickIdsRef.current.clear();
      
      // Clear the last centered group ID
      lastCenteredGroupIdRef.current = null;
      
      // Reset the selected from map flag
      selectedFromMapRef.current = false;
      
      // Tell the parent component to clear its selected group ID IMMEDIATELY
      // This is crucial to prevent the parent from restoring the selected university
      if (onMarkerClick) {
        console.log("Clearing selected university in parent component");
        onMarkerClick(null as any);
      }
      
      // 2. CLEAR ANY EXISTING USER LOCATION MARKER
      
      // Remove any existing user location marker
      if (userLocation) {
        if (userLocation instanceof google.maps.Marker) {
          userLocation.setMap(null);
        } else {
          userLocation.map = null;
        }
        setUserLocation(null);
      }

      // 3. UPDATE UI STATE
      
      // Reset error state
      setUserLocationError(null);
      
      // Show "Requesting location..." message
      setUserLocationError("Solicitando acesso à localização...");
      
      // Mark that we've tried requesting location
      setHasTriedLocationRequest(true);
      
      console.log("Requesting user location...");
      
      // 4. GET USER LOCATION (direct synchronous call to maintain user gesture)
      navigator.geolocation.getCurrentPosition(
        // Success handler
        (position) => {
          console.log("Location permission granted, position received", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          
          // Clear the requesting message
          setUserLocationError(null);
          
          const userPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // CRITICAL: IMMEDIATELY center map on user location before any other operations
          map.setCenter(userPosition);
          map.setZoom(15);
          
          // Create user location marker
          let userMarker: google.maps.Marker | google.maps.marker.AdvancedMarkerElement | null = null;
          
          if (supportsAdvancedMarkers && window.google.maps.marker?.AdvancedMarkerElement) {
            // Create advanced marker for user location - make it more visible and distinctive
            const container = document.createElement('div');
            container.className = 'user-location-marker';
            container.innerHTML = `
              <div style="
                position: relative;
                width: 42px;
                height: 42px;
                z-index: 1001;
              ">
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 42px;
                  height: 42px;
                  background-color: rgba(30, 144, 255, 0.3);
                  border-radius: 50%;
                  animation: pulse 2s infinite;
                "></div>
                <div style="
                  position: absolute;
                  top: 11px;
                  left: 11px;
                  width: 20px;
                  height: 20px;
                  background-color: #1E90FF;
                  border: 3px solid white;
                  border-radius: 50%;
                  z-index: 1002;
                  box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
                "></div>
              </div>
              <style>
                @keyframes pulse {
                  0% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(2.5); opacity: 0.4; }
                  100% { transform: scale(1); opacity: 1; }
                }
              </style>
            `;
            
            userMarker = new window.google.maps.marker.AdvancedMarkerElement({
              position: userPosition,
              map,
              content: container,
              title: "Sua Localização Atual",
              zIndex: 9999 // Very high z-index to ensure it's above everything else
            });
          } else {
            // Fallback to legacy marker - also make it more distinctive
            userMarker = new window.google.maps.Marker({
              position: userPosition,
              map,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#1E90FF',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 3,
                scale: 12
              },
              title: "Sua Localização Atual",
              zIndex: 9999
            });
            
            // Add a circle for the accuracy radius
            new window.google.maps.Circle({
              map,
              center: userPosition,
              radius: position.coords.accuracy,
              fillColor: '#1E90FF',
              fillOpacity: 0.15,
              strokeColor: '#1E90FF',
              strokeOpacity: 0.3,
              strokeWeight: 1,
              zIndex: 9998
            });
          }
          
          setUserLocation(userMarker);
          
          // 5. APPLY MULTIPLE SAFEGUARDS TO PREVENT MAP FROM RETURNING TO UNIVERSITY
          
          // Clear any queued operations by using setTimeout with 0 delay
          setTimeout(() => {
            // CRITICAL SAFEGUARD: Check if any university was selected in the parent
            if (onMarkerClick) {
              onMarkerClick(null as any);
            }
            
            // Re-clear all the internal state that might keep track of universities
            markerClickIdsRef.current.clear();
            lastCenteredGroupIdRef.current = null;
            selectedFromMapRef.current = false;
          }, 0);
          
          // First recenter after a small delay
          setTimeout(() => {
            console.log("First recenter safeguard");
            map.setCenter(userPosition);
            
            // Close any info windows that might have re-opened
            if (infoWindow) {
              infoWindow.close();
            }
          }, 100);
          
          // Second recenter with a longer delay (in case any other operations tried to change the center)
          setTimeout(() => {
            console.log("Second recenter safeguard");
            map.setCenter(userPosition);
            
            // Extra check to ensure no university is selected in parent
            if (onMarkerClick) {
              onMarkerClick(null as any);
            }
          }, 500);
          
          // Final center check with even longer delay
          setTimeout(() => {
            console.log("Final position check");
            const currentCenter = map.getCenter();
            if (currentCenter) {
              const centerLat = currentCenter.lat();
              const centerLng = currentCenter.lng();
              
              // If the map has moved away from user position, force it back
              const distance = getDistanceInMeters(
                centerLat, centerLng, 
                userPosition.lat, userPosition.lng
              );
              
              if (distance > 100) { // If map has moved more than 100 meters from user position
                console.log("Map moved away from user location, forcing back", {
                  current: { lat: centerLat, lng: centerLng },
                  user: userPosition,
                  distance
                });
                map.setCenter(userPosition);
              }
            }
          }, 1000);
          
          console.log("Map is now centered on user's exact location");
        },
        // Error handler
        (error) => {
          console.error("Geolocation error:", error);
          
          // Clear the requesting message
          setUserLocationError(null);
          
          if (error.code === error.PERMISSION_DENIED) {
            console.log("User denied geolocation permission");
            
            // Check if this is likely a permanent block
            const isChrome = navigator.userAgent.indexOf("Chrome") > -1;
            
            if (isChrome) {
              // Show helpful message for Chrome users
              setUserLocationError(
                "Permissão de localização bloqueada. Para ativar, clique no ícone do cadeado na barra de endereço do navegador, depois em 'Configurações do site' e mude a permissão de localização para 'Permitir'."
              );
            } else {
              // Generic message for other browsers
              setUserLocationError(
                "Acesso à localização negado. Por favor, permita o acesso à sua localização nas configurações do navegador."
              );
            }
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setUserLocationError("Informações de localização indisponíveis. Verifique as configurações do seu dispositivo.");
          } else if (error.code === error.TIMEOUT) {
            setUserLocationError("Tempo de solicitação esgotado. Tente novamente.");
          } else {
            setUserLocationError("Ocorreu um erro ao obter a localização.");
          }
        },
        // Options
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
      
    } catch (error) {
      console.error("Error in getUserLocation:", error);
      
      // Show a generic error message
      setUserLocationError("Ocorreu um erro ao tentar acessar sua localização.");
    }
  }, [map, isMapReady, userLocation, supportsAdvancedMarkers, infoWindow, onMarkerClick]);

  // Helper function to calculate distance between two coordinates in meters
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    fitBoundsToMarkers,
    showGroupDetails: (groupId: string, permanent?: boolean) => {
      // Find the group
      const group = groups.find(g => g.id === groupId);
      if (!group || !map) {
        console.log('Cannot show group details: map not initialized or group not found');
        return;
      }

      // Check that coordinates exist
      if (!group.coordinates || !group.coordinates.latitude || !group.coordinates.longitude) {
        console.log('Cannot show group details: invalid coordinates');
        return;
      }

      // Check if we're already showing the same group
      const isSameGroup = selectedGroup && selectedGroup.id === groupId;
      if (isSameGroup) {
        console.log('Already showing details for this group, just ensuring visibility');
        return;
      }

      // Check if we're zooming to a group in the same location as the currently selected group
      const isSameLocation = selectedGroup && 
        selectedGroup.university === group.university && 
        Math.abs(selectedGroup.coordinates.latitude - group.coordinates.latitude) < 0.0001 &&
        Math.abs(selectedGroup.coordinates.longitude - group.coordinates.longitude) < 0.0001;

      // Special handling for smooth transitions between markers at the same university
      if (isSameLocation) {
        console.log('Smooth transition between groups at the same location');
        
        // Create new position object (even though it's the same coordinates)
        const position = {
          lat: group.coordinates.latitude,
          lng: group.coordinates.longitude
        };

        // Find the marker element to add a visual indication
        const marker = markersRef.current[groupId];
        if (marker) {
          // Check if this is an AdvancedMarkerElement with content property
          if ('content' in marker && marker.content) {
            // Apply a subtle highlight effect
            const content = marker.content as HTMLElement;
            const markerEl = content.querySelector('.pocket-marker') as HTMLElement;
            if (markerEl) {
              // Apply a more subtle pulse animation for markers at same university
              markerEl.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
              markerEl.style.transform = 'rotate(-45deg) scale(1.15)';
              markerEl.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.7)';
              markerEl.style.borderColor = '#3b82f6';
              
              // Return to normal after animation completes
              setTimeout(() => {
                markerEl.style.transform = 'rotate(-45deg) scale(1)';
                markerEl.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                markerEl.style.borderColor = '#1e40af';
              }, 450);
            }
          }
        }

        // Pre-calculate a smoother transition duration based on group content similarity
        const transitionDuration = 250; // ms

        // Clear any existing info window first if needed
        if (selectedGroup) {
          // Don't fully hide the previous info window to avoid flickering
          // Just prepare for the transition to the new content
          console.log(`Preparing transition from ${selectedGroup.id} to ${group.id}`);
        }

        // Update internal state after a tiny delay to allow for proper transition sequencing
        setTimeout(() => {
          setSelectedGroup(group);
          // Keep current map view position to avoid any jittering
        }, 10);
        
        // Show the info window after a slight delay for smoother transition
        setTimeout(() => {
          // Close any existing info window first to prevent stacking
          if (infoWindow) {
            infoWindow.close();
          }
          
          // Position info window slightly above marker for better visibility
          const windowPosition = {
            lat: position.lat,
            lng: position.lng
          };
          
          // Create a new info window with updated content using CustomInfoWindow
          if (map) {
            // Set the selected group and position states, which will trigger
            // CustomInfoWindow creation via useEffect in the component
            setSelectedGroup(group);
            setSelectedPosition(windowPosition);
            
            // Highlight the selected marker
            // Note: We're accessing the marker directly rather than using a separate function
            if (marker) {
              // Clear previous active marker state if any
              Object.values(markersRef.current).forEach(m => {
                if ('content' in m && m.content) {
                  const content = m.content as HTMLElement;
                  const markerElement = content.querySelector('.pocket-marker') as HTMLElement;
                  if (markerElement) {
                    markerElement.classList.remove('active');
                  }
                }
              });
              
              // Set current marker as active
              if ('content' in marker && marker.content) {
                const content = marker.content as HTMLElement;
                const markerElement = content.querySelector('.pocket-marker') as HTMLElement;
                if (markerElement) {
                  markerElement.classList.add('active');
                }
              }
            }
          }
          
          // Add to permanent markers if needed
          if (permanent) {
            // Add to the list of permanently shown markers
            markerClickIdsRef.current.add(group.id);
          }
        }, 50);

        return;
      } else {
        // Standard handling for different locations
        // Set the flag to indicate this marker was selected from the map
        selectedFromMapRef.current = true;
        
        // Add this group ID to the markers that have been clicked on the map
        markerClickIdsRef.current.add(groupId);
        
        // Update the selected group state to show info window
        setSelectedGroup(group);
        setSelectedPosition({
          lat: group.coordinates.latitude,
          lng: group.coordinates.longitude
        });
      }
      
      // If permanent flag is set, mark this marker for persistent display
      if (permanent) {
        // Add to a persistent display set or take other action to ensure display persists
        console.log(`Marking group ${groupId} for permanent display`);
        // This is handled by not closing the info window automatically
      }
      
      // Notify parent component about the marker click (without zooming)
      if (onMarkerClick) {
        onMarkerClick(groupId);
      }
      
      console.log(`Showing details for group ${groupId} without zooming`);
    },
    zoomToGroup: (groupId: string, showPopup?: boolean) => {
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

      // Check if we're zooming to a group in the same location as the currently selected group
      const isSameLocation = selectedGroup && 
        selectedGroup.university === group.university && 
        Math.abs(selectedGroup.coordinates.latitude - group.coordinates.latitude) < 0.0001 &&
        Math.abs(selectedGroup.coordinates.longitude - group.coordinates.longitude) < 0.0001;
      
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

      // Use different animation based on whether we're at the same location
      if (isSameLocation) {
        console.log(`Gentle pan to group ${groupId} at same location: ${group.university}`);
        
        // Use a gentle pan with smooth animation
        map.panTo(position);
        
        // No need to change zoom as we're already at the right level
        
        // Apply a subtle highlight to the marker
        const marker = markersRef.current[groupId];
        if (marker) {
          if ('content' in marker && marker.content) {
            // For advanced markers
            const content = marker.content as HTMLElement;
            const markerEl = content.querySelector('.pocket-marker') as HTMLElement;
            if (markerEl) {
              // Subtle scale effect
              markerEl.style.transform = 'rotate(-45deg) scale(1.1)';
              setTimeout(() => {
                markerEl.style.transform = 'rotate(-45deg)';
              }, 300);
            }
          } else if (marker instanceof google.maps.Marker) {
            // For legacy markers
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => {
              marker.setAnimation(null);
            }, 700);
          }
        }
      } else {
        // Regular zoom for different locations
        console.log(`Zooming to group ${groupId}: ${group.university}`);
        map.panTo(position);
        map.setZoom(15); // Set appropriate zoom level
      }
      
      // Only show popup if explicitly requested (to prevent flicker)
      if (showPopup) {
        setSelectedGroup(group);
        setSelectedPosition(position);
      }
    },
    clearMapClicks: () => {
      console.log('Clearing map clicked markers');
      markerClickIdsRef.current.clear();
    },
    getUserLocation
  }), [groups, map, infoWindow, markersRef, onMarkerClick, generateInfoWindowContent, fitBoundsToMarkers, getUserLocation]);

  // Adjust return to ensure map container has proper dimensions and add permissions modal
  return (
    <div className="relative w-full h-full">
      {/* Add global styles for InfoWindow */}
      <style jsx global>{`
        /* InfoWindow styling */
        .gm-style-iw {
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
          overflow: visible !important;
        }

        .gm-style-iw-d {
          overflow: hidden !important;
          max-height: none !important;
          padding: 0 !important;
        }

        .gm-style-iw-c {
          padding: 0 !important;
          border-radius: 12px !important;
        }

        .gm-ui-hover-effect {
          opacity: 0.6 !important;
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
          transition: opacity 0.2s ease !important;
        }

        .gm-ui-hover-effect img {
          width: 16px !important;
          height: 16px !important;
          margin: 0 !important;
        }

        .gm-ui-hover-effect:hover {
          opacity: 1 !important;
        }

        /* User location marker pulse animation */
        @keyframes user-location-pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.4;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .user-location-marker-pulse {
          animation: user-location-pulse 2s infinite;
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
      
      {/* Render the CustomInfoWindow when a group is selected */}
      {map && selectedGroup && selectedPosition && (
        <CustomInfoWindow
          key={selectedGroup.id} // Add a key to force re-render when the group changes
          group={selectedGroup}
          map={map}
          position={selectedPosition}
          onClose={handleInfoWindowClose}
          allGroups={groups} // Pass all groups to the CustomInfoWindow
        />
      )}
      
      {/* User location error message with improved visibility for permission errors */}
      {userLocationError && (
        <div className="absolute bottom-4 left-4 right-4 bg-white border-2 border-blue-300 text-gray-800 p-4 rounded-lg shadow-md flex justify-between items-center">
          <div className="flex-grow">
            <p className="font-medium">Acesso à localização</p>
            <p className="mt-1">{userLocationError}</p>
            {userLocationError.includes("bloqueada") && (
              <div className="mt-2 flex space-x-2">
                <img 
                  src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0QjVERkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjJzLTgtNC44LTgtMTJhOCA4IDAgMCAxIDgtOCA4IDggMCAwIDEgOCA4YzAgNy4yLTggMTItOCAxMnoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIj48L2NpcmNsZT48L3N2Zz4="
                  alt="Location icon"
                  className="w-6 h-6"
                />
                <p className="text-xs text-gray-600">Procure pelo ícone do cadeado na barra de endereço</p>
              </div>
            )}
          </div>
          <button
            className="text-gray-600 hover:text-gray-800 ml-2 p-1 rounded"
            onClick={() => setUserLocationError(null)}
            aria-label="Fechar mensagem de erro"
          >
            ×
          </button>
        </div>
      )}
      
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