'use client';

import { useState, useEffect, useRef } from 'react';
import { Group } from '../lib/interfaces';
import { supabase } from '../lib/supabase';
import { normalizeText } from '../lib/utils';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR to avoid duplicate Google Maps loading
const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]); // Store all groups for client-side filtering
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if user has searched
  const [mapKey, setMapKey] = useState(0); // Key to force map re-render
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // Track selected group
  const [isTyping, setIsTyping] = useState(false); // Flag to prevent map updates during typing
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all groups on initial load for the map
  useEffect(() => {
    const fetchAllGroups = async () => {
      try {
        // Updated query to only fetch active groups
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .eq('active', true);
        
        if (error) throw error;
        
        setAllGroups(data as Group[]);
      } catch (error) {
        console.error("Erro ao buscar grupos ativos:", error);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    fetchAllGroups();
  }, []);

  // Scroll selected result into view when it changes
  useEffect(() => {
    if (selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedGroupId]);

  // Handle clicks outside the suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Don't perform searches with very short terms
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        // Create search pattern that's case and accent insensitive
        const searchPattern = `%${normalizeText(searchTerm)}%`;

        // First try the client-side approach to avoid unnecessary API calls and flickering
        if (allGroups.length > 0) {
          // Generate suggestions from existing all groups - no API call needed
          const tempSuggestions = generateSuggestionsFromGroups(allGroups, searchTerm);
          setSuggestions(tempSuggestions);
          setShowSuggestions(tempSuggestions.length > 0);
          setIsLoadingSuggestions(false);
          return;
        }

        // If we don't have groups cached, now try server-side
        try {
          // Use the regular ilike search without unaccent first to avoid 400 errors
          const [universityResponse, cityResponse, stateResponse] = await Promise.all([
            // Fetch distinct university names that match the search term
            supabase
              .from('groups')
              .select('university')
              .eq('active', true)
              .ilike('university', searchPattern)
              .order('university')
              .limit(5),
              
            // Fetch distinct city names that match the search term
            supabase
              .from('groups')
              .select('city')
              .eq('active', true)
              .ilike('city', searchPattern)
              .order('city')
              .limit(3),
              
            // Fetch distinct state names that match the search term
            supabase
              .from('groups')
              .select('state')
              .eq('active', true)
              .ilike('state', searchPattern)
              .order('state')
              .limit(2)
          ]);

          // Combine and deduplicate suggestions
          const allSuggestions = [
            ...(universityResponse.data || []).map(item => item.university),
            ...(cityResponse.data || []).map(item => item.city),
            ...(stateResponse.data || []).map(item => item.state),
          ];

          // Remove duplicates
          const uniqueSuggestions = Array.from(new Set(allSuggestions));
          
          setSuggestions(uniqueSuggestions);
          setShowSuggestions(uniqueSuggestions.length > 0);
        } catch (error) {
          console.warn("Regular search failed, falling back to all groups:", error);
          
          // Fetch all groups if we don't have them already
          const { data: allData, error: allError } = await supabase
            .from('groups')
            .select('*')
            .eq('active', true);
            
          if (allError) throw allError;
          setAllGroups(allData as Group[]);
          
          // Generate suggestions from all groups
          const tempSuggestions = generateSuggestionsFromGroups(allData as Group[], searchTerm);
          setSuggestions(tempSuggestions);
          setShowSuggestions(tempSuggestions.length > 0);
        }
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    // Use a longer debounce to prevent too many requests while typing
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 500); // Increased debounce from 300ms to 500ms

    return () => clearTimeout(timer);
  }, [searchTerm, allGroups]);

  // Function to generate suggestions from groups data
  const generateSuggestionsFromGroups = (groups: Group[], term: string): string[] => {
    const normalizedTerm = normalizeText(term);
    const suggestionsSet = new Set<string>();
    
    // First filter out any inactive groups
    const activeGroups = groups.filter(group => group.active !== false);
    
    activeGroups.forEach(group => {
      // Check if university matches
      if (normalizeText(group.university).includes(normalizedTerm)) {
        suggestionsSet.add(group.university);
      }
      
      // Check if city matches
      if (normalizeText(group.city).includes(normalizedTerm)) {
        suggestionsSet.add(group.city);
      }
      
      // Check if state matches
      if (normalizeText(group.state).includes(normalizedTerm)) {
        suggestionsSet.add(group.state);
      }
      
      // Limit to ~10 suggestions
      if (suggestionsSet.size >= 10) {
        return;
      }
    });
    
    return Array.from(suggestionsSet);
  };

  // Additional function to filter results client-side if needed
  const filterGroupsByNormalizedText = (groups: Group[], term: string): Group[] => {
    if (!term.trim()) return groups;
    
    const normalizedTerm = normalizeText(term);
    
    return groups.filter(group => {
      // First ensure the group is active
      if (group.active === false) return false;
      
      // Check various fields for matches
      return normalizeText(group.university).includes(normalizedTerm) ||
             normalizeText(group.city).includes(normalizedTerm) ||
             normalizeText(group.state).includes(normalizedTerm) ||
             normalizeText(group.country).includes(normalizedTerm);
    });
  };

  // Function to handle clicking on a result
  const handleResultClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    // Force map to update (re-center on selected point)
    setMapKey(prevKey => prevKey + 1);
  };

  // Function to safely set search term without causing map flickering
  const updateSearchTerm = (value: string) => {
    setIsTyping(true); // Set typing flag to true when search term changes
    setSearchTerm(value);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set a timeout to mark the end of typing
    searchTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 800); // A bit longer than the debounce time
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    // Clear typing state immediately when search is executed
    setIsTyping(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    setIsLoading(true);
    setShowSuggestions(false);
    setHasSearched(true); // Mark that a search has been performed
    setSelectedGroupId(null); // Reset selected group when new search is performed
    
    try {
      // Create search pattern that's case and accent insensitive
      const searchPattern = `%${normalizeText(searchTerm)}%`;
      
      try {
        // Try the regular ilike search without unaccent first to avoid 400 errors
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('groups')
          .select('*')
          .eq('active', true) // Only fetch active groups
          .or(
            `university.ilike.${searchPattern},` +
            `city.ilike.${searchPattern},` +
            `state.ilike.${searchPattern},` +
            `country.ilike.${searchPattern}`
          );
          
        if (fallbackError) {
          throw fallbackError;
        }
        
        // If we got results, use them
        if (fallbackData.length > 0) {
          setSearchResults(fallbackData as Group[]);
        } else {
          // If no results with simple search, try unaccent (which can sometimes fail)
          try {
            const { data, error } = await supabase
              .from('groups')
              .select('*')
              .eq('active', true) // Only fetch active groups
              .or(
                `unaccent(university).ilike.${searchPattern},` +
                `unaccent(city).ilike.${searchPattern},` +
                `unaccent(state).ilike.${searchPattern},` +
                `unaccent(country).ilike.${searchPattern}`
              );
              
            if (error) throw error;
            setSearchResults(data as Group[]);
          } catch (unaccentError) {
            console.warn("Unaccent search failed, falling back to client-side filtering:", unaccentError);
            
            // Client-side fallback as last resort
            if (allGroups.length === 0) {
              // Fetch all groups if we don't have them already
              const { data: allData, error: allError } = await supabase
                .from('groups')
                .select('*')
                .eq('active', true);
                
              if (allError) throw allError;
              
              setAllGroups(allData as Group[]);
              // Filter the results client-side using our normalization function
              const filteredResults = filterGroupsByNormalizedText(allData as Group[], searchTerm);
              setSearchResults(filteredResults);
            } else {
              // Filter existing all groups
              const filteredResults = filterGroupsByNormalizedText(allGroups, searchTerm);
              setSearchResults(filteredResults);
            }
          }
        }
      } catch (error) {
        console.error("All search attempts failed:", error);
        
        // Last resort - client-side only
        if (allGroups.length > 0) {
          const filteredResults = filterGroupsByNormalizedText(allGroups, searchTerm);
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
        }
      }
      
      // Force map re-render with new data - done after all search processing is complete
      setMapKey(prevKey => prevKey + 1);
      
    } catch (error) {
      console.error("Erro ao pesquisar grupos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    // Clear typing state as the user has made a selection
    setIsTyping(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    
    // Trigger search with the selected suggestion
    const searchInput = searchInputRef.current;
    if (searchInput) {
      searchInput.value = suggestion;
      const event = new Event('submit', { bubbles: true, cancelable: true });
      searchInput.form?.dispatchEvent(event);
    }
  };

  return (
    <main className="min-h-screen p-4">
      {/* Page title */}
      <h1 className="text-3xl font-bold text-center mb-6">
        Encontre Pockets Dunamis nas Universidades
      </h1>
      
      {/* Search field centered at the top */}
      <div className="max-w-3xl mx-auto mb-6">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <div className="flex">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => updateSearchTerm(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Pesquisar por universidade, cidade, estado ou país"
                className="flex-grow p-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-r"
                disabled={isLoading}
              >
                {isLoading ? 'Pesquisando...' : 'Pesquisar'}
              </button>
            </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div 
                ref={suggestionsRef}
                className="absolute z-10 w-full bg-white border border-gray-300 rounded-b mt-0.5 shadow-lg max-h-60 overflow-y-auto"
              >
                {isLoadingSuggestions ? (
                  <div className="p-2 text-gray-500 text-sm">
                    Carregando sugestões...
                  </div>
                ) : suggestions.length > 0 ? (
                  <ul>
                    {suggestions.map((suggestion, index) => (
                      <li 
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-800"
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-2 text-gray-500 text-sm">
                    Nenhuma sugestão encontrada
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
      
      {/* Main content: Results (30%) and Map (70%) - switched order */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-220px)]">
        {/* Results section - 30% - now on the left */}
        <div className="lg:w-[30%] h-full overflow-y-auto bg-white border rounded shadow-sm p-4">
          {/* Display search results */}
          {searchResults.length > 0 ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">Resultados ({searchResults.length})</h2>
              <div className="text-xs text-gray-500 -mt-3 mb-3">
                <p>Clique em um resultado para visualizá-lo no mapa</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {searchResults.map((group) => (
                  <div 
                    key={group.id} 
                    ref={selectedGroupId === group.id ? selectedResultRef : null}
                    className={`border rounded p-3 shadow-sm cursor-pointer transition-all duration-200 ${
                      selectedGroupId === group.id 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleResultClick(group.id)}
                  >
                    <div className="flex flex-col">
                      <div>
                        <h3 className="font-bold text-base">{group.university}</h3>
                        <p className="text-gray-600 text-sm">
                          {group.city}, {group.state}, {group.country}
                        </p>
                        
                        {/* Meeting details */}
                        <div className="mt-2">
                          <p className="text-xs">
                            <span className="font-medium">Encontros:</span> Toda {group.dayofweek} às {group.time}
                          </p>
                          {group.local && (
                            <p className="text-xs">
                              <span className="font-medium">Local:</span> {group.local}
                            </p>
                          )}
                        </div>
                        
                        {/* Contact Section */}
                        <div className="mt-3 flex flex-row justify-between items-center">
                          {/* Leader Information */}
                          <div>
                            <p className="text-xs">
                              <span className="font-medium">Líder:</span> {group.leader?.name}
                            </p>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex space-x-1">
                            {/* WhatsApp Button */}
                            {group.leader?.phone && (
                              <a 
                                href={`https://wa.me/${(group.leader.phone || '').replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs inline-flex items-center"
                                title="WhatsApp"
                                onClick={(e) => e.stopPropagation()} // Prevent result click handler from firing
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                              </a>
                            )}
                            
                            {/* Instagram Button */}
                            {group.instagram && (
                              <a 
                                href={`https://instagram.com/${group.instagram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs inline-flex items-center"
                                title="Instagram"
                                onClick={(e) => e.stopPropagation()} // Prevent result click handler from firing
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                </svg>
                              </a>
                            )}
                            
                            {/* Google Maps Link */}
                            {group.fulladdress && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.fulladdress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs inline-flex items-center"
                                title="Como Chegar"
                                onClick={(e) => e.stopPropagation()} // Prevent result click handler from firing
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 h-full flex items-center justify-center">
              {isLoading ? (
                <p>Pesquisando...</p>
              ) : hasSearched && searchTerm ? (
                <p>Nenhum resultado encontrado. Tente outro termo de pesquisa.</p>
              ) : (
                <p>Digite um termo de pesquisa para encontrar um Pocket Dunamis.</p>
              )}
            </div>
          )}
        </div>
        
        {/* Map section - 70% - now on the right */}
        <div className="lg:w-[70%] h-full">
          <div className="bg-white p-4 border rounded shadow-sm h-full">
            <h2 className="text-xl font-semibold mb-3">
              {searchResults.length > 0 
                ? `Localizações nas Universidades (${searchResults.length})` 
                : `Todas as Localizações (${allGroups.length})`}
            </h2>
            {isLoadingInitial ? (
              <div className="flex justify-center items-center h-[90%]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Map 
                key={isTyping ? 0 : mapKey} // Only update key when not typing
                groups={searchResults.length > 0 && !isTyping
                  ? searchResults.filter(group => group.active !== false) 
                  : allGroups.filter(group => group.active !== false)
                } 
                selectedGroupId={selectedGroupId}
                height="100%"
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
