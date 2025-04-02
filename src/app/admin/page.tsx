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
        draggable: false,
        title: "Localização selecionada"
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
    const leaderDropdownRef = useRef<HTMLDivElement>(null); // Ref for the leader dropdown
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [marker, setMarker] = useState<google.maps.Marker | null>(null);
    const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
    const [locationSelected, setLocationSelected] = useState<boolean>(false);
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
        active: true // Add active status
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
                    const formattedLeaders = leadersData.map(leader => ({
                        id: leader.id,
                        name: leader.name,
                        phone: leader.phone,
                        email: leader.email || '',
                        curso: leader.curso || '',
                        active: leader.active ?? true
                    }));
                    
                    setLeaders(formattedLeaders);
                    // Only include active leaders by default in the filtered list
                    setFilteredLeaders(formattedLeaders.filter(leader => leader.active !== false));
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

    // Instagram username validation function - completely client-side
    const validateInstagram = (value: string): boolean => {
        try {
            // Remove @ if present
            let username = value.trim();
            if (username.startsWith('@')) {
                username = username.substring(1);
            }
            
            // Basic validation
            if (username.length < 1 || username.length > 30) {
                return false;
            }
            
            // Check if only contains letters, numbers, underscores, and periods
            if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
                return false;
            }
            
            // Check if doesn't have consecutive periods
            if (username.includes('..')) {
                return false;
            }
            
            // Check if doesn't start or end with period
            if (username.startsWith('.') || username.endsWith('.')) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error("Error validating Instagram:", error);
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage({ text: 'Adicionando grupo...', type: 'info' });

        try {
            // Validate required fields
            if (!group.university || !group.dayofweek || !group.time) {
                throw new Error("Universidade, dia da semana e horário são obrigatórios");
            }

            if (!selectedLeaderId) {
                throw new Error("Por favor, selecione um líder");
            }

            // Find the selected leader
            const selectedLeader = leaders.find(leader => leader.id === selectedLeaderId);
            if (!selectedLeader) {
                throw new Error("Líder selecionado não encontrado");
            }

            // Validate Instagram if provided
            if (group.instagram && !validateInstagram(group.instagram)) {
                throw new Error("Nome de usuário do Instagram inválido");
            }

            // Create object with all the group data
            const groupData = {
                ...group,
                leader: {
                    name: selectedLeader.name,
                    phone: selectedLeader.phone,
                    email: selectedLeader.email || '',
                    curso: selectedLeader.curso || '',
                    active: selectedLeader.active ?? true
                },
                leader_id: selectedLeaderId, // Add the leader_id field
                location: group.university, // Set location same as university name
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                active: true // New groups are active by default
            };
            
            console.log("Salvando dados do grupo:", groupData);
            
            // Add group to Supabase
            const { data: insertedGroup, error } = await db
                .from('groups')
                .insert([groupData])
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
                active: true
            });
            
            setSelectedLeaderId('');
            setLocationSelected(false);
            
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

    const [showLeaderDropdown, setShowLeaderDropdown] = useState<boolean>(false);
    const [filteredLeaders, setFilteredLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);

    // Add click outside handler for leader dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target as Node)) {
                setShowLeaderDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
                            ? "A universidade selecionada está marcada no mapa."
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
                                    className="w-full border p-2 rounded pl-6" 
                                    placeholder="@usuário" 
                                    onChange={(e) => setGroup({ ...group, instagram: e.target.value })}
                                />
                                <span className="absolute left-2 top-2.5 text-gray-500">@</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Informe o nome de usuário do Instagram</p>
                        </div>

                        <div>
                            <label className="block mb-1">Líder</label>
                            
                            {/* Searchable Leader Dropdown */}
                            <div className="relative" ref={leaderDropdownRef}>
                                {/* Search Input */}
                                <input 
                                    type="text" 
                                    className="w-full border p-2 rounded"
                                    placeholder="Buscar líder por nome..."
                                    onChange={(e) => {
                                        // Filter leaders based on input
                                        const searchTerm = e.target.value.toLowerCase();
                                        
                                        // If input is cleared and a leader was previously selected, keep showing that one
                                        if (searchTerm === '' && selectedLeaderId) {
                                            const selected = leaders.find(l => l.id === selectedLeaderId);
                                            if (selected) {
                                                setFilteredLeaders([selected]);
                                            } else {
                                                // Only include active leaders
                                                setFilteredLeaders(leaders.filter(leader => leader.active !== false));
                                            }
                                        } else {
                                            // Filter based on search term and active status
                                            const filtered = leaders.filter(leader => 
                                                leader.active !== false && (
                                                leader.name.toLowerCase().includes(searchTerm) || 
                                                leader.phone.includes(searchTerm) ||
                                                (leader.curso && leader.curso.toLowerCase().includes(searchTerm))
                                            ));
                                            setFilteredLeaders(filtered);
                                        }
                                        
                                        // Show dropdown when typing
                                        setShowLeaderDropdown(true);
                                    }}
                                    onFocus={() => setShowLeaderDropdown(true)}
                                />
                                
                                {/* Dropdown Icon */}
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                
                                {/* Dropdown Menu */}
                                {showLeaderDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                        {filteredLeaders.length > 0 ? (
                                            filteredLeaders
                                                .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
                                                .map(leader => (
                                                <div 
                                                    key={leader.id} 
                                                    className={`p-2 cursor-pointer hover:bg-blue-50 ${
                                                        selectedLeaderId === leader.id ? 'bg-blue-100' : ''
                                                    }`}
                                                    onClick={() => {
                                                        setSelectedLeaderId(leader.id);
                                                        setShowLeaderDropdown(false);
                                                    }}
                                                >
                                                    <div className="font-medium">{leader.name}</div>
                                                    <div className="text-xs text-gray-600">
                                                        {leader.phone} {leader.curso ? `• ${leader.curso}` : ''}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-2 text-gray-500">
                                                Nenhum líder encontrado
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-1">
                                Digite o nome do líder, telefone ou curso para buscar
                            </p>
                            
                            {/* Display currently selected leader */}
                            {selectedLeaderId && (
                                <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded">
                                    <p className="font-medium">Líder selecionado:</p>
                                    {(() => {
                                        const selected = leaders.find(l => l.id === selectedLeaderId);
                                        return selected ? (
                                            <div className="text-sm">
                                                {selected.name} ({selected.phone})
                                                {selected.curso && <span> • {selected.curso}</span>}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-yellow-600">
                                                Líder não encontrado na lista
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
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