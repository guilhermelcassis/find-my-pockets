'use client';

import { useEffect, useRef, useState } from 'react';

interface TestMapProps {
  height?: string;
}

declare global {
  interface Window {
    initTestMap: () => void;
  }
}

const TestMap = ({ height = '500px' }: TestMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    // Skip if the map is already loaded
    if (isLoaded || window.google?.maps) {
      console.log('Map already loaded, initializing...');
      initializeMap();
      return;
    }
    
    // Define the callback function
    window.initTestMap = () => {
      console.log('Google Maps API loaded via callback');
      initializeMap();
    };
    
    // Function to initialize the map
    function initializeMap() {
      try {
        if (!mapRef.current) {
          setError('Map container not found');
          return;
        }
        
        // Log dimensions for debugging
        const rect = mapRef.current.getBoundingClientRect();
        console.log('Test map container dimensions:', {
          width: rect.width,
          height: rect.height,
          offsetWidth: mapRef.current.offsetWidth,
          offsetHeight: mapRef.current.offsetHeight,
        });
        
        // Check if the API is loaded
        if (!window.google?.maps?.Map) {
          return;
        }
        
        console.log('Initializing test map...');
        
        // Create a basic map instance
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: -23.5505, lng: -46.6333 }, // São Paulo
          zoom: 10,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '8f077ee2408e83c5',
        });
        
        // Add a marker to test marker functionality
        if (window.google.maps.Marker) {
          const marker = new window.google.maps.Marker({
            position: { lat: -23.5505, lng: -46.6333 },
            map: map,
            title: 'Test Marker'
          });
          
          // Add a click listener
          marker.addListener('click', () => {
            console.log('Marker clicked!');
            
            // Create and open an info window
            if (window.google.maps.InfoWindow) {
              const infoWindow = new window.google.maps.InfoWindow({
                content: '<div style="padding: 10px;"><h3>Test Marker</h3><p>This is a test info window</p></div>'
              });
              
              infoWindow.open(map, marker);
            }
          });
        }
        
        setIsLoaded(true);
        console.log('Test map initialized successfully');
      } catch (err) {
        console.error('Error initializing test map:', err);
        setError('Failed to initialize map: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
    
    // Load the Maps API script
    try {
      console.log('Loading Google Maps API for test map...');
      
      const existingScript = document.getElementById('google-maps-test-script');
      if (existingScript) {
        console.log('Google Maps script already exists');
        return;
      }
      
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key not found');
        return;
      }
      
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '8f077ee2408e83c5';
      
      const script = document.createElement('script');
      script.id = 'google-maps-test-script';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initTestMap&libraries=marker&v=beta&mapIds=${mapId}`;
      
      script.onerror = () => {
        setError('Failed to load Google Maps script');
      };
      
      document.head.appendChild(script);
      console.log('Added Google Maps script to document for test map');
    } catch (err) {
      console.error('Error setting up Google Maps script:', err);
      setError('Error setting up Google Maps: ' + (err instanceof Error ? err.message : String(err)));
    }
    
    // Cleanup function
    return () => {
      window.initTestMap = () => {
        console.log('Ignoring callback after component unmounted');
      };
    };
  }, [isLoaded]);
  
  return (
    <div className="relative">
      {/* Map container with fallback styling */}
      <div
        ref={mapRef}
        className="rounded-lg overflow-hidden"
        style={{
          height: height,
          width: '100%',
          backgroundColor: '#e5e7eb', // Light gray fallback
        }}
      ></div>
      
      {/* Error message */}
      {error && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload
          </button>
        </div>
      )}
      
      {/* Loading indicator */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMap; 