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
  const [isValidatingInstagram, setIsValidatingInstagram] = useState<boolean>(false);
  const [isInstagramValid, setIsInstagramValid] = useState<boolean | null>(null);
  const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string }[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  
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
          curso: leader.curso || ''
        })));
      }
    } catch (error) {
      console.error("Erro ao buscar líderes:", error);
    }
  };

  // Função para atualizar coordenadas a partir do marcador
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
  }, [showLocationEdit, editingGroup, map, marker]);

  // Define initMap usando useCallback
  const initMap = useCallback(() => {
    if (mapRef.current && window.google && editingGroup) {
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
  }, [editingGroup, updateCoordinatesFromMarker, setMap, setMarker, setEditingGroup, setLocationSelected]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*');
      
      if (error) throw error;
      
      // Sort by university
      const groupsData = data as Group[];
      groupsData.sort((a, b) => a.university.localeCompare(b.university));
      
      setGroups(groupsData);
    } catch (error) {
      console.error("Erro ao buscar grupos:", error);
      setStatusMessage({ text: `Erro ao buscar grupos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

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
      // Check if the instagram username exists
      const profileUrl = `https://www.instagram.com/${cleanUsername.replace('@', '')}/?__a=1`;
      
      // Fazer uma requisição HEAD para verificar se o perfil existe
      await fetch(profileUrl, {
        method: 'HEAD'
      });
      
      // Se chegou aqui, o perfil existe
      setIsInstagramValid(true);
      
      if (editingGroup) {
        setEditingGroup({...editingGroup, instagram: cleanUsername});
      }
      
    } catch (error) {
      console.error("Erro ao validar o Instagram:", error);
      setIsInstagramValid(false);
    } finally {
      setIsValidatingInstagram(false);
    }
  };

  const deleteGroup = async (id: string, university: string) => {
    if (!confirm(`Tem certeza que deseja excluir o grupo em ${university}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Grupo em ${university} excluído com sucesso`, type: 'success' });
      fetchGroups();
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
      setStatusMessage({ text: `Erro ao excluir grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };
  
  const startEditing = (group: Group) => {
    setEditingGroup({...group});
    setIsInstagramValid(null);
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
    setIsInstagramValid(null);
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
          curso: selectedLeader.curso || ''
        },
        coordinates: editingGroup.coordinates,
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
      setIsInstagramValid(null);
      setShowLocationEdit(false);
      setLocationSelected(false);
      setSelectedLeaderId('');
      fetchGroups();
    } catch (error) {
      console.error("Erro ao atualizar grupo:", error);
      setStatusMessage({ text: `Erro ao atualizar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

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
                        onChange={(e) => {
                          setEditingGroup({...editingGroup, instagram: e.target.value});
                          if (isInstagramValid !== null) {
                            setIsInstagramValid(null);
                          }
                        }}
                        className={`w-full border p-2 rounded pl-6 ${
                          isInstagramValid === true ? 'border-green-500' : 
                          isInstagramValid === false ? 'border-red-500' : ''
                        }`}
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
                        onClick={() => validateInstagram(editingGroup.instagram)}
                        disabled={isValidatingInstagram || !editingGroup.instagram}
                      >
                        Verificar Perfil
                      </button>
                    </div>
                  </div>
                  
                  {/* Leader selection dropdown */}
                  <div>
                    <label className="block mb-1 text-sm">Líder</label>
                    <select
                      value={selectedLeaderId}
                      onChange={(e) => setSelectedLeaderId(e.target.value)}
                      className="w-full border p-2 rounded"
                      required
                    >
                      <option value="">Selecione um líder</option>
                      {leaders.map(leader => (
                        <option key={leader.id} value={leader.id}>
                          {leader.name} ({leader.phone}) - {leader.curso ? leader.curso : 'Sem Curso'}
                        </option>
                      ))}
                    </select>
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
        <h2 className="text-xl font-semibold mb-4">Todos os Grupos ({groups.length})</h2>
        
        {isLoading ? (
          <p className="text-gray-500">Carregando grupos...</p>
        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="border rounded shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-3 border-b">
                  <h3 className="font-bold">{group.university}</h3>
                  <p className="text-sm">{group.city}, {group.state}</p>
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
                  <button 
                    onClick={() => deleteGroup(group.id, group.university)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border rounded bg-gray-50">
            <p className="text-gray-500">Nenhum grupo foi adicionado ainda.</p>
            <Link href="/admin" className="text-blue-500 hover:underline mt-2 inline-block">
              Adicionar seu primeiro grupo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 