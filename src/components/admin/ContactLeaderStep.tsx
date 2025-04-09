'use client';

import { Dispatch, SetStateAction, RefObject, useState, useEffect, ReactNode } from 'react';
import { Group, Leader } from '@/lib/interfaces';

// Define an extended interface for leaders with IDs (from database)
interface LeaderWithId extends Leader {
  id: string;
}

interface ContactLeaderStepProps {
  group: Group;
  setGroup: Dispatch<SetStateAction<Group>>;
  leaders: LeaderWithId[];
  filteredLeaders: LeaderWithId[];
  selectedLeaderId: string;
  setSelectedLeaderId: Dispatch<SetStateAction<string>>;
  showLeaderDropdown: boolean;
  setShowLeaderDropdown: Dispatch<SetStateAction<boolean>>;
  leaderDropdownRef: RefObject<HTMLDivElement | null>;
  validationErrors: {[key: string]: string};
  validateInstagramInput: (value: string) => boolean;
  clearValidationError: (field: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  goToStep: (step: number) => void;
  setFilteredLeaders: Dispatch<SetStateAction<LeaderWithId[]>>;
}

export default function ContactLeaderStep({
  group,
  setGroup,
  leaders,
  filteredLeaders,
  selectedLeaderId,
  setSelectedLeaderId,
  showLeaderDropdown,
  setShowLeaderDropdown,
  leaderDropdownRef,
  validationErrors,
  validateInstagramInput,
  clearValidationError,
  handleSubmit,
  goToStep,
  setFilteredLeaders
}: ContactLeaderStepProps) {
  // Initialize searchTerm with selected leader's name if available
  const [searchTerm, setSearchTerm] = useState(() => {
    if (selectedLeaderId) {
      const selectedLeader = leaders.find(l => l.id === selectedLeaderId);
      return selectedLeader ? selectedLeader.name : '';
    }
    return '';
  });
  
  // Update searchTerm when selectedLeaderId changes
  useEffect(() => {
    if (selectedLeaderId) {
      const selectedLeader = leaders.find(l => l.id === selectedLeaderId);
      if (selectedLeader) {
        setSearchTerm(selectedLeader.name);
      }
    }
  }, [selectedLeaderId, leaders]);
  
  // Function to highlight matching text in search results
  const highlightMatch = (text: string, query: string): ReactNode => {
    if (!query || query.trim() === '') {
      return text;
    }
    
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <span key={index} className="bg-yellow-200 font-medium">{part}</span> 
            : part
        )}
      </>
    );
  };
  
  // Close dropdown when clicking outside
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
  }, [setShowLeaderDropdown]);
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-2">Passo 3: Contato e Líder</h2>
      
      <div className="bg-gray-50 p-4 rounded border">
        <h3 className="font-medium mb-3">Informações de Contato</h3>
        
        <div className="mb-4">
          <label className="block mb-1 font-medium">Instagram <span className="text-red-500">*</span></label>
          <div className="relative">
            <input 
              type="text" 
              value={group.instagram}
              className={`w-full border p-2 rounded pl-6 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                validationErrors.instagram ? 'border-red-500 bg-red-50' : ''
              }`} 
              placeholder="usuário" 
              onChange={(e) => {
                // Remove @ if user types it
                const value = e.target.value.startsWith('@') 
                    ? e.target.value.substring(1) 
                    : e.target.value;
                
                setGroup({ ...group, instagram: value });
                validateInstagramInput(value);
              }}
              onBlur={() => validateInstagramInput(group.instagram)}
              onFocus={() => clearValidationError('instagram')}
              required
            />
            <span className="absolute left-2 top-2.5 text-gray-500">@</span>
            
            {/* Add validation icon */}
            {group.instagram && (
              <span className="absolute right-2 top-2.5">
                {validationErrors.instagram ? (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </span>
            )}
          </div>
          {validationErrors.instagram ? (
            <p className="text-sm text-red-600 mt-1">{validationErrors.instagram}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Informe apenas o nome de usuário, sem o @</p>
          )}
        </div>

        <div>
          <label className="block mb-1 font-medium">Líder <span className="text-red-500">*</span></label>
          
          {/* Searchable Leader Dropdown */}
          <div className="relative" ref={leaderDropdownRef}>
            {/* Leader Selection Input with Autocomplete */}
            <div className="relative">
              <input 
                type="text" 
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all pr-8 ${
                  selectedLeaderId ? 'border-green-400' : ''
                }`}
                placeholder="Selecione um líder"
                value={searchTerm}
                onChange={(e) => {
                  // Update search term state
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // Clear selected leader ID if search term is changed after selection
                  if (selectedLeaderId && value !== leaders.find(l => l.id === selectedLeaderId)?.name) {
                    setSelectedLeaderId('');
                  }
                  
                  // Filter leaders based on input
                  const searchTerm = value.toLowerCase();
                  
                  // Filter the leaders array based on the search term
                  const filtered = leaders
                    .filter(leader => leader.active !== false) // Only include active leaders
                    .filter(leader => {
                      const name = leader.name.toLowerCase();
                      const phone = leader.phone?.toLowerCase() || '';
                      const curso = leader.curso?.toLowerCase() || '';
                      
                      return name.includes(searchTerm) || 
                             phone.includes(searchTerm) || 
                             curso.includes(searchTerm);
                    });
                  
                  // Sort filtered leaders alphabetically
                  const sortedFiltered = [...filtered].sort((a, b) => 
                    a.name.localeCompare(b.name)
                  );
                  
                  // Update the filteredLeaders state in the parent component
                  setFilteredLeaders(sortedFiltered);
                  
                  // Show dropdown when typing
                  setShowLeaderDropdown(true);
                }}
                onFocus={() => {
                  // When focusing on the input, reset the filtered leaders to show all active leaders
                  const activeLeaders = [...leaders]
                    .filter(l => l.active !== false)
                    .sort((a, b) => a.name.localeCompare(b.name));
                    
                  setFilteredLeaders(activeLeaders);
                  setShowLeaderDropdown(true);
                }}
                aria-label="Buscar líder por nome, telefone ou curso"
              />
              
              {/* Clear Search Button */}
              {searchTerm && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-8 flex items-center px-2 text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedLeaderId('');
                    // Reset filteredLeaders to all available leaders, sorted alphabetically
                    setFilteredLeaders([...leaders].filter(l => l.active !== false).sort((a, b) => a.name.localeCompare(b.name)));
                    // Focus on input after clearing
                    setTimeout(() => {
                      const inputEl = leaderDropdownRef.current?.querySelector('input');
                      if (inputEl) inputEl.focus();
                    }, 0);
                  }}
                  aria-label="Limpar busca"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
            
            {/* Dropdown Icon */}
            <div 
              className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer" 
              onClick={() => {
                // If dropdown is not shown, reset the filtered leaders to show all active leaders alphabetically
                if (!showLeaderDropdown) {
                  setFilteredLeaders([...leaders]
                    .filter(l => l.active !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
                  );
                }
                setShowLeaderDropdown(!showLeaderDropdown);
              }}
            >
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showLeaderDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            
            {/* Dropdown Menu */}
            {showLeaderDropdown && (
              <div 
                className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                ref={leaderDropdownRef}
              >
                {filteredLeaders.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    No leaders found
                  </div>
                ) : (
                  <>
                    {searchTerm && (
                      <div className="px-3 py-1 text-xs text-gray-500">
                        Found {filteredLeaders.length} leader{filteredLeaders.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {filteredLeaders.map((leader) => (
                      <div
                        key={leader.id}
                        className={`relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 ${
                          selectedLeaderId === leader.id ? 'bg-indigo-100' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setSelectedLeaderId(leader.id);
                          setShowLeaderDropdown(false);
                          setSearchTerm(leader.name);
                        }}
                      >
                        <div className="flex items-center">
                          <span className="flex items-center">
                            <span className="font-medium">{highlightMatch(leader.name, searchTerm)}</span>
                            {leader.curso && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({highlightMatch(leader.curso, searchTerm)})
                              </span>
                            )}
                          </span>
                          {leader.phone && (
                            <span className="ml-2 truncate text-xs text-gray-500">
                              {highlightMatch(leader.phone, searchTerm)}
                            </span>
                          )}
                        </div>
                        {selectedLeaderId === leader.id && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-1">
            Digite o nome do líder, telefone ou curso para buscar
          </p>
          
          {/* Show filter count when searching */}
          {searchTerm && !selectedLeaderId && filteredLeaders.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Mostrando {filteredLeaders.length} {filteredLeaders.length === 1 ? 'líder' : 'líderes'}
            </p>
          )}
          
          {/* Display selected leader information in a small badge */}
          {selectedLeaderId && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded">
              <p className="text-xs text-blue-600">Líder selecionado</p>
              {(() => {
                const selected = leaders.find(l => l.id === selectedLeaderId);
                return selected ? (
                  <div className="text-sm">
                    <span className="font-medium">{selected.name}</span>
                    {selected.phone && <span> • {selected.phone}</span>}
                    {selected.curso && <span> • {selected.curso}</span>}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
      
      {/* Summary of all information */}
      <div className="bg-gray-50 p-4 rounded border mt-4">
        <h3 className="font-medium mb-3">Resumo do Grupo</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium">Localização</h4>
            <p className="text-sm">{group.university}, {group.city}</p>
            <p className="text-xs text-gray-500">{group.state}, {group.country}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium">Encontros</h4>
            {group.meetingTimes.length > 0 ? (
              <>
                {group.meetingTimes.map((meeting, index) => (
                  <div key={index} className="mb-1">
                    <p className="text-sm">{meeting.dayofweek} às {meeting.time}</p>
                    {meeting.local && <p className="text-xs text-gray-500">Local: {meeting.local}</p>}
                  </div>
                ))}
              </>
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
                    <p className="text-sm">{selected.name}</p>
                    <p className="text-xs text-gray-500">
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
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded order-2 sm:order-1 transition-colors"
          onClick={() => goToStep(2)}
        >
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Voltar
          </span>
        </button>
        <button 
          type="submit" 
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded order-1 sm:order-2 transition-colors flex items-center justify-center"
          disabled={!selectedLeaderId || !group.instagram || !!validationErrors.instagram}
          onClick={handleSubmit}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Adicionar Grupo
        </button>
      </div>
    </div>
  );
} 