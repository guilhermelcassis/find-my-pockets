'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'location'>('details'); // For modal tabs
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  
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
      
      if (leadersData) {
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
        
        // If we're editing a group, we need to include its current leader in the available options
        // even if that leader is assigned to this group
        if (editingGroup && editingGroup.leader_id) {
          const currentEditingLeaderId = editingGroup.leader_id;
          
          // Filter out leaders that are already assigned to OTHER groups
          const availableLeaders = formattedLeaders.filter(
            leader => !assignedLeaderIds.includes(leader.id) || leader.id === currentEditingLeaderId
          );
          
          setLeaders(formattedLeaders);
          setFilteredLeaders(availableLeaders.filter(leader => leader.active !== false));
        } else {
          // Filter out leaders that are already assigned to any groups
          const availableLeaders = formattedLeaders.filter(
            leader => !assignedLeaderIds.includes(leader.id) && leader.active !== false
          );
          
          setLeaders(formattedLeaders);
          setFilteredLeaders(availableLeaders);
        }
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
  
  // Add validation function for the form
  const validateGroupForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!selectedLeaderId) {
      errors.leader = "É necessário selecionar um líder";
    }
    
    if (!editingGroup?.dayofweek) {
      errors.dayofweek = "Dia da semana é obrigatório";
    }
    
    if (!editingGroup?.time) {
      errors.time = "Horário é obrigatório";
    }
    
    if (!editingGroup?.instagram || editingGroup.instagram.trim() === '') {
      errors.instagram = "Instagram é obrigatório";
    } else if (editingGroup.instagram.startsWith('@')) {
      errors.instagram = "Não inclua o @ no início do nome de usuário";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEdits = async () => {
    if (!editingGroup) return;
    
    try {
      // Validate form
      if (!validateGroupForm()) {
        setStatusMessage({ text: "Corrija os erros no formulário antes de salvar", type: 'error' });
        return;
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
        instagram: editingGroup.instagram.startsWith('@') 
          ? editingGroup.instagram.substring(1) // Remove @ if user added it
          : editingGroup.instagram,
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
      setFormErrors({});
      setActiveTab('details');
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

  // Add this function to filter groups based on search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    
    const term = searchTerm.toLowerCase();
    return groups.filter(group => 
      group.university.toLowerCase().includes(term) ||
      group.city.toLowerCase().includes(term) ||
      group.state.toLowerCase().includes(term) ||
      group.leader.name.toLowerCase().includes(term) ||
      (group.leader.curso && group.leader.curso.toLowerCase().includes(term)) ||
      (group.location && group.location.toLowerCase().includes(term))
    );
  }, [groups, searchTerm]);

  // Auto-dismiss status messages after 5 seconds
  useEffect(() => {
    if (statusMessage && (statusMessage.type === 'success' || statusMessage.type === 'info')) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Add click outside handler for leader dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target as Node)) {
        setShowLeaderDropdown(false);
      }
    }

    // Add event listener when dropdown is open
    if (showLeaderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLeaderDropdown]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Grupos</h1>
        <Link href="/admin" className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded">
          Voltar para Administração
        </Link>
      </div>
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded shadow-sm transition-all duration-300 ${
          statusMessage.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 
          statusMessage.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' : 
          'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
        }`}>
          {statusMessage.text}
        </div>
      )}
      
      {/* Improved Editing Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar Grupo</h2>
            
            {/* Tabs */}
            <div className="flex border-b mb-4">
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'details' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('details')}
              >
                Detalhes do Grupo
              </button>
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'location' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('location')}
              >
                Localização
              </button>
            </div>
            
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm">
                      Dia da Semana <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingGroup.dayofweek}
                      onChange={(e) => setEditingGroup({...editingGroup, dayofweek: e.target.value})}
                      className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                        formErrors.dayofweek ? 'border-red-500 bg-red-50' : ''
                      }`}
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
                    {formErrors.dayofweek && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.dayofweek}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm">
                      Horário <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={editingGroup.time}
                      onChange={(e) => setEditingGroup({...editingGroup, time: e.target.value})}
                      className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                        formErrors.time ? 'border-red-500 bg-red-50' : ''
                      }`}
                    />
                    {formErrors.time && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.time}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm">Tipo</label>
                    <select
                      value={editingGroup.tipo || 'Publica'}
                      onChange={(e) => setEditingGroup({...editingGroup, tipo: e.target.value})}
                      className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
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
                      className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ex: Bloco A, Sala 101"
                    />
                    <p className="text-xs text-gray-500 mt-1">Local específico dentro da universidade</p>
                  </div>
                </div>
                
                <div>
                  <label className="block mb-1 text-sm">
                    Instagram <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editingGroup.instagram}
                      onChange={(e) => setEditingGroup({...editingGroup, instagram: e.target.value})}
                      className={`w-full border p-2 rounded pl-6 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                        formErrors.instagram ? 'border-red-500 bg-red-50' : ''
                      }`}
                      placeholder="usuariodoinstagram"
                    />
                    <span className="absolute left-2 top-2.5 text-gray-500">@</span>
                  </div>
                  {formErrors.instagram ? (
                    <p className="text-sm text-red-600 mt-1">{formErrors.instagram}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Informe apenas o nome de usuário, sem o @</p>
                  )}
                </div>
                
                {/* Leader selection dropdown - Improved */}
                <div>
                  <label className="block mb-1 text-sm">
                    Líder <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={leaderDropdownRef}>
                    <input 
                      type="text" 
                      className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                        formErrors.leader ? 'border-red-500 bg-red-50' : ''
                      }`}
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
                                  // Clear any leader selection error
                                  if (formErrors.leader) {
                                    const newErrors = {...formErrors};
                                    delete newErrors.leader;
                                    setFormErrors(newErrors);
                                  }
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
                            Nenhum líder disponível encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Display currently selected leader */}
                  {selectedLeaderId ? (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded">
                      <div className="text-sm">
                        {(() => {
                          const selected = leaders.find(l => l.id === selectedLeaderId);
                          return selected ? (
                            <div className="flex justify-between">
                              <div>
                                <span className="font-medium">Líder:</span> {selected.name} 
                                <div className="text-xs text-gray-600">
                                  {selected.phone}
                                  {selected.curso && <span> • {selected.curso}</span>}
                                </div>
                              </div>
                              <button 
                                type="button" 
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => {
                                  setSelectedLeaderId('');
                                  setFormErrors({...formErrors, leader: "É necessário selecionar um líder"});
                                }}
                                aria-label="Remover líder"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                              </button>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  ) : (
                    formErrors.leader && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.leader}</p>
                    )
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    Digite o nome ou curso para buscar um líder disponível
                  </p>
                </div>
              </div>
            )}
            
            {/* Location Tab */}
            {activeTab === 'location' && (
              <div>
                {!showLocationEdit ? (
                  <>
                    {/* Location details - read only section */}
                    <div className="bg-gray-50 p-4 rounded border mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Detalhes da Localização</h3>
                        <button 
                          onClick={() => setShowLocationEdit(true)}
                          className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
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
                      </div>
                      
                      {editingGroup.fulladdress && (
                        <div className="mt-3 bg-white p-3 rounded shadow-sm">
                          <h4 className="text-sm text-gray-500">Endereço Completo</h4>
                          <p className="font-medium text-sm">{editingGroup.fulladdress}</p>
                        </div>
                      )}
                      
                      <div className="mt-3 bg-white p-3 rounded shadow-sm">
                        <h4 className="text-sm text-gray-500">Coordenadas</h4>
                        <p className="font-medium text-sm">
                          Lat: {editingGroup.coordinates.latitude.toFixed(6)}, 
                          Lng: {editingGroup.coordinates.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Google Maps Location Picker */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold">Alterar Localização</h3>
                        <button 
                          onClick={() => setShowLocationEdit(false)}
                          className="text-sm bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400 transition-colors"
                        >
                          Cancelar Alteração
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block mb-1 text-sm">Buscar Universidade</label>
                        <input 
                          ref={autocompleteInputRef}
                          type="text" 
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all" 
                          placeholder="Pesquisar por universidade ou faculdade" 
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Digite o nome da universidade ou faculdade e selecione nas opções
                        </p>
                      </div>
                      
                      <div ref={mapRef} className="w-full h-[350px] border rounded"></div>
                      <p className="text-sm text-gray-600 mt-2">
                        Utilize a busca acima para encontrar a localização exata da universidade.
                      </p>
                      
                      {locationSelected && (
                        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">
                          <p className="font-medium">Nova localização selecionada:</p>
                          <p>{editingGroup.university}, {editingGroup.city}, {editingGroup.state}</p>
                          <p className="text-sm mt-1">Para salvar esta localização, volte para a aba de detalhes e clique em "Salvar Alterações".</p>
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
              </div>
            )}
            
            {/* Footer actions */}
            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button 
                onClick={cancelEditing}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveEdits}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-3">Todos os Grupos ({filteredGroups.length})</h2>
          
          {/* Add search input */}
          <div className="mb-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar por universidade, cidade, líder..."
                className="pl-10 w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filter dropdown */}
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
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-500">Carregando grupos...</span>
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map(group => (
              <div key={group.id} className={`border rounded shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${!group.active ? 'bg-gray-50 opacity-75' : ''}`}>
                <div className={`${group.active ? 'bg-blue-50' : 'bg-gray-200'} p-3 border-b flex justify-between items-center`}>
                  <div>
                    <h3 className="font-bold">{group.university}</h3>
                    <p className="text-sm text-gray-600">{group.city}, {group.state}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {group.tipo === "Privada" && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full border border-purple-200">
                        Privada
                      </span>
                    )}
                    {!group.active && (
                      <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="flex items-start">
                    <div className="text-blue-500 mr-2 mt-0.5 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Localização</div>
                      <div className="text-sm text-gray-600">{group.location}</div>
                      {group.local && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Local:</span> {group.local}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="text-indigo-500 mr-2 mt-0.5 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Encontros</div>
                      <div className="text-sm text-gray-600">{group.dayofweek} às {group.time}</div>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="text-pink-500 mr-2 mt-0.5 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Instagram</div>
                      <a 
                        href={`https://instagram.com/${group.instagram}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        @{group.instagram}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="text-green-500 mr-2 mt-0.5 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Líder</div>
                      <div className="text-sm text-gray-600">
                        {group.leader.name}
                        <div className="text-xs text-gray-500">
                          {group.leader.phone}
                          {group.leader.curso && ` • ${group.leader.curso}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 border-t flex justify-end space-x-3">
                  <button 
                    onClick={() => startEditing(group)}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition duration-200 flex items-center text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  
                  {group.active ? (
                    <button 
                      onClick={() => deactivateGroup(group.id, group.university)}
                      className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition duration-200 flex items-center text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Desativar
                    </button>
                  ) : (
                    <button 
                      onClick={() => reactivateGroup(group.id, group.university)}
                      className="text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition duration-200 flex items-center text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Reativar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border rounded bg-gray-50">
            <p className="text-gray-500">
              {searchTerm ? 'Nenhum grupo encontrado com este termo de busca.' :
               filterActive === 'active' ? 'Nenhum grupo ativo encontrado.' :
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