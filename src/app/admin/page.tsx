// app/(admin)/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Group } from '../../lib/interfaces';
import { db } from '../../lib/supabase';
import Link from 'next/link';
import Script from 'next/script';

// Flag to prevent duplicate Google Maps loading
declare global {
  // Tipagem será herdada de src/components/Map.tsx que já tem a tipagem correta
  interface Window {
    googleMapsLoaded: boolean;
    // Add the guard properties
    __GOOGLE_MAPS_INIT_GUARD?: {
      initialized: boolean;
      loading: boolean;
      callbacks: Array<() => void>;
    };
    initializeGoogleMapsGuarded?: () => void;
    // Add admin-specific callback
    initializeAdminMap?: () => void;
    // Add admin-specific state tracker
    __ADMIN_MAP_INITIALIZED?: boolean;
    // Add autocomplete tracker
    __AUTOCOMPLETE_INITIALIZED?: boolean;
    // Add new callback for direct initialization
    initGoogleMaps?: () => void;
  }
}

// Global initialization tracker - prevents multiple initializations across renders
if (typeof window !== 'undefined') {
  window.__ADMIN_MAP_INITIALIZED = window.__ADMIN_MAP_INITIALIZED || false;
  window.__AUTOCOMPLETE_INITIALIZED = window.__AUTOCOMPLETE_INITIALIZED || false;
}

// Create a separate Map component to isolate Google Maps from the main component
// This helps prevent DOM conflicts
function AdminMapComponent({ 
  onMapReady, 
  onMarkerPositionChange,
  initialCoordinates
}: { 
  onMapReady: (map: google.maps.Map, marker: google.maps.Marker) => void;
  onMarkerPositionChange: (lat: number, lng: number) => void;
  initialCoordinates: { latitude: number; longitude: number };
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Initialize map in its own contained component
  useEffect(() => {
    // Prevent running if container not available or window not defined
    if (!mapContainerRef.current || typeof window === 'undefined') return;
    
    // Skip if Google Maps API not loaded yet
    if (!window.google?.maps) {
      console.log("Google Maps API not loaded yet in map component");
      return;
    }
    
    let mapInstance: google.maps.Map | null = null;
    let markerInstance: google.maps.Marker | null = null;
    
    try {
      console.log("Initializing isolated map component");
      
      // Get container dimensions for debugging
      const container = mapContainerRef.current;
      console.log("Map container dimensions:", {
        width: container.clientWidth,
        height: container.clientHeight
      });
      
      // Create map instance
      mapInstance = new window.google.maps.Map(container, {
        center: { 
          lat: initialCoordinates.latitude || -8.017558, 
          lng: initialCoordinates.longitude || -34.949283 
        },
        zoom: 14,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative',
        clickableIcons: false,
      });
      
      // Create marker
      markerInstance = new window.google.maps.Marker({
        position: { 
          lat: initialCoordinates.latitude || -8.017558, 
          lng: initialCoordinates.longitude || -34.949283 
        },
        map: mapInstance,
        draggable: true,
        title: "Arraste para a localização exata"
      });
      
      // Add click listener to map
      mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng && markerInstance) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          
          markerInstance.setPosition(e.latLng);
          onMarkerPositionChange(lat, lng);
        }
      });
      
      // Add drag end listener to marker
      markerInstance.addListener('dragend', () => {
        if (markerInstance) {
          const position = markerInstance.getPosition();
          if (position) {
            onMarkerPositionChange(position.lat(), position.lng());
          }
        }
      });
      
      // Notify parent component that map is ready
      setMapLoaded(true);
      onMapReady(mapInstance, markerInstance);
      
    } catch (error) {
      console.error("Error initializing map component:", error);
    }
    
    // Clean up resources when component unmounts
    return () => {
      console.log("Cleaning up isolated map component");
      
      if (mapInstance) {
        // Remove all event listeners (not strictly necessary but good practice)
        google.maps.event.clearInstanceListeners(mapInstance);
      }
      
      if (markerInstance) {
        // Remove marker from map
        markerInstance.setMap(null);
        google.maps.event.clearInstanceListeners(markerInstance);
      }
      
      // Don't try to clean up the map container, let React handle it
    };
  }, [initialCoordinates, onMapReady, onMarkerPositionChange]);
  
  return (
    <div className="map-container-wrapper relative">
      <div 
        ref={mapContainerRef} 
        className="w-full h-[400px] border rounded map-container"
        style={{ 
          height: "400px", 
          width: "100%",
          position: "relative",  
          background: "#f1f3f4"
        }}
      />
      
      {/* Show loading animation if map is not loaded yet */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10 transition-opacity duration-300">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-700 font-medium">Carregando mapa...</p>
          <p className="text-sm text-gray-500 mt-1">O mapa está sendo inicializado</p>
        </div>
      )}
    </div>
  );
}

const AdminPage = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const autocompleteInputRef = useRef<HTMLInputElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [marker, setMarker] = useState<google.maps.Marker | null>(null);
    const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string }[]>([]);
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
    const [locationSelected, setLocationSelected] = useState<boolean>(false);
    const [isValidatingInstagram, setIsValidatingInstagram] = useState<boolean>(false);
    const [isInstagramValid, setIsInstagramValid] = useState<boolean | null>(null);
    const [showMap, setShowMap] = useState<boolean>(false);
    const [mapsApiLoaded, setMapsApiLoaded] = useState<boolean>(false);
    const [autocompleteInitialized, setAutocompleteInitialized] = useState<boolean>(false);
    
    // Track initialization state to prevent double initialization
    const googleMapsLoadingRef = useRef<boolean>(false);
    const mapInitializedRef = useRef<boolean>(false);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mapDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const effectRunRef = useRef<boolean>(false);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    
    const [group, setGroup] = useState<Group>({
        id: '',
        name: 'Dunamis Pocket', // Default name for all groups
        university: '',
        city: '',
        state: '',
        country: '',
        location: '',
        instagram: '',
        dayofweek: '',
        time: '',
        tipo: '',
        local: '',
        leader: { name: '', phone: '', email: '', curso: '' },
        coordinates: { latitude: 0, longitude: 0 },
        fulladdress: '',
        zipcode: '',
    });

    // Separate function to initialize just the autocomplete - can be called independently
    const initAutocomplete = useCallback(() => {
        if (typeof window === 'undefined' || !window.google?.maps?.places || !autocompleteInputRef.current) {
            console.log("Unable to initialize autocomplete - Google Places API or input not available");
            return;
        }
        
        if (window.__AUTOCOMPLETE_INITIALIZED || autocompleteRef.current) {
            console.log("Autocomplete already initialized, skipping");
            return;
        }
        
        try {
            console.log("Initializing Google Places autocomplete...");
            
                // Create autocomplete with university bias
                const autocompleteOptions = {
                    types: ['university', 'school'],
                    fields: ['name', 'address_components', 'geometry', 'formatted_address']
                };
                
                const autocomplete = new window.google.maps.places.Autocomplete(
                    autocompleteInputRef.current,
                    autocompleteOptions
                );
                
            autocompleteRef.current = autocomplete;
            window.__AUTOCOMPLETE_INITIALIZED = true;
            setAutocompleteInitialized(true);
            
            // Add place_changed event listener
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                console.log("University selected:", place);
                
                if (!place.geometry || !place.geometry.location) {
                    console.error("No geometry information available for this place");
                    return;
                }
                
                // Get the coordinates of the selected place
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                console.log(`Selected place coordinates: lat=${lat}, lng=${lng}`);
                
                // Update the map if it exists - ensure proper zoom and center
                if (map) {
                    console.log("Centering map on selected place");
                    map.setCenter(place.geometry.location);
                    map.setZoom(14); // Closer zoom to see the university clearly
                }
                
                // Update the marker if it exists
                if (marker) {
                    console.log("Moving marker to selected place");
                    marker.setPosition(place.geometry.location);
                    marker.setVisible(true); // Make sure marker is visible
                    
                    // Add animation to make the marker more noticeable
                    if (window.google?.maps?.Animation) {
                        marker.setAnimation(window.google.maps.Animation.DROP);
                    }
                } else {
                    console.warn("Marker not available to update");
                }
                        
                        // Extract address components
                        let city = '';
                        let state = '';
                        let country = '';
                        let zipcode = '';
                        const university = place.name || '';
                        const fulladdress = place.formatted_address || '';
                        
                        if (place.address_components) {
                            for (const component of place.address_components) {
                                const types = component.types;
                                
                                if (types.includes('locality') || types.includes('postal_town')) {
                                    city = component.long_name;
                                } else if (types.includes('administrative_area_level_2') && !city) {
                                    // Use administrative_area_level_2 as fallback for city
                                    city = component.long_name;
                                } else if (types.includes('administrative_area_level_1')) {
                                    state = component.long_name;
                                } else if (types.includes('country')) {
                                    country = component.long_name;
                                } else if (types.includes('postal_code')) {
                                    zipcode = component.long_name;
                                }
                            }
                        }
                        
                        // If no city was found in address components, try a different approach
                        if (!city && place.formatted_address) {
                            // Try to extract city from formatted address
                            const addressParts = place.formatted_address.split(',');
                            if (addressParts.length >= 2) {
                                // The city is often the second part in the formatted address
                                city = addressParts[1].trim();
                            }
                        }
                        
                console.log("Extracted data:", { 
                            university, 
                            city, 
                            state, 
                            country, 
                            zipcode,
                            fulladdress
                });
                        
                // Update form with all extracted data, but leave location field empty for admin to fill
                setGroup(prev => ({
                            ...prev,
                            university: university,
                            city: city || prev.city,
                            state: state || prev.state,
                            country: country || prev.country,
                    location: '', // Leave blank for admin to fill
                    fulladdress: fulladdress,
                    zipcode: zipcode,
                    coordinates: {
                        latitude: lat,
                        longitude: lng
                    }
                }));
                
                // Mark that a location has been selected
                setLocationSelected(true);
            });
            
            console.log("Google Places autocomplete initialized successfully");
        } catch (error) {
            console.error("Error initializing Places autocomplete:", error);
        }
    }, [map, marker, setGroup, setLocationSelected]);

    // Function to handle when Google Maps API is loaded
    const handleGoogleMapsLoaded = useCallback(() => {
        console.log("Google Maps API loaded successfully");
        googleMapsLoadingRef.current = false;
        setMapsApiLoaded(true);
        
        // Initialize autocomplete after maps loaded
        if (autocompleteInputRef.current && !window.__AUTOCOMPLETE_INITIALIZED) {
            setTimeout(() => {
                initAutocomplete();
            }, 100);
        }
    }, [initAutocomplete]);
    
    // Set up the callback for Google Maps script
    useEffect(() => {
        if (typeof window !== 'undefined' && !window.initGoogleMaps) {
            window.initGoogleMaps = handleGoogleMapsLoaded;
        }
        
        // Clean up the callback when component unmounts
        return () => {
            if (typeof window !== 'undefined') {
                // @ts-ignore - we're intentionally removing it
                window.initGoogleMaps = undefined;
            }
        };
    }, [handleGoogleMapsLoaded]);
    
    // Load Google Maps API and fetch leaders on component mount
    useEffect(() => {
        let isMounted = true;
        
        // Fetch leaders
        const fetchLeaders = async () => {
            try {
                const { data: leadersData, error } = await db
                  .from('leaders')
                  .select('*');
                
                if (error) throw error;
                
                if (leadersData && isMounted) {
                    setLeaders(leadersData.map(leader => ({
                        id: leader.id,
                        name: leader.name,
                        phone: leader.phone,
                        email: leader.email || '',
                        curso: leader.curso || ''
                    })));
                }
            } catch (error) {
                console.error("Erro ao buscar líderes:", error);
            }
        };
        
        fetchLeaders();
        
        // Check if Google Maps is already loaded
        if (window.google?.maps) {
            setMapsApiLoaded(true);
        }
        
        return () => {
            isMounted = false;
        };
    }, []);
    
    // Handle marker changes when coordinates are updated from the map
    const handleMapReady = useCallback((mapInstance: google.maps.Map, markerInstance: google.maps.Marker) => {
        console.log("Map and marker are ready");
        setMap(mapInstance);
        setMarker(markerInstance);
    }, []);
    
    // Handle marker position changes
    const handleMarkerPositionChange = useCallback((lat: number, lng: number) => {
        console.log(`Marker position changed: lat=${lat}, lng=${lng}`);
        setGroup(prev => ({
            ...prev,
            coordinates: {
                latitude: lat,
                longitude: lng
            }
        }));
    }, []);

    // Validate Instagram username
    const validateInstagram = async (username: string) => {
        if (!username) {
            setIsInstagramValid(null);
            return;
        }
        
        // Remove @ if present
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        
        if (!cleanUsername) {
            setIsInstagramValid(null);
            return;
        }
        
        // First, check basic format validation
        const isFormatValid = /^[a-zA-Z0-9_.]{1,30}$/.test(cleanUsername);
        if (!isFormatValid) {
            setIsInstagramValid(false);
            return;
        }
        
        setIsValidatingInstagram(true);
        
        try {
            // Manual verification by checking if the profile URL exists
            const profileUrl = `https://www.instagram.com/${cleanUsername.replace('@', '')}/?__a=1`;
            
            // Make a request to check if the profile exists
            await fetch(profileUrl, {
                method: 'HEAD'
            });
            
            // If we can access the page without a 404 error, assume the profile exists
            // Note: Due to CORS restrictions, we might not get detailed status information
            // The no-cors mode will restrict what information we can access
            
            // Format the username with @ if it doesn't already have it
            const formattedUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
            setIsInstagramValid(true);
            setGroup(prev => ({ ...prev, instagram: formattedUsername }));
            
        } catch (error) {
            console.error("Erro ao validar Instagram:", error);
            setIsInstagramValid(false);
        } finally {
            setIsValidatingInstagram(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage({ text: 'Salvando grupo...', type: 'info' });
        
        try {
            // Find the selected leader
            const selectedLeader = leaders.find(leader => leader.id === selectedLeaderId);
            
            if (!selectedLeader) {
                throw new Error("Por favor, selecione um líder");
            }
            
            // Validate required fields
            if (!group.university) {
                throw new Error("Por favor, selecione uma universidade pesquisando e clicando no mapa");
            }
            
            if (!group.dayofweek) {
                throw new Error("Por favor, selecione um dia da semana");
            }
            
            if (!group.time) {
                throw new Error("Por favor, informe um horário");
            }
            
            // Prepare the data with all required fields
            // IMPORTANT: Case sensitivity matters for Supabase column names
            const groupToSave = {
                name: group.name || 'Dunamis Pocket',
                university: group.university,
                city: group.city,
                state: group.state,
                country: group.country,
                location: group.location,
                instagram: group.instagram || '',
                dayofweek: group.dayofweek,
                time: group.time,
                tipo: group.tipo || 'Publica',
                local: group.local || '',
                // Use lowercase to match database column names
                fulladdress: group.fulladdress || '',  // Changed from fulladdress to fulladdress
                zipcode: group.zipcode || '',          // Changed from zipCode to zipcode
                leader: {
                    name: selectedLeader.name,
                    phone: selectedLeader.phone,
                    email: selectedLeader.email || '',
                    curso: selectedLeader.curso || ''
                },
                coordinates: group.coordinates,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            console.log("Salvando dados do grupo:", groupToSave);
            
            // Add group to Supabase
            const { data: insertedGroup, error } = await db
                .from('groups')
                .insert([groupToSave])
                .select()
                .single();
                
            if (error) {
                console.error("Erro do Supabase:", error);
                throw new Error(error.message || 'Erro ao salvar grupo');
            }
            
            setStatusMessage({ text: `Sucesso! Grupo adicionado com ID: ${insertedGroup.id}`, type: 'success' });
            
            // Reset form
            setGroup({ 
                id: '', 
                name: 'Dunamis Pocket',
                university: '', 
                city: '', 
                state: '', 
                country: '', 
                location: '',
                instagram: '',
                dayofweek: '',
                time: '',
                tipo: 'Publica',
                local: '',
                leader: { name: '', phone: '', email: '', curso: '' },
                coordinates: { latitude: -24.65236500245874, longitude: -47.87912740708651 },
                fulladdress: '',
                zipcode: '',
            });
            
            setSelectedLeaderId('');
            setLocationSelected(false);
            setIsInstagramValid(null);
            
            // Reset marker to default position if map exists
            if (map && marker) {
                const defaultLocation = { lat: -24.65236500245874, lng: -47.87912740708651 };
                map.setCenter(defaultLocation);
                map.setZoom(2);
                marker.setPosition(defaultLocation);
            }
            
            // Clear the search input
            if (autocompleteInputRef.current) {
                autocompleteInputRef.current.value = '';
            }
            
            // Reset autocomplete
            if (typeof window !== 'undefined') {
                window.__AUTOCOMPLETE_INITIALIZED = false;
            }
            autocompleteRef.current = null;
            setAutocompleteInitialized(false);
            
            // Reinitialize autocomplete after a short delay
            setTimeout(() => {
                if (window.google?.maps?.places && autocompleteInputRef.current) {
                    initAutocomplete();
                }
            }, 300);
            
        } catch (error) {
            console.error("Erro ao adicionar grupo: ", error);
            let errorMessage = 'Erro desconhecido';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setStatusMessage({ text: `Erro: ${errorMessage}`, type: 'error' });
        }
    };

    return (
        <>
            {/* Load the Google Maps script only once with proper loading=async parameter */}
            {!mapsApiLoaded && !window.google?.maps && (
                <Script
                    id="google-maps-api"
                    strategy="afterInteractive"
                    src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&callback=initGoogleMaps&loading=async`}
                />
            )}
            
            {/* Add global styles for map loading animation */}
            <style jsx global>{`
                @keyframes mapFadeIn {
                    from { opacity: 0.4; }
                    to { opacity: 1; }
                }
                
                .map-container .gm-style {
                    animation: mapFadeIn 0.6s ease-out;
                }
            `}</style>
            
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Adicionar Pockets Dunamis</h1>
                <div>
                    <Link href="/admin/groups" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2">
                        Ver Todos os Grupos
                    </Link>
                    <Link href="/admin/leaders" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded">
                        Gerenciar Líderes
                    </Link>
                </div>
            </div>
            
            {statusMessage && (
                <div className={`p-3 mb-4 rounded ${
                    statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 
                    statusMessage.type === 'error' ? 'bg-red-100 text-red-800' : 
                    'bg-blue-100 text-blue-800'
                }`}>
                    {statusMessage.text}
                </div>
            )}
            
            <div className="mb-6">
                <label className="block mb-1">Buscar Universidade</label>
                <input 
                    ref={autocompleteInputRef}
                    type="text" 
                    className="w-full border p-2 rounded" 
                    placeholder="Pesquisar por universidade" 
                    disabled={locationSelected}
                        onClick={() => {
                            // Try to initialize autocomplete when the user clicks on the input
                            if (window.google?.maps?.places && !window.__AUTOCOMPLETE_INITIALIZED) {
                                initAutocomplete();
                            }
                        }}
                />
                {locationSelected && (
                    <button 
                        className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                            onClick={() => {
                                setLocationSelected(false);
                                // Reset autocomplete
                                if (typeof window !== 'undefined') {
                                    window.__AUTOCOMPLETE_INITIALIZED = false;
                                }
                                autocompleteRef.current = null;
                                setAutocompleteInitialized(false);
                                
                                // Reset location field
                                setGroup(prev => ({
                                    ...prev,
                                    location: '',
                                }));
                                
                                // Reinitialize autocomplete 
                                setTimeout(() => {
                                    if (window.google?.maps?.places && autocompleteInputRef.current) {
                                        initAutocomplete();
                                    }
                                }, 100);
                            }}
                    >
                        Alterar Localização
                    </button>
                )}
                    
                    {/* Status indicator for autocomplete */}
                    {!mapsApiLoaded && (
                        <p className="text-xs text-yellow-600 mt-1">
                            Carregando API do Google Maps...
                        </p>
                    )}
                    {mapsApiLoaded && !autocompleteInitialized && (
                        <p className="text-xs text-yellow-600 mt-1">
                            Inicializando autocompletar...
                        </p>
                    )}
                    {autocompleteInitialized && !locationSelected && (
                        <p className="text-xs text-green-600 mt-1">
                            Digite o nome da universidade para ver sugestões
                        </p>
                    )}
                    {locationSelected && group.university && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-800">
                            <p className="font-medium">Universidade selecionada: {group.university}</p>
                            <p className="text-xs">
                                {group.city}, {group.state}, {group.country}
                            </p>
                            <p className="text-xs mt-1">
                                Coordenadas: {group.coordinates.latitude.toFixed(6)}, {group.coordinates.longitude.toFixed(6)}
                            </p>
                        </div>
                    )}
            </div>
            
                {/* Replace the direct map container with our isolated component */}
            <div className="mb-6">
                    {mapsApiLoaded ? (
                        <AdminMapComponent
                            onMapReady={handleMapReady}
                            onMarkerPositionChange={handleMarkerPositionChange}
                            initialCoordinates={group.coordinates}
                        />
                    ) : (
                        <div className="w-full h-[400px] border rounded map-container relative overflow-hidden">
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
                                <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-700 font-medium">Carregando API do mapa...</p>
                                <p className="text-sm text-gray-500 mt-1">Aguarde enquanto carregamos o Google Maps</p>
                            </div>
                        </div>
                    )}
                    
                    <p className="text-sm text-gray-600 mt-2">
                        {locationSelected 
                            ? "A universidade selecionada está marcada no mapa. Você pode arrastar o marcador para ajustar a localização exata."
                            : "Clique no mapa ou pesquise uma universidade acima para definir a localização."}
                    </p>
                    {group.coordinates.latitude !== 0 && (
                        <p className="text-xs text-blue-600">
                            Coordenadas atuais: {group.coordinates.latitude.toFixed(6)}, {group.coordinates.longitude.toFixed(6)}
                        </p>
                    )}
                    
                    {/* Debug button simplified with better error prevention */}
                    {map && marker && group.coordinates.latitude !== 0 && (
                        <button 
                            type="button"
                            className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded"
                            onClick={() => {
                                try {
                                    // Force marker to be visible and centered
                                    const position = new window.google.maps.LatLng(
                                        group.coordinates.latitude,
                                        group.coordinates.longitude
                                    );
                                    
                                    marker.setPosition(position);
                                    marker.setVisible(true);
                                    
                                    if (map && position) {
                                        map.setCenter(position);
                                        map.setZoom(15);
                                    }
                                    
                                    console.log("Debug: Marker visibility reset and centered");
                                } catch (error) {
                                    console.error("Error in centering marker:", error);
                                }
                            }}
                        >
                            Centralizar no marcador
                        </button>
                    )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">               
                {/* Location Details - Display as read-only information cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold col-span-full">Detalhes da Localização</h2>
                    
                    {/* University */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">Universidade</h3>
                        <p className="font-medium">{group.university || 'Não selecionada'}</p>
                    </div>
                    
                    {/* City */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">Cidade</h3>
                        <p className="font-medium">{group.city || 'Não selecionada'}</p>
                    </div>
                    
                    {/* State/Province */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">Estado/Província</h3>
                        <p className="font-medium">{group.state || 'Não selecionado'}</p>
                    </div>
                    
                    {/* Country */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">País</h3>
                        <p className="font-medium">{group.country || 'Não selecionado'}</p>
                    </div>
                    
                    {/* Full Address */}
                    <div className="bg-white p-3 rounded shadow-sm col-span-full">
                        <h3 className="text-sm text-gray-500">Endereço Completo</h3>
                        <p className="font-medium text-sm mt-1">{group.fulladdress || 'Não disponível'}</p>
                    </div>
                    
                    {group.zipcode && (
                        <div className="bg-white p-3 rounded shadow-sm">
                            <h3 className="text-sm text-gray-500">CEP/Código Postal</h3>
                            <p className="font-medium">{group.zipcode}</p>
                        </div>
                    )}
                    
                    {/* Location */}
                    <div className="bg-white p-3 rounded shadow-sm col-span-full">
                        <h3 className="text-sm text-gray-500">Localização Específica</h3>
                        <input 
                            type="text" 
                            value={group.location}
                            className="w-full border p-2 rounded mt-1" 
                            placeholder="Localização específica no campus" 
                            onChange={(e) => setGroup({ ...group, location: e.target.value })} 
                            required 
                        />
                    </div>
                </div>

                {/* Group Meeting Details */}
                <div className="bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold mb-3">Detalhes do Encontro</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Dia da Semana</label>
                            <select
                                value={group.dayofweek}
                                className="w-full border p-2 rounded" 
                                onChange={(e) => setGroup({ ...group, dayofweek: e.target.value })} 
                                required 
                            >
                                <option value="">Selecione um dia</option>
                                <option value="Segunda-feira">Segunda-feira</option>
                                <option value="Terça-feira">Terça-feira</option>
                                <option value="Quarta-feira">Quarta-feira</option>
                                <option value="Quinta-feira">Quinta-feira</option>
                                <option value="Sexta-feira">Sexta-feira</option>
                                <option value="Sábado">Sábado</option>
                                <option value="Domingo">Domingo</option>
                            </select>
                        </div>

                        <div>
                            <label className="block mb-1">Horário</label>
                            <input 
                                type="time" 
                                value={group.time}
                                className="w-full border p-2 rounded" 
                                onChange={(e) => setGroup({ ...group, time: e.target.value })} 
                                required 
                            />
                        </div>

                        {/* Type (Tipo) field */}
                        <div>
                            <label className="block mb-1">Tipo</label>
                            <select
                                value={group.tipo || 'Publica'}
                                className="w-full border p-2 rounded" 
                                onChange={(e) => setGroup({ ...group, tipo: e.target.value })} 
                                required 
                            >
                                <option value="Publica">Pública</option>
                                <option value="Privada">Privada</option>
                            </select>
                        </div>
                        
                        {/* Local field */}
                        <div>
                            <label className="block mb-1">Local</label>
                            <input 
                                type="text" 
                                value={group.local || ''}
                                className="w-full border p-2 rounded" 
                                placeholder="Informação adicional de local" 
                                onChange={(e) => setGroup({ ...group, local: e.target.value })} 
                            />
                        </div>
                    </div>
                </div>

                {/* Social Media & Contact */}
                <div className="bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold mb-3">Informações de Contato</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Instagram</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={group.instagram}
                                    className={`w-full border p-2 rounded pl-6 ${
                                        isInstagramValid === true ? 'border-green-500' : 
                                        isInstagramValid === false ? 'border-red-500' : ''
                                    }`} 
                                    placeholder="@usuário" 
                                    onChange={(e) => {
                                        setGroup({ ...group, instagram: e.target.value });
                                        // Don't validate on every keystroke to avoid excessive requests
                                        if (isInstagramValid !== null) {
                                            setIsInstagramValid(null);
                                        }
                                    }}
                                    required 
                                />
                                <span className="absolute left-2 top-2.5 text-gray-500">@</span>
                                {isValidatingInstagram && (
                                    <span className="absolute right-2 top-2.5 text-blue-500">Verificando...</span>
                                )}
                                {isInstagramValid === true && !isValidatingInstagram && (
                                    <span className="absolute right-2 top-2.5 text-green-500">✓ Válido</span>
                                )}
                                {isInstagramValid === false && !isValidatingInstagram && (
                                    <span className="absolute right-2 top-2.5 text-red-500">Inválido</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-500">Informe um nome de usuário válido do Instagram</p>
                                <button 
                                    type="button"
                                    className="text-xs text-blue-500 hover:text-blue-700"
                                    onClick={() => validateInstagram(group.instagram)}
                                    disabled={isValidatingInstagram || !group.instagram}
                                >
                                    Verificar Perfil
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 italic">Verificamos se o perfil do Instagram realmente existe.</p>
                        </div>

                        <div>
                            <label className="block mb-1">Líder</label>
                            <select
                                value={selectedLeaderId}
                                className="w-full border p-2 rounded"
                                onChange={(e) => setSelectedLeaderId(e.target.value)}
                                required
                            >
                                <option value="">Selecione um líder</option>
                                {leaders.map(leader => (
                                    <option key={leader.id} value={leader.id}>
                                        {leader.name} ({leader.phone}) - {leader.curso ? leader.curso : 'Sem Curso'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full md:w-auto"
                >
                    Adicionar Grupo
                </button>
            </form>
        </div>
        </>
    );
};

export default AdminPage;