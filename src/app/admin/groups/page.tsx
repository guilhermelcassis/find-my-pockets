'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { Group } from '../../../lib/interfaces';

// Flag to prevent duplicate Google Maps loading
declare global {
  // Tipagem será herdada de src/components/Map.tsx que já tem a tipagem correta
  interface Window {
    googleMapsLoaded: boolean;
  }
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState<boolean>(false);
  const [filteredLeaders, setFilteredLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean }[]>([]);
  const leaderDropdownRef = useRef<HTMLDivElement>(null); // Ref for the leader dropdown
  
  // Google Maps related states
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [locationSelected, setLocationSelected] = useState<boolean>(false);
  const [showLocationEdit, setShowLocationEdit] = useState<boolean>(false);

  // Fetch groups and leaders on component mount
  useEffect(() => {
    fetchGroups();
    fetchLeaders();
  }, []);

  // Fetch leaders
  const fetchLeaders = async () => {
    try {
      const { data: leadersData, error } = await supabase
        .from('leaders')
        .select('*');
      
      if (error) throw error;
      
      if (leadersData) {
        setLeaders(leadersData.map(leader => ({
          id: leader.id,
          name: leader.name,
          phone: leader.phone,
          email: leader.email || '',
          curso: leader.curso || '',
          active: leader.active ?? true
        })));
      }
    } catch (error) {
      console.error("Erro ao buscar líderes:", error);
    }
  };

  // Define initMap with useCallback before it's used in the useEffect
  const initMap = useCallback(() => {
    if (mapRef.current && window.google && editingGroup) {
      // Function to update coordinates from marker position
      const updateCoordinatesFromMarker = (position: google.maps.LatLng) => {
        if (editingGroup) {
          const lat = position.lat();
          const lng = position.lng();
          
          setEditingGroup({
            ...editingGroup,
            coordinates: {
              latitude: lat,
              longitude: lng
            }
          });
        }
      };
      
      // Use current coordinates from the editing group
      const currentLocation = { 
        lat: editingGroup.coordinates.latitude, 
        lng: editingGroup.coordinates.longitude 
      };
      
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: currentLocation,
        zoom: 14,
        mapTypeControl: true,
      });
      
      setMap(newMap);
      
      // Initialize the marker
      const newMarker = new window.google.maps.Marker({
        position: currentLocation,
        map: newMap,
        draggable: false,
        title: "Localização selecionada"
      });
      
      setMarker(newMarker);
      
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
            
            if (editingGroup) {
              // Update form with the extracted data
              setEditingGroup({
                ...editingGroup,
                university: university,
                city: city || editingGroup.city,
                state: state || editingGroup.state,
                country: country || editingGroup.country,
                location: university, // Set location as the university name
                fulladdress: fulladdress, // Add full address
                zipcode: zipcode, // Add zipcode
              });
            }
            
            // Mark that a location has been selected
            setLocationSelected(true);
          }
        });
      }
    }
  }, [editingGroup, setMap, setMarker, setEditingGroup, setLocationSelected]);

  // Initialize Google Maps
  useEffect(() => {
    if (showLocationEdit && editingGroup) {
      const loadGoogleMaps = () => {
        // Check if Google Maps is already loaded to prevent multiple loads
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
          setMap(null);
        }
        if (marker) {
          setMarker(null);
        }
      };
    }
  }, [showLocationEdit, editingGroup, map, marker, initMap]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*');
      
      if (error) throw error;
      
      // Sort by university
      const groupsData = data as Group[];
      
      // Make sure active is set for all groups (default to true if not specified)
      groupsData.forEach(group => {
        if (group.active === undefined) {
          group.active = true;
        }
      });
      
      // Filter groups based on active status
      let filteredGroups = groupsData;
      if (filterActive === 'active') {
        filteredGroups = groupsData.filter(group => group.active !== false);
      } else if (filterActive === 'inactive') {
        filteredGroups = groupsData.filter(group => group.active === false);
      }
      
      // Sort by university
      filteredGroups.sort((a, b) => a.university.localeCompare(b.university));
      
      setGroups(filteredGroups);
    } catch (error) {
      console.error("Erro ao buscar grupos:", error);
      setStatusMessage({ text: `Erro ao buscar grupos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const deactivateGroup = async (id: string, university: string) => {
    if (!confirm(`Tem certeza que deseja desativar o grupo em ${university}? Você poderá reativá-lo depois.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Grupo em ${university} desativado com sucesso`, type: 'success' });
      fetchGroups();
    } catch (error) {
      console.error("Erro ao desativar grupo:", error);
      setStatusMessage({ text: `Erro ao desativar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };
  
  const reactivateGroup = async (id: string, university: string) => {
    if (!confirm(`Deseja reativar o grupo em ${university}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .update({ active: true })
        .eq('id', id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Grupo em ${university} reativado com sucesso`, type: 'success' });
      fetchGroups();
    } catch (error) {
      console.error("Erro ao reativar grupo:", error);
      setStatusMessage({ text: `Erro ao reativar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };
  
  const startEditing = (group: Group) => {
    setEditingGroup({...group});
    setShowLocationEdit(false);
    setLocationSelected(false);
    
    // Find the leader ID based on the leader data in the group
    const leaderInGroup = group.leader;
    const foundLeader = leaders.find(leader => 
      leader.name === leaderInGroup.name && 
      leader.phone === leaderInGroup.phone
    );
    
    if (foundLeader) {
      setSelectedLeaderId(foundLeader.id);
    } else {
      setSelectedLeaderId('');
    }
  };
  
  const cancelEditing = () => {
    setEditingGroup(null);
    setShowLocationEdit(false);
    setLocationSelected(false);
    setSelectedLeaderId('');
  };
  
  const saveEdits = async () => {
    if (!editingGroup) return;
    
    try {
      // Validate required fields
      if (!selectedLeaderId) {
        throw new Error("Por favor, selecione um líder");
      }
      
      // Find the selected leader
      const selectedLeader = leaders.find(leader => leader.id === selectedLeaderId);
      if (!selectedLeader) {
        throw new Error("Líder selecionado não encontrado");
      }
      
      // Prepare update data with all editable fields
      const updateData = {
        dayofweek: editingGroup.dayofweek,
        time: editingGroup.time,
        instagram: editingGroup.instagram,
        tipo: editingGroup.tipo || 'Publica',
        local: editingGroup.local || '',
        leader: {
          name: selectedLeader.name,
          phone: selectedLeader.phone,
          email: selectedLeader.email || '',
          curso: selectedLeader.curso || '',
          active: selectedLeader.active ?? true
        },
        leader_id: selectedLeaderId,
        coordinates: editingGroup.coordinates,
        active: editingGroup.active ?? true,
        updated_at: new Date().toISOString()
      };
      
      // If university was changed, update related fields
      if (locationSelected) {
        Object.assign(updateData, {
          university: editingGroup.university,
          city: editingGroup.city,
          state: editingGroup.state,
          country: editingGroup.country,
          location: editingGroup.university, // Set location same as university name
          fulladdress: editingGroup.fulladdress || '',
          zipcode: editingGroup.zipcode || '',
        });
      }
      
      const { error } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', editingGroup.id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Grupo em ${editingGroup.university} atualizado com sucesso`, type: 'success' });
      setEditingGroup(null);
      setShowLocationEdit(false);
      setLocationSelected(false);
      setSelectedLeaderId('');
      fetchGroups();
    } catch (error) {
      console.error("Erro ao atualizar grupo:", error);
      setStatusMessage({ text: `Erro ao atualizar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

  // Add effect to refetch groups when filter changes
  useEffect(() => {
    fetchGroups();
  }, [filterActive]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Grupos</h1>
        <Link href="/admin" className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded">
          Voltar para Administração
        </Link>
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
      
      {/* Editing Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar Grupo</h2>
            
            {!showLocationEdit ? (
              <>
                {/* Location details - read only section */}
                <div className="bg-gray-50 p-4 rounded border mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Detalhes da Localização</h3>
                    <button 
                      onClick={() => setShowLocationEdit(true)}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Alterar Localização
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded shadow-sm">
                      <h4 className="text-sm text-gray-500">Universidade</h4>
                      <p className="font-medium">{editingGroup.university}</p>
                    </div>
                    
                    <div className="bg-white p-3 rounded shadow-sm">
                      <h4 className="text-sm text-gray-500">Cidade</h4>
                      <p className="font-medium">{editingGroup.city}</p>
                    </div>
                    
                    <div className="bg-white p-3 rounded shadow-sm">
                      <h4 className="text-sm text-gray-500">Estado</h4>
                      <p className="font-medium">{editingGroup.state}</p>
                    </div>
                    
                    <div className="bg-white p-3 rounded shadow-sm">
                      <h4 className="text-sm text-gray-500">País</h4>
                      <p className="font-medium">{editingGroup.country}</p>
                    </div>
                    
                    <div className="bg-white p-3 rounded shadow-sm">
                      <h4 className="text-sm text-gray-500">Localização</h4>
                      <p className="font-medium">{editingGroup.location}</p>
                    </div>
                    
                    {editingGroup.fulladdress && (
                      <div className="bg-white p-3 rounded shadow-sm">
                        <h4 className="text-sm text-gray-500">Endereço Completo</h4>
                        <p className="font-medium text-sm">{editingGroup.fulladdress}</p>
                      </div>
                    )}
                    
                    <div className="bg-white p-3 rounded shadow-sm col-span-2">
                      <h4 className="text-sm text-gray-500">Coordenadas</h4>
                      <p className="font-medium text-sm">
                        Lat: {editingGroup.coordinates.latitude.toFixed(6)}, 
                        Lng: {editingGroup.coordinates.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Editable fields */}
                <div className="space-y-4">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm">Dia da Semana</label>
                      <select
                        value={editingGroup.dayofweek}
                        onChange={(e) => setEditingGroup({...editingGroup, dayofweek: e.target.value})}
                        className="w-full border p-2 rounded"
                      >
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
                      <label className="block mb-1 text-sm">Horário</label>
                      <input
                        type="time"
                        value={editingGroup.time}
                        onChange={(e) => setEditingGroup({...editingGroup, time: e.target.value})}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm">Tipo</label>
                      <select
                        value={editingGroup.tipo || 'Publica'}
                        onChange={(e) => setEditingGroup({...editingGroup, tipo: e.target.value})}
                        className="w-full border p-2 rounded"
                      >
                        <option value="Publica">Pública</option>
                        <option value="Privada">Privada</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block mb-1 text-sm">Local</label>
                      <input
                        type="text"
                        value={editingGroup.local || ''}
                        onChange={(e) => setEditingGroup({...editingGroup, local: e.target.value})}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm">Instagram</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editingGroup.instagram}
                        onChange={(e) => setEditingGroup({...editingGroup, instagram: e.target.value})}
                        className="w-full border p-2 rounded pl-6"
                      />
                      <span className="absolute left-2 top-2.5 text-gray-500">@</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Informe o nome de usuário do Instagram</p>
                  </div>
                  
                  {/* Leader selection dropdown */}
                  <div>
                    <label className="block mb-1 text-sm">Líder</label>
                    <div className="relative" ref={leaderDropdownRef}>
                      <input 
                        type="text" 
                        className="w-full border p-2 rounded"
                        placeholder="Buscar líder por nome..."
                        onFocus={() => {
                          setShowLeaderDropdown(true);
                          // Initialize filtered leaders if empty
                          if (filteredLeaders.length === 0) {
                            setFilteredLeaders(leaders.filter(leader => leader.active !== false));
                          }
                        }}
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
                              )
                            );
                            setFilteredLeaders(filtered);
                          }
                          
                          // Show dropdown when typing
                          setShowLeaderDropdown(true);
                        }}
                      />
                      
                      {/* Dropdown Icon */}
                      <div 
                        className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
                        onClick={() => setShowLeaderDropdown(!showLeaderDropdown)}
                      >
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
                    
                    {/* Display currently selected leader */}
                    {selectedLeaderId && (
                      <div className="mt-2 p-1 bg-blue-50 border border-blue-100 rounded">
                        <div className="text-xs">
                          {(() => {
                            const selected = leaders.find(l => l.id === selectedLeaderId);
                            return selected ? (
                              <div>
                                <span className="font-medium">Líder:</span> {selected.name} ({selected.phone})
                                {selected.curso && <span> • {selected.curso}</span>}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1">
                      Digite o nome do líder, telefone ou curso para buscar
                    </p>
                    
                    <p className="text-xs text-gray-500 mt-1">
                      Escolha um líder para este grupo
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Google Maps Location Picker */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Alterar Localização</h3>
                    <button 
                      onClick={() => setShowLocationEdit(false)}
                      className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
                    >
                      Cancelar Alteração
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block mb-1">Buscar Universidade</label>
                    <input 
                      ref={autocompleteInputRef}
                      type="text" 
                      className="w-full border p-2 rounded" 
                      placeholder="Pesquisar por universidade" 
                    />
                  </div>
                  
                  <div ref={mapRef} className="w-full h-[300px] border rounded"></div>
                  <p className="text-sm text-gray-600 mt-2">
                    Clique no mapa ou arraste o marcador para definir a localização exata.
                  </p>
                  
                  {locationSelected && (
                    <div className="mt-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">
                      <p className="font-medium">Nova localização selecionada:</p>
                      <p>{editingGroup.university}, {editingGroup.city}, {editingGroup.state}</p>
                      <p className="text-sm mt-1">Clique em &quot;Aplicar Alteração&quot; para usar esta localização.</p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => setShowLocationEdit(false)}
                      disabled={!locationSelected}
                      className={`px-4 py-2 rounded ${
                        locationSelected 
                          ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Aplicar Alteração
                    </button>
                  </div>
                </div>
              </>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button 
                onClick={cancelEditing}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={saveEdits}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Todos os Grupos ({groups.length})</h2>
          
          {/* Add filter dropdown */}
          <div className="flex items-center space-x-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">Exibir:</label>
            <select 
              id="status-filter"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
        
        {isLoading ? (
          <p className="text-gray-500">Carregando grupos...</p>
        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className={`border rounded shadow-sm overflow-hidden ${!group.active ? 'bg-gray-50 opacity-75' : ''}`}>
                <div className={`${group.active ? 'bg-gray-50' : 'bg-gray-200'} p-3 border-b flex justify-between items-center`}>
                  <div>
                    <h3 className="font-bold">{group.university}</h3>
                    <p className="text-sm">{group.city}, {group.state}</p>
                  </div>
                  {!group.active && (
                    <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">Inativo</span>
                  )}
                </div>
                
                <div className="p-3 space-y-2">
                  <p>
                    <span className="font-medium">Localização:</span> {group.location}
                  </p>
                  {group.local && (
                    <p>
                      <span className="font-medium">Local:</span> {group.local}
                    </p>
                  )}
                  {group.fulladdress && (
                    <p>
                      <span className="font-medium">Endereço:</span> <span className="text-sm">{group.fulladdress}</span>
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Encontros:</span> {group.dayofweek} às {group.time}
                  </p>
                  <p>
                    <span className="font-medium">Tipo:</span> {group.tipo === 'Publica' ? 'Pública' : 'Privada'}
                  </p>
                  <p>
                    <span className="font-medium">Instagram:</span> {group.instagram}
                  </p>
                  <p>
                    <span className="font-medium">Líder:</span> {group.leader.name} ({group.leader.phone})
                    {group.leader.email && ` • ${group.leader.email}`}
                  </p>
                  {group.leader.curso && (
                    <p>
                      <span className="font-medium">Curso do Líder:</span> {group.leader.curso}
                    </p>
                  )}
                </div>
                
                <div className="bg-gray-50 p-3 border-t flex justify-end space-x-2">
                  <button 
                    onClick={() => startEditing(group)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </button>
                  
                  {group.active ? (
                    <button 
                      onClick={() => deactivateGroup(group.id, group.university)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Desativar
                    </button>
                  ) : (
                    <button 
                      onClick={() => reactivateGroup(group.id, group.university)}
                      className="text-green-600 hover:text-green-800"
                    >
                      Reativar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border rounded bg-gray-50">
            <p className="text-gray-500">
              {filterActive === 'active' ? 'Nenhum grupo ativo encontrado.' :
               filterActive === 'inactive' ? 'Nenhum grupo inativo encontrado.' :
               'Nenhum grupo foi adicionado ainda.'}
            </p>
            <Link href="/admin" className="text-blue-500 hover:underline mt-2 inline-block">
              Adicionar seu primeiro grupo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 