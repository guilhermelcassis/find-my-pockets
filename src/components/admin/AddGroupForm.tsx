'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Group } from '@/lib/interfaces';
import { supabase } from '@/lib/supabase';
import { GoogleMap, GoogleMarker } from '@/lib/google-maps-types';
import Script from 'next/script';

import StepIndicator from './StepIndicator';
import LocationStep from './LocationStep';
import MeetingDetailsStep from './MeetingDetailsStep';
import ContactLeaderStep from './ContactLeaderStep';

export default function AddGroupForm() {
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const leaderDropdownRef = useRef<HTMLDivElement>(null); // Ref for the leader dropdown
  const [map, setMap] = useState<GoogleMap | null>(null);
  const [marker, setMarker] = useState<GoogleMarker | null>(null);
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
      university: '',
      city: '',
      state: '',
      country: '',
      instagram: '',
      tipo: 'Publica', // Default to 'Publica' as it's required
      leader: { name: '', phone: '', email: '', curso: '' },
      coordinates: { latitude: 0, longitude: 0 },
      fulladdress: '',
      active: true,
      meetingTimes: [] // Array for multiple meeting times
  });

  // New state for step-based form
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 3;
  
  // State for status message auto-dismiss
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // Add state for leader dropdown
  const [showLeaderDropdown, setShowLeaderDropdown] = useState<boolean>(false);
  const [filteredLeaders, setFilteredLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);

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
                
            // Update form with all extracted data
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
            // First get all leaders
            const { data: leadersData, error } = await supabase
              .from('leaders')
              .select('*');
            
            if (error) throw error;
            
            // Then get all groups to check which leaders are already assigned
            const { data: groupsData, error: groupsError } = await supabase
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
                
                // Filter out leaders that are already assigned to groups
                const availableLeaders = formattedLeaders.filter(
                    leader => !assignedLeaderIds.includes(leader.id) && leader.active !== false
                );
                
                // Save all leaders for reference
                setLeaders(formattedLeaders);
                
                // Only include active and unassigned leaders in the filtered list
                // Sort them alphabetically by name
                setFilteredLeaders(
                    availableLeaders
                        .sort((a, b) => a.name.localeCompare(b.name))
                );
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
  const handleMapReady = useCallback((mapInstance: GoogleMap, markerInstance: GoogleMarker) => {
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

  // Add real-time validation functions
  const validateInstagramInput = (value: string) => {
    let error = '';
    
    if (!value.trim()) {
        error = 'Instagram é obrigatório';
    } else if (value.includes(' ')) {
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
    
    // Check if all meeting times have day and time
    const invalidMeetings = group.meetingTimes.filter(
        m => !m.dayofweek || !m.time
    );
    
    if (invalidMeetings.length > 0) {
        setStatusMessage({ text: 'Todos os horários precisam ter dia da semana e hora definidos', type: 'error' });
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
        const { data: insertedGroup, error } = await supabase
            .from('groups')
            .insert([groupData])
            .select()
            .single();
            
        if (error) {
            console.error("Erro do Supabase:", error);
            throw new Error(error.message || 'Erro ao salvar grupo');
        }
        
        setStatusMessage({ text: `Sucesso! Grupo adicionado com ID: ${insertedGroup.id}`, type: 'success' });
        
        // Reset form after successful submission
        setGroup({ 
            id: '', 
            university: '', 
            city: '', 
            state: '', 
            country: '', 
            instagram: '',
            tipo: 'Publica', // Default to 'Publica' as it's required
            leader: { name: '', phone: '', email: '', curso: '' },
            coordinates: { latitude: -24.65236500245874, longitude: -47.87912740708651 },
            fulladdress: '',
            active: true,
            meetingTimes: [] // Array for multiple meeting times
        });
        
        setSelectedLeaderId('');
        setLocationSelected(false);
        
        // Reset map and other fields
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
        
        // Reset current step
        setCurrentStep(1);
        
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
          
          .step-indicator {
              transition: all 0.3s ease;
          }
          
          .step-indicator.active {
              background-color: #3b82f6;
              color: white;
          }
          
          .step-indicator.completed {
              background-color: #10b981;
              color: white;
          }
          
          /* Mobile responsiveness */
          @media (max-width: 640px) {
              .mobile-stack {
                  flex-direction: column;
              }
              
              .mobile-full {
                  width: 100%;
                  margin-top: 0.5rem;
              }
              
              .step-text {
                  font-size: 0.65rem;
              }
          }
      `}</style>
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded shadow-sm ${
            statusMessage.type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-800' : 
            statusMessage.type === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-800' : 
            'bg-blue-100 border-l-4 border-blue-500 text-blue-800'
        }`}>
            {statusMessage.text}
            {(statusMessage.type === 'success' || statusMessage.type === 'info') && (
                <button 
                    className="float-right text-gray-500 hover:text-gray-700" 
                    onClick={() => setStatusMessage(null)}
                    aria-label="Fechar"
                >
                    &times;
                </button>
            )}
        </div>
      )}
        
      <StepIndicator 
        currentStep={currentStep}
        totalSteps={totalSteps}
        goToStep={goToStep}
      />
    
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Location Selection */}
        {currentStep === 1 && (
          <LocationStep
            group={group}
            setGroup={setGroup}
            locationSelected={locationSelected}
            setLocationSelected={setLocationSelected}
            mapsApiLoaded={mapsApiLoaded}
            autocompleteInitialized={autocompleteInitialized}
            map={map}
            marker={marker}
            autocompleteInputRef={autocompleteInputRef}
            initAutocomplete={initAutocomplete}
            handleMapReady={handleMapReady}
            handleMarkerPositionChange={handleMarkerPositionChange}
            goToStep={goToStep}
          />
        )}
        
        {/* Step 2: Meeting Details */}
        {currentStep === 2 && (
          <MeetingDetailsStep
            group={group}
            setGroup={setGroup}
            goToStep={goToStep}
            setStatusMessage={setStatusMessage}
          />
        )}
        
        {/* Step 3: Contact and Leader Information */}
        {currentStep === 3 && (
          <ContactLeaderStep
            group={group}
            setGroup={setGroup}
            leaders={leaders}
            filteredLeaders={filteredLeaders}
            selectedLeaderId={selectedLeaderId}
            setSelectedLeaderId={setSelectedLeaderId}
            showLeaderDropdown={showLeaderDropdown}
            setShowLeaderDropdown={setShowLeaderDropdown}
            leaderDropdownRef={leaderDropdownRef}
            validationErrors={validationErrors}
            validateInstagramInput={validateInstagramInput}
            clearValidationError={clearValidationError}
            handleSubmit={handleSubmit}
            goToStep={goToStep}
            setFilteredLeaders={setFilteredLeaders}
          />
        )}
      </form>
      
      {/* Sticky help button */}
      <div className="fixed bottom-4 right-4">
        <button 
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
          aria-label="Ajuda"
          onClick={() => alert('Precisa de ajuda? Entre em contato com o administrador do sistema.')}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </button>
      </div>
    </>
  );
} 