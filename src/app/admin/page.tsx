// app/(admin)/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Group } from '../../lib/interfaces';
import { db } from '../../lib/supabase';
import Link from 'next/link';

// Flag to prevent duplicate Google Maps loading
declare global {
  // Tipagem será herdada de src/components/Map.tsx que já tem a tipagem correta
  interface Window {
    googleMapsLoaded: boolean;
  }
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

    // Implementação do initMap usando useCallback
    const initMap = useCallback(() => {
        if (mapRef.current && window.google) {
            // Define the updateCoordinatesFromMarker function inside the callback
            const updateCoordinatesFromMarker = (position: google.maps.LatLng) => {
                const lat = position.lat();
                const lng = position.lng();
                
                setGroup((prev: Group) => ({
                    ...prev,
                    coordinates: {
                        latitude: lat,
                        longitude: lng
                    }
                }));
            };
            
            // Default to a central position (can be changed)
            const defaultLocation = { lat: -24.65236500245874, lng: -47.87912740708651 };
            
            const newMap = new window.google.maps.Map(mapRef.current, {
                center: defaultLocation,
                zoom: 7,
                mapTypeControl: true,
            });
            
            setMap(newMap);
            
            // Initialize the marker
            const newMarker = new window.google.maps.Marker({
                position: defaultLocation,
                map: newMap,
                draggable: true,
            });
            
            setMarker(newMarker);
            
            // Add click listener to the map
            newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
                if (e.latLng) {
                    newMarker.setPosition(e.latLng);
                    updateCoordinatesFromMarker(e.latLng);
                }
            });
            
            // Add drag end listener to the marker
            newMarker.addListener('dragend', () => {
                const position = newMarker.getPosition();
                if (position) {
                    updateCoordinatesFromMarker(position);
                }
            });
            
            // Initialize Places Autocomplete with the new API
            if (autocompleteInputRef.current) {
                // Create autocomplete with university bias
                const autocompleteOptions = {
                    types: ['university', 'school'],
                    fields: ['name', 'address_components', 'geometry', 'formatted_address']
                };
                
                const autocomplete = new window.google.maps.places.Autocomplete(
                    autocompleteInputRef.current,
                    autocompleteOptions
                );
                
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    console.log("Local selecionado:", place); // For debugging
                    
                    if (place.geometry && place.geometry.location) {
                        // Update the map
                        newMap.setCenter(place.geometry.location);
                        newMap.setZoom(14);
                        
                        // Update the marker
                        newMarker.setPosition(place.geometry.location);
                        
                        // Update coordinates
                        updateCoordinatesFromMarker(place.geometry.location);
                        
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
                        
                        console.log("Dados extraídos:", { 
                            university, 
                            city, 
                            state, 
                            country, 
                            zipcode,
                            fulladdress
                        }); // For debugging
                        
                        // Update form with the extracted data
                        setGroup((prev: Group) => ({
                            ...prev,
                            university: university,
                            city: city || prev.city,
                            state: state || prev.state,
                            country: country || prev.country,
                            location: university, // Set location as the university name
                            fulladdress: fulladdress, // Add full address
                            zipcode: zipcode, // Add zipCode
                            tipo: '',
                            local: '',
                        }));
                        
                        // Mark that a location has been selected to make fields read-only
                        setLocationSelected(true);
                    }
                });
            }
        }
    }, [setGroup, setMap, setMarker, setLocationSelected]);

    // Update useEffect to include initMap in the dependency array
    useEffect(() => {
        if (showMap) {
            const loadGoogleMaps = () => {
                // Check if Google Maps is already loaded
                if (!window.google && !window.googleMapsLoaded) {
                    // Set flag to prevent duplicate loads
                    window.googleMapsLoaded = true;
                    
                    const script = document.createElement('script');
                    // Use the new Places API
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=beta`;
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                    
                    script.onload = initMap;
                } else if (window.google) {
                    initMap();
                }
            };
            
            loadGoogleMaps();
            
            // Cleanup function
            return () => {
                if (map) {
                    // Google Maps doesn't have unbindAll method
                    setMap(null);
                }
                if (marker) {
                    marker.setMap(null);
                }
            };
        }
    }, [showMap, map, marker, initMap]);

    // Fetch leaders
    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const { data: leadersData, error } = await db
                  .from('leaders')
                  .select('*');
                
                if (error) throw error;
                
                if (leadersData) {
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
        // Mostrar mapa após buscar os líderes
        setShowMap(true);
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
                />
                {locationSelected && (
                    <button 
                        className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                        onClick={() => setLocationSelected(false)}
                    >
                        Alterar Localização
                    </button>
                )}
            </div>
            
            <div className="mb-6">
                <div ref={mapRef} className="w-full h-[400px] border rounded"></div>
                <p className="text-sm text-gray-600 mt-2">Clique no mapa ou arraste o marcador para definir a localização exata.</p>
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
    );
};

export default AdminPage;