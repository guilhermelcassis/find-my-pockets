// app/(admin)/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Group } from '../../lib/interfaces';
import { db } from '../../lib/supabase';
import Link from 'next/link';
import Script from 'next/script';
import { Users, Map as MapIcon, PlusCircle } from 'lucide-react';
import StatusMessage from '@/components/StatusMessage';
import { GoogleMap, GoogleMarker, getWindowProperty, setWindowProperty } from '@/lib/google-maps-types';

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
  onMapReady: (map: GoogleMap, marker: GoogleMarker) => void;
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
    const [map, setMap] = useState<GoogleMap | null>(null);
    const [marker, setMarker] = useState<GoogleMarker | null>(null);
    const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
    const [showLeaderDropdown, setShowLeaderDropdown] = useState<boolean>(false);
    const [leaderSearchTerm, setLeaderSearchTerm] = useState<string>('');
    const [filteredLeaders, setFilteredLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [mapInitialized, setMapInitialized] = useState<boolean>(false);
    const [locationSelected, setLocationSelected] = useState<boolean>(false);
    const [mapsApiLoaded, setMapsApiLoaded] = useState<boolean>(false);
    const [autocompleteInitialized, setAutocompleteInitialized] = useState<boolean>(false);

    // State for form steps
    const [currentStep, setCurrentStep] = useState<number>(1);
    const totalSteps = 3;

    // Initial group state
    const [group, setGroup] = useState<Group>({ 
        id: '', 
        university: '', 
        city: '', 
        state: '', 
        country: '', 
        instagram: '',
        meetingTimes: [],
        leader: { name: '', phone: '', email: '', curso: '' },
        coordinates: { latitude: -24.65236500245874, longitude: -47.87912740708651 },
        fulladdress: '',
        tipo: 'Publica', // Default to public
        active: true
    });

    // Track initialization state to prevent double initialization
    const googleMapsLoadingRef = useRef<boolean>(false);
    const mapInitializedRef = useRef<boolean>(false);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mapDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const effectRunRef = useRef<boolean>(false);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    
    // State for status message auto-dismiss
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Add a memoized function to filter and sort leaders based on search term
    const filteredDisplayLeaders = useMemo(() => {
        // If no search term, just return all available leaders sorted alphabetically
        if (!leaderSearchTerm.trim()) {
            return [...filteredLeaders].sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // Normalize search term for better matching
        const normalizedSearchTerm = leaderSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Filter leaders based on search term
        return filteredLeaders
            .filter(leader => {
                const normalizedName = leader.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const normalizedCurso = (leader.curso || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const normalizedEmail = (leader.email || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const normalizedPhone = leader.phone.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                return normalizedName.includes(normalizedSearchTerm) ||
                    normalizedCurso.includes(normalizedSearchTerm) ||
                    normalizedEmail.includes(normalizedSearchTerm) ||
                    normalizedPhone.includes(normalizedSearchTerm);
            })
            .sort((a, b) => a.name.localeCompare(b.name)); // Always sort alphabetically
    }, [filteredLeaders, leaderSearchTerm]);

    // Function to initialize just the autocomplete - with improved error handling
    const initAutocomplete = useCallback(() => {
        if (typeof window === 'undefined') {
            console.log("Cannot initialize autocomplete: window is undefined");
            return;
        }
        
        if (!window.google?.maps?.places) {
            console.log("Google Places API not available yet, will retry later");
            // Try again after a delay
            setTimeout(() => {
                if (window.google?.maps?.places) {
                    console.log("Google Places API now available, initializing autocomplete");
                    initAutocomplete();
                }
            }, 1000);
            return;
        }
        
        if (!autocompleteInputRef.current) {
            console.log("Autocomplete input element not available");
            return;
        }
        
        // Force re-initialization when we're trying to actively initialize
        if (autocompleteRef.current) {
            console.log("Cleaning up existing autocomplete instance");
            google.maps.event.clearInstanceListeners(autocompleteRef.current);
            autocompleteRef.current = null;
        }
        
        if (window.__AUTOCOMPLETE_INITIALIZED && autocompleteInitialized) {
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
            
            // Create a fresh instance of autocomplete
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
                            fulladdress
                });
                        
                // Update form with all extracted data (note: location field has been removed from database schema)
                setGroup(prev => ({
                            ...prev,
                            university: university,
                            city: city || prev.city,
                            state: state || prev.state,
                            country: country || prev.country,
                            fulladdress: fulladdress,
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
            // Reset flags on error
            window.__AUTOCOMPLETE_INITIALIZED = false;
            setAutocompleteInitialized(false);
            autocompleteRef.current = null;
        }
    }, [map, marker, setGroup, setLocationSelected]);

    // Function to handle when Google Maps API is loaded
    const handleGoogleMapsLoaded = useCallback(() => {
        console.log("Google Maps API loaded successfully");
        googleMapsLoadingRef.current = false;
        setMapsApiLoaded(true);
        
        // Initialize autocomplete after maps loaded with a slight delay
        if (autocompleteInputRef.current) {
            // Force reset of initialization flags
            window.__AUTOCOMPLETE_INITIALIZED = false;
            autocompleteRef.current = null;
            setAutocompleteInitialized(false);
            
            setTimeout(() => {
                initAutocomplete();
            }, 300);
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
                // First get all leaders
                const { data: leadersData, error } = await db
                  .from('leaders')
                  .select('*');
                
                if (error) throw error;
                
                // Then get all groups to check which leaders are already assigned
                const { data: groupsData, error: groupsError } = await db
                  .from('groups')
                  .select('leader_id')
                  .eq('active', true);
                
                if (groupsError) throw groupsError;
                
                if (leadersData && isMounted) {
                    const formattedLeaders = leadersData.map(leader => ({
                        id: leader.id,
                        name: leader.name,
                        phone: leader.phone,
                        email: leader.email || '',
                        curso: leader.curso || '',
                        active: leader.active ?? true
                    }));
                    
                    // Get array of leader_ids that are already assigned to active groups
                    const assignedLeaderIds = groupsData
                        .filter(group => group.leader_id)
                        .map(group => group.leader_id);
                    
                    // Filter out leaders that are already assigned to groups and sort alphabetically
                    const availableLeaders = formattedLeaders
                        .filter(leader => !assignedLeaderIds.includes(leader.id) && leader.active !== false)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    
                    // Save all leaders for reference
                    setLeaders(formattedLeaders);
                    
                    // Only include active and unassigned leaders in the filtered list
                    setFilteredLeaders(availableLeaders);
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
    
    // Create a map to test if the initialization is working
    const handleMapReady = useCallback((mapInstance: GoogleMap, markerInstance: GoogleMarker) => {
        console.log("Main component received map and marker instances");
        setMap(mapInstance);
        setMarker(markerInstance);
        setMapInitialized(true);
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
        // Allow empty Instagram values
        if (!value.trim()) {
            return true;
        }
        
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

    // Add real-time validation functions
    const validateInstagramInput = (value: string) => {
        // If empty, it's valid (no longer required)
        if (!value.trim()) {
            setValidationErrors(prev => {
                const newErrors = {...prev};
                delete newErrors.instagram;
                return newErrors;
            });
            return true;
        }
        
        let error = '';
        
        if (value.includes(' ')) {
            error = 'Nome de usuário não pode conter espaços';
        } else if (value.startsWith('@')) {
            error = 'Não inclua o @ no início do nome';
        } else if (!/^[a-zA-Z0-9_.]+$/.test(value)) {
            error = 'Use apenas letras, números, ponto e underscore';
        } else if (value.length > 30) {
            error = 'Nome de usuário muito longo (máx. 30 caracteres)';
        }
        
        setValidationErrors(prev => ({
            ...prev,
            instagram: error
        }));
        
        return !error;
    };
    
    const clearValidationError = (field: string) => {
        setValidationErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[field];
            return newErrors;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate form before submission
        const isInstagramValid = validateInstagramInput(group.instagram);
        
        if (!isInstagramValid) {
            setStatusMessage({ text: 'Por favor, corrija os erros no formulário antes de continuar', type: 'error' });
            return;
        }
        
        if (!selectedLeaderId) {
            setStatusMessage({ text: 'Por favor, selecione um líder', type: 'error' });
            return;
        }
        
        // Validate meeting times
        if (group.meetingTimes.length === 0) {
            setStatusMessage({ text: 'Adicione pelo menos um horário de encontro', type: 'error' });
            return;
        }

        setStatusMessage({ text: 'Adicionando grupo...', type: 'info' });

        try {
            // Validate required fields
            if (!group.university) {
                throw new Error("Universidade é obrigatória");
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

            // Create object with all the group data but without the id field
            // Destructure to omit the id field - Supabase will auto-generate a UUID
            const { id, ...groupWithoutId } = group;
            
            const groupData = {
                ...groupWithoutId,
                leader: {
                    name: selectedLeader.name,
                    phone: selectedLeader.phone,
                    email: selectedLeader.email || '',
                    curso: selectedLeader.curso || '',
                    active: selectedLeader.active ?? true
                },
                leader_id: selectedLeaderId, // Add the leader_id field
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
                university: '', 
                city: '', 
                state: '', 
                country: '', 
                instagram: '',
                meetingTimes: [],
                leader: { name: '', phone: '', email: '', curso: '' },
                coordinates: { latitude: -24.65236500245874, longitude: -47.87912740708651 },
                fulladdress: '',
                tipo: 'Publica', // Default to public
                active: true
            });
            
            setSelectedLeaderId('');
            setLocationSelected(false);
            
            // Reset to step 1 to allow inserting a new group
            setCurrentStep(1);
            
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

    // Auto-dismiss status messages after 5 seconds for success/info messages
    useEffect(() => {
        if (statusMessage && (statusMessage.type === 'success' || statusMessage.type === 'info')) {
            // Clear any existing timeout
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
            
            // Set new timeout
            statusTimeoutRef.current = setTimeout(() => {
                setStatusMessage(null);
            }, 5000);
        }
        
        // Cleanup on unmount
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, [statusMessage]);

    // Helper to navigate between steps
    const goToStep = (step: number) => {
        if (step < 1 || step > totalSteps) return;
        
        // Validate current step before proceeding to next
        if (step > currentStep) {
            // Add validation logic here as needed
            if (currentStep === 1 && !locationSelected) {
                setStatusMessage({ text: 'Por favor, selecione uma universidade antes de continuar', type: 'error' });
                return;
            }
        }
        
        setCurrentStep(step);
        
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Add a new effect to handle page visibility and component remounting
    useEffect(() => {
        // Handle page visibility changes (when user comes back to the tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Reset autocomplete state when page becomes visible again
                if (window.google?.maps?.places && !autocompleteInitialized) {
                    console.log("Page visible again - reinitializing autocomplete");
                    
                    // Reset initialization flags
                    window.__AUTOCOMPLETE_INITIALIZED = false;
                    autocompleteRef.current = null;
                    
                    // Reinitialize after a short delay
                    setTimeout(() => {
                        initAutocomplete();
                    }, 300);
                }
            }
        };

        // Check initialization state on component mount
        if (window.google?.maps?.places && !autocompleteInitialized) {
            console.log("Component mounted - initializing autocomplete");
            // Reset autocomplete state
            window.__AUTOCOMPLETE_INITIALIZED = false;
            autocompleteRef.current = null;
            setAutocompleteInitialized(false);
            
            // Initialize autocomplete
            setTimeout(() => {
                initAutocomplete();
            }, 300);
        }
        
        // Add visibility change listener
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Cleanup function
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            // Clear all Google Maps event listeners on unmount
            if (autocompleteRef.current) {
                try {
                    google.maps.event.clearInstanceListeners(autocompleteRef.current);
                } catch (e) {
                    console.error("Error clearing autocomplete listeners:", e);
                }
                autocompleteRef.current = null;
            }
        };
    }, [initAutocomplete, autocompleteInitialized]);

    return (
        <>
            {/* Google Maps Script with key parameter and updated callback */}
            <Script
                id="google-maps-script"
                strategy="lazyOnload"
                src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMaps`}
            />
            
            {/* Full page container with modern gradient background */}
            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
                <div className="container mx-auto max-w-4xl px-6 py-8">
                    {/* Page header with simplified design */}
                    <div className="mb-8">
                        <div className="flex items-center mb-2">
                            <div className="bg-primary/10 p-2 rounded-lg mr-3">
                                <PlusCircle className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                                Adicionar Novo Grupo
                            </h1>
                        </div>
                        <p className="text-gray-600 text-sm mt-2 max-w-2xl">
                            Preencha o formulário abaixo para cadastrar um novo grupo Dunamis Pocket.
                        </p>
                        <div className="flex mt-4">
                            <a 
                                href="/admin/groups" 
                                className="text-primary hover:text-primary/80 text-sm font-medium flex items-center"
                            >
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                </svg>
                                Voltar para lista de grupos
                            </a>
                        </div>
                    </div>
                    
                    {/* Status message with animation */}
                    {statusMessage && (
                        <div className="animate-fadeIn mb-6">
                            <StatusMessage
                                type={statusMessage.type}
                                text={statusMessage.text}
                                onClose={() => setStatusMessage(null)}
                            />
                        </div>
                    )}
                    
                    {/* Main form container */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                        <div className="p-8">
                            {/* Enhanced step indicator with modern design */}
                            <div className="mb-12">
                                <div className="flex justify-between items-center relative">
                                    {/* Progress bar background */}
                                    <div className="absolute h-1 bg-gray-200 left-0 right-0 top-1/2 -translate-y-1/2 -z-10 rounded-full"></div>
                                    
                                    {/* Active progress bar */}
                                    <div 
                                        className="absolute h-1 bg-primary left-0 top-1/2 -translate-y-1/2 -z-5 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`
                                        }}
                                    ></div>
                                    
                                    {Array.from({length: totalSteps}).map((_, index) => (
                                        <div key={index} className="flex flex-col items-center z-10">
                                            <div 
                                                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                                                    ${currentStep > index + 1 ? 'bg-primary/10 border-2 border-primary text-primary' : ''}
                                                    ${currentStep === index + 1 ? 'bg-primary text-white shadow-md scale-110' : 'bg-white text-gray-500 border border-gray-300'}
                                                `}
                                                onClick={() => index + 1 < currentStep && goToStep(index + 1)}
                                                style={{cursor: index + 1 < currentStep ? 'pointer' : 'default'}}
                                            >
                                                {currentStep > index + 1 ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                    </svg>
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            <div className={`text-sm transition-all duration-300 ${currentStep === index + 1 ? 'text-primary font-semibold scale-110' : 'text-gray-600'}`}>
                                                {index === 0 ? 'Localização' : index === 1 ? 'Encontros' : 'Contato e Líder'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Form content */}
                            <form onSubmit={handleSubmit}>
                                {/* Step 1: Location Selection */}
                                {currentStep === 1 && (
                                    <div className="space-y-6">
                                        <div className="flex items-center space-x-2 mb-4">
                                            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-xl font-semibold text-gray-800">Selecionar Localização</h2>
                                        </div>
                                        
                                        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                                            <label className="block mb-2 font-medium text-gray-700">Buscar Universidade <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                </div>
                                                <input 
                                                    ref={autocompleteInputRef}
                                                    type="text" 
                                                    className={`pl-10 w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all ${!mapsApiLoaded ? 'bg-gray-100' : 'bg-white'}`}
                                                    placeholder={mapsApiLoaded ? "Pesquisar por nome da universidade..." : "Carregando Google Maps..."}
                                                    disabled={locationSelected || !mapsApiLoaded}
                                                    onClick={() => {
                                                        // Try to initialize autocomplete when the user clicks on the input
                                                        if (window.google?.maps?.places) {
                                                            // Always try to reinitialize on click for better reliability
                                                            console.log("Input clicked, reinitializing autocomplete");
                                                            window.__AUTOCOMPLETE_INITIALIZED = false;
                                                            autocompleteRef.current = null;
                                                            setAutocompleteInitialized(false);
                                                            initAutocomplete();
                                                        }
                                                    }}
                                                    onFocus={() => {
                                                        // Also attempt to initialize on focus
                                                        if (window.google?.maps?.places && !autocompleteInitialized) {
                                                            console.log("Input focused, initializing autocomplete");
                                                            initAutocomplete();
                                                        }
                                                    }}
                                                />
                                            </div>
                                            
                                            {locationSelected && (
                                                <div className="flex justify-between items-center mt-3">
                                                    <div className="flex items-center">
                                                        <div className="bg-green-100 p-1 rounded-full">
                                                            <svg className="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                        <span className="ml-2 text-sm font-medium text-gray-700">
                                                            {group.university}
                                                            {group.city && <span className="text-gray-500"> • {group.city}</span>}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md text-sm font-medium transition-colors flex items-center"
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
                                                                fulladdress: '',
                                                            }));
                                                            
                                                            // Reinitialize autocomplete after a short delay
                                                            setTimeout(() => {
                                                                if (window.google?.maps?.places && autocompleteInputRef.current) {
                                                                    initAutocomplete();
                                                                }
                                                            }, 300);
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        Alterar
                                                    </button>
                                                </div>
                                            )}
                                                
                                            {/* Status indicators with better styling */}
                                            {!mapsApiLoaded && (
                                                <div className="mt-3 flex items-center text-yellow-600">
                                                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <p className="text-sm">Carregando API do Google Maps... Por favor aguarde.</p>
                                                </div>
                                            )}
                                            {mapsApiLoaded && !autocompleteInitialized && (
                                                <div className="mt-3 flex items-center text-yellow-600">
                                                    <svg className="animate-pulse h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p className="text-sm">Inicializando autocompletar... Clique no campo de busca para ativar.</p>
                                                </div>
                                            )}
                                            {mapsApiLoaded && autocompleteInitialized && !locationSelected && (
                                                <div className="mt-3 flex items-center text-green-600">
                                                    <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p className="text-sm">Digite o nome da universidade para ver sugestões. Você também pode clicar diretamente no mapa.</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Map container with better styling */}
                                        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                            {mapsApiLoaded ? (
                                                <div className="h-[450px]">
                                                    <AdminMapComponent
                                                        onMapReady={handleMapReady}
                                                        onMarkerPositionChange={handleMarkerPositionChange}
                                                        initialCoordinates={group.coordinates}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full h-[450px] relative overflow-hidden bg-gray-100">
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
                                                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                                        <p className="text-gray-700 font-medium">Carregando API do mapa...</p>
                                                        <p className="text-sm text-gray-500 mt-1">Aguarde enquanto carregamos o Google Maps</p>
                                                    </div>
                                                </div>
                                            )}
                                                
                                            <div className="bg-gray-50 py-3 px-4 border-t border-gray-200">
                                                <p className="text-sm text-gray-600 flex items-center">
                                                    <svg className="h-4 w-4 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {!locationSelected 
                                                        ? "Clique no mapa ou pesquise uma universidade acima para definir a localização."
                                                        : ""}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Location Details - Simplified and more concise */}
                                        {locationSelected && (
                                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-fadeIn">
                                                <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
                                                    <svg className="h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                                    </svg>
                                                    Detalhes da Localização
                                                </h3>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* University */}
                                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                        <h4 className="text-sm text-gray-500 mb-1">Universidade</h4>
                                                        <p className="font-medium text-gray-800">{group.university || 'Não selecionada'}</p>
                                                    </div>
                                                    
                                                    {/* City and State */}
                                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                        <h4 className="text-sm text-gray-500 mb-1">Localização</h4>
                                                        <p className="font-medium text-gray-800">
                                                            {group.city && group.state 
                                                                ? `${group.city}, ${group.state}`
                                                                : group.city || group.state || 'Não disponível'}
                                                        </p>
                                                        {group.country && <p className="text-sm text-gray-500">{group.country}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-end mt-8">
                                            <button 
                                                type="button" 
                                                className={`px-6 py-3 rounded-lg font-medium text-white flex items-center transition-all ${
                                                    locationSelected ? 'bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg' : 'bg-gray-400 cursor-not-allowed'
                                                }`}
                                                onClick={() => goToStep(2)}
                                                disabled={!locationSelected}
                                            >
                                                Próximo
                                                <svg className="ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Step 2: Meeting Times */}
                                {currentStep === 2 && (
                                    <div className="space-y-4">
                                        <h2 className="text-xl font-semibold mb-2">Passo 2: Horários de Encontro</h2>
                                        
                                        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                                            <div className="mb-4 flex justify-between items-center">
                                                <h3 className="font-medium">Horários do Grupo</h3>
                                                <button 
                                                    type="button"
                                                    className="text-sm bg-primary hover:bg-primary/90 text-white py-1.5 px-3 rounded-md shadow-sm flex items-center"
                                                    onClick={() => {
                                                        setGroup(prev => ({
                                                            ...prev,
                                                            meetingTimes: [
                                                                ...prev.meetingTimes,
                                                                { dayofweek: '', time: '', local: '' }
                                                            ]
                                                        }));
                                                    }}
                                                >
                                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                                    </svg>
                                                    Adicionar Horário
                                                </button>
                                            </div>
                                            
                                            {group.meetingTimes.length === 0 ? (
                                                <div className="text-center py-8 bg-white rounded-md border border-dashed border-gray-300">
                                                    <div className="text-gray-500 mb-2">
                                                        <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                        </svg>
                                                    </div>
                                                    <p className="text-gray-600 font-medium">Nenhum horário adicionado</p>
                                                    <p className="text-sm text-gray-500 mt-1">Clique no botão acima para adicionar horários de encontro</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {group.meetingTimes.map((meeting, index) => (
                                                        <div key={index} className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h4 className="font-medium text-primary">Horário {index + 1}</h4>
                                                                <button
                                                                    type="button"
                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                                    onClick={() => {
                                                                        setGroup(prev => ({
                                                                            ...prev,
                                                                            meetingTimes: prev.meetingTimes.filter((_, i) => i !== index)
                                                                        }));
                                                                    }}
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div>
                                                                    <label className="block mb-1 text-sm font-medium">Dia da Semana <span className="text-red-500">*</span></label>
                                                                    <select
                                                                        value={meeting.dayofweek}
                                                                        className="w-full border bg-white p-2 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors" 
                                                                        onChange={(e) => {
                                                                            const updatedMeetings = [...group.meetingTimes];
                                                                            updatedMeetings[index] = {
                                                                                ...updatedMeetings[index],
                                                                                dayofweek: e.target.value
                                                                            };
                                                                            setGroup(prev => ({
                                                                                ...prev,
                                                                                meetingTimes: updatedMeetings
                                                                            }));
                                                                        }}
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
                                                                    <label className="block mb-1 text-sm font-medium">Horário <span className="text-red-500">*</span></label>
                                                                    <input 
                                                                        type="time" 
                                                                        value={meeting.time}
                                                                        className="w-full border bg-white p-2 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors" 
                                                                        onChange={(e) => {
                                                                            const updatedMeetings = [...group.meetingTimes];
                                                                            updatedMeetings[index] = {
                                                                                ...updatedMeetings[index],
                                                                                time: e.target.value
                                                                            };
                                                                            setGroup(prev => ({
                                                                                ...prev,
                                                                                meetingTimes: updatedMeetings
                                                                            }));
                                                                        }}
                                                                        required 
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block mb-1 text-sm font-medium">Local Específico</label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={meeting.local || ''}
                                                                        className="w-full border bg-white p-2 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors" 
                                                                        placeholder="Ex: Bloco A, Sala 101" 
                                                                        onChange={(e) => {
                                                                            const updatedMeetings = [...group.meetingTimes];
                                                                            updatedMeetings[index] = {
                                                                                ...updatedMeetings[index],
                                                                                local: e.target.value
                                                                            };
                                                                            setGroup(prev => ({
                                                                                ...prev,
                                                                                meetingTimes: updatedMeetings
                                                                            }));
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            <div className="mt-4">
                                                <div>
                                                    <label className="block mb-1 font-medium">Tipo de Grupo</label>
                                                    <select
                                                        value={group.tipo || 'Publica'}
                                                        className="w-full border bg-white p-2 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors" 
                                                        onChange={(e) => setGroup(prev => ({ ...prev, tipo: e.target.value }))} 
                                                    >
                                                        <option value="Publica">Público</option>
                                                        <option value="Privada">Privado</option>
                                                    </select>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Grupos públicos são visíveis para todos. Grupos privados só são visíveis com link direto.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 mt-6">
                                            <button 
                                                type="button" 
                                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md order-2 sm:order-1 transition-colors"
                                                onClick={() => goToStep(1)}
                                            >
                                                <span className="flex items-center">
                                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                                    </svg>
                                                    Voltar
                                                </span>
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`bg-primary hover:bg-primary/90 text-white py-2 px-5 rounded-md shadow-sm order-1 sm:order-2 transition-colors ${
                                                    group.meetingTimes.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
                                                }`}
                                                onClick={() => {
                                                    if (group.meetingTimes.length === 0) {
                                                        setStatusMessage({
                                                            text: 'Por favor, adicione pelo menos um horário de encontro',
                                                            type: 'error'
                                                        });
                                                        return;
                                                    }
                                                    
                                                    // Check if all meeting times have day and time
                                                    const invalidMeetings = group.meetingTimes.filter(
                                                        m => !m.dayofweek || !m.time
                                                    );
                                                    
                                                    if (invalidMeetings.length > 0) {
                                                        setStatusMessage({
                                                            text: 'Todos os horários precisam ter dia da semana e hora definidos',
                                                            type: 'error'
                                                        });
                                                        return;
                                                    }
                                                    
                                                    setCurrentStep(3);
                                                }}
                                            >
                                                <span className="flex items-center">
                                                    Próximo
                                                    <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Step 3: Contact and Leader */}
                                {currentStep === 3 && (
                                    <div className="space-y-4">
                                        <h2 className="text-xl font-semibold mb-2">Passo 3: Contato e Líder</h2>
                                        
                                        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="block mb-1 font-medium">Instagram</label>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">@</span>
                                                        <input 
                                                            type="text" 
                                                            value={group.instagram}
                                                            className={`w-full border bg-white pl-8 p-2 rounded-md ${validationErrors.instagram ? 'border-red-500 focus:ring-red-500' : 'focus:ring-2 focus:ring-primary focus:border-primary'} outline-none transition-colors`}
                                                            placeholder="nome_do_grupo (opcional)" 
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setGroup(prev => ({...prev, instagram: value}));
                                                                validateInstagramInput(value);
                                                            }}
                                                            onBlur={(e) => validateInstagramInput(e.target.value)}
                                                            onFocus={() => clearValidationError('instagram')}
                                                        />
                                                    </div>
                                                    {validationErrors.instagram && (
                                                        <p className="text-red-500 text-xs mt-1">{validationErrors.instagram}</p>
                                                    )}
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Nome de usuário do Instagram do grupo (sem o @)
                                                    </p>
                                                </div>
                                                
                                                <div>
                                                    <label className="block mb-1 font-medium">Selecionar Líder <span className="text-red-500">*</span></label>
                                                    <div ref={leaderDropdownRef} className="relative">
                                                        <div 
                                                            className={`w-full p-2 border ${validationErrors.leader ? 'border-red-500' : 'border-gray-300'} rounded-md cursor-pointer bg-white flex justify-between items-center`}
                                                            onClick={() => {
                                                                // Toggle dropdown
                                                                setShowLeaderDropdown(!showLeaderDropdown);
                                                            }}
                                                        >
                                                            <div>
                                                                {selectedLeaderId ? (
                                                                    (() => {
                                                                        const selected = leaders.find(l => l.id === selectedLeaderId);
                                                                        return selected ? (
                                                                            <div className="text-sm font-medium truncate">{selected.name}</div>
                                                                        ) : 'Selecione um líder';
                                                                    })()
                                                                ) : 'Selecione um líder'}
                                                            </div>
                                                            <svg className={`w-5 h-5 transition-transform ${showLeaderDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                            </svg>
                                                        </div>
                                                        
                                                        {showLeaderDropdown && (
                                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                                                                {/* Search field */}
                                                                <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
                                                                    <input 
                                                                        type="text"
                                                                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                                                        placeholder="Buscar líder..." 
                                                                        value={leaderSearchTerm}
                                                                        onChange={(e) => setLeaderSearchTerm(e.target.value)}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                
                                                                {filteredDisplayLeaders.length > 0 ? (
                                                                    filteredDisplayLeaders.map(leader => (
                                                                        <div 
                                                                            key={leader.id} 
                                                                            className={`p-3 hover:bg-gray-100 cursor-pointer ${selectedLeaderId === leader.id ? 'bg-primary/10 font-medium text-primary' : ''}`}
                                                                            onClick={() => {
                                                                                setSelectedLeaderId(leader.id);
                                                                                setShowLeaderDropdown(false);
                                                                                setLeaderSearchTerm('');
                                                                                clearValidationError('leader');
                                                                            }}
                                                                        >
                                                                            <div className="text-sm font-medium truncate">{leader.name}</div>
                                                                            <div className="text-xs text-gray-500 truncate">
                                                                                {leader.curso} • {leader.phone}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="p-3 text-sm text-gray-500">
                                                                        Nenhum líder encontrado
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Review section */}
                                            <div className="mt-6 pt-4 border-t border-gray-200">
                                                <h3 className="text-md font-medium mb-3">Revisão do grupo:</h3>
                                                <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-white rounded-md border border-gray-200">
                                                    <div>
                                                        <h4 className="text-sm font-medium">Universidade</h4>
                                                        <p className="text-sm">{group.university || 'Não definida'}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {group.city}, {group.state}
                                                        </p>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="text-sm font-medium">Encontros</h4>
                                                        {group.meetingTimes.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {group.meetingTimes.map((meeting, idx) => (
                                                                    <p key={idx} className="text-sm">
                                                                        {meeting.dayofweek} às {meeting.time}
                                                                        {meeting.local && <span className="text-xs text-gray-500"> • {meeting.local}</span>}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-red-500">Nenhum horário definido</p>
                                                        )}
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {group.tipo === 'Privada' ? 'Grupo Privado' : 'Grupo Público'}
                                                        </p>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="text-sm font-medium">Instagram</h4>
                                                        <p className="text-sm">@{group.instagram || 'Não definido'}</p>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="text-sm font-medium">Líder</h4>
                                                        {selectedLeaderId ? (
                                                            (() => {
                                                                const selected = leaders.find(l => l.id === selectedLeaderId);
                                                                return selected ? (
                                                                    <div>
                                                                        <p className="text-sm truncate">{selected.name}</p>
                                                                        <p className="text-xs text-gray-500 truncate">
                                                                            {selected.phone}
                                                                            {selected.curso && ` • ${selected.curso}`}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-yellow-600">Líder não encontrado</p>
                                                                );
                                                            })()
                                                        ) : (
                                                            <p className="text-sm text-red-500">Nenhum líder selecionado</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 mt-6">
                                                <button 
                                                    type="button" 
                                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md order-2 sm:order-1 transition-colors"
                                                    onClick={() => goToStep(2)}
                                                >
                                                    <span className="flex items-center">
                                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                                                        </svg>
                                                        Voltar
                                                    </span>
                                                </button>
                                                <button 
                                                    type="submit" 
                                                    className="bg-primary hover:bg-primary/90 text-white py-2 px-5 rounded-md shadow-sm order-1 sm:order-2 transition-colors flex items-center justify-center"
                                                    onClick={(e) => {
                                                        // Prevent default form submission to do validation
                                                        e.preventDefault();
                                                        
                                                        // Validate leader selections
                                                        if (!selectedLeaderId || selectedLeaderId === '') {
                                                            setStatusMessage({
                                                                text: 'Por favor, selecione um líder para o grupo.',
                                                                type: 'error'
                                                            });
                                                            return;
                                                        }
                                                        
                                                        // If validation passes, submit the form
                                                        handleSubmit(e);
                                                    }}
                                                >
                                                    <span className="flex items-center">
                                                        Salvar Grupo
                                                        <svg className="ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminPage;