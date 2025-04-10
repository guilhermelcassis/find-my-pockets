'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Group } from '../lib/interfaces';
import { supabase } from '../lib/supabase';
import { normalizeText } from '../lib/utils';
import dynamic from 'next/dynamic';
import { MapRef } from '@/components/Map';
import SearchResults from '@/components/SearchResults';

// Create a new type for the Map component to include the onMarkerClick prop
type EnhancedMapProps = {
  groups: Group[];
  selectedGroupId?: string | null;
  height?: string;
  onMarkerClick?: (groupId: string) => void;
};

// Update the MapComponent to include access to the map ref
const MapComponent = dynamic(() => 
  import('@/components/Map').then(mod => {
    return mod.default;
  }),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-full border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }
);

// Add a TypeScript interface for suggestion items
interface SuggestionItem {
  text: string;
  type: 'university' | 'city' | 'state' | 'country';
  displayText: string;
  count: number;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]); // Store all groups for client-side filtering
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if user has searched
  const [mapKey, setMapKey] = useState(0); // Key to force map re-render
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // Track selected group
  const [isTyping, setIsTyping] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSearchResults = useRef<Group[]>([]);
  const [searchType, setSearchType] = useState<'university' | 'city' | 'state' | 'country' | null>(null);
  const selectedSuggestionRef = useRef<string | null>(null);
  const inSuggestionSelectionProcess = useRef<boolean>(false);
  const lastSearchedTermRef = useRef<string>('');
  const lastSearchedTypeRef = useRef<'university' | 'city' | 'state' | 'country' | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dropdownLockRef = useRef<boolean>(false);
  const mapRef = useRef<MapRef>(null);
  const isUserTypingRef = useRef<boolean>(false);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

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

  // Update the useEffect that handles clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close suggestions if clicking on the search input itself
      if (searchInputRef.current?.contains(event.target as Node)) {
        return;
      }
      
      // Close suggestions if clicking outside the dropdown and input
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
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
        setSuggestionItems([]);
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
          const items = generateSuggestionsFromGroups(allGroups, searchTerm);
          setSuggestionItems(items);
          setSuggestions(items.map(s => s.text));
          
          // Only automatically show suggestions if the input is focused and not locked
          if (document.activeElement === searchInputRef.current && !dropdownLockRef.current) {
            setShowSuggestions(items.length > 0);
          }
          
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
          
          const items = generateSuggestionsFromGroups(allGroups, searchTerm);
          setSuggestionItems(items);
          setSuggestions(items.map(s => s.text));
          setShowSuggestions(items.length > 0 && !dropdownLockRef.current);
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
          const items = generateSuggestionsFromGroups(allData as Group[], searchTerm);
          setSuggestionItems(items);
          setSuggestions(items.map(s => s.text));
          setShowSuggestions(items.length > 0 && !dropdownLockRef.current);
        }
      } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        setSuggestions([]);
        setSuggestionItems([]);
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
  const generateSuggestionsFromGroups = (groups: Group[], term: string): SuggestionItem[] => {
    if (!groups || groups.length === 0 || !term || term.trim().length < 2) return [];
    
    const normalizedTerm = normalizeText(term.trim()).toLowerCase();
    
    // Create a map to deduplicate suggestions - explicitly use global Map
    const suggestionsMap = new window.Map<string, SuggestionItem>();
    
    // First filter out any inactive groups
    const activeGroups = groups.filter(group => group.active !== false);
    
    // Count results for each suggestion
    const getCityResultCount = (city: string) => {
      return activeGroups.filter(g => normalizeText(g.city) === normalizeText(city)).length;
    };
    
    const getStateResultCount = (state: string) => {
      return activeGroups.filter(g => normalizeText(g.state) === normalizeText(state)).length;
    };
    
    const getUniversityResultCount = (university: string) => {
      return activeGroups.filter(g => normalizeText(g.university) === normalizeText(university)).length;
    };
    
    const getCountryResultCount = (country: string) => {
      return activeGroups.filter(g => normalizeText(g.country) === normalizeText(country)).length;
    };
    
    activeGroups.forEach(group => {
      // Check if university matches
      if (normalizeText(group.university).includes(normalizedTerm)) {
        const count = getUniversityResultCount(group.university);
        suggestionsMap.set(group.university, {
          text: group.university,
          type: 'university',
          displayText: group.university,
          count
        });
      }
      
      // Check if city matches
      if (normalizeText(group.city).includes(normalizedTerm)) {
        const count = getCityResultCount(group.city);
        suggestionsMap.set(`city-${group.city}-${group.state}`, {
          text: group.city,
          type: 'city',
          displayText: `${group.city} (${group.state})`,
          count
        });
      }
      
      // Check if state matches
      if (normalizeText(group.state).includes(normalizedTerm)) {
        const count = getStateResultCount(group.state);
        suggestionsMap.set(group.state, {
          text: group.state,
          type: 'state',
          displayText: group.state,
          count
        });
      }
      
      // Check if country matches
      if (normalizeText(group.country).includes(normalizedTerm)) {
        const count = getCountryResultCount(group.country);
        suggestionsMap.set(`country-${group.country}`, {
          text: group.country,
          type: 'country',
          displayText: group.country,
          count
        });
      }
    });
    
    // Convert to array and sort primarily by count (number of results) instead of type
    const suggestionsArray: SuggestionItem[] = Array.from(suggestionsMap.values());
    
    // Sort by count (higher first), then by type if counts are equal
    suggestionsArray.sort((a, b) => {
      // First sort by count (higher first)
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      
      // If counts are equal, sort by type (university, city, state, country)
      const typeOrder: Record<string, number> = { university: 1, city: 2, state: 3, country: 4 };
      const typeComparisonA = typeOrder[a.type] || 0;
      const typeComparisonB = typeOrder[b.type] || 0;
      
      return typeComparisonA - typeComparisonB;
    });
    
    // Limit to 10 suggestions total
    return suggestionsArray.slice(0, 10);
  };

  // Additional function to filter results client-side if needed
  const filterGroupsByNormalizedText = (groups: Group[], term: string): Group[] => {
    if (!term.trim()) return groups;
    
    const normalizedTerm = normalizeText(term);
    
    // First get only active groups
    const activeGroups = groups.filter(group => group.active !== false);
    
    // Check if term is likely a location (city or state)
    const isLocationTerm = activeGroups.some(
      g => normalizeText(g.city) === normalizedTerm || normalizeText(g.state) === normalizedTerm
    );
    
    // First, try to match exact city or state
    if (isLocationTerm) {
      const exactLocationMatches = activeGroups.filter(
        group => normalizeText(group.city) === normalizedTerm || 
                 normalizeText(group.state) === normalizedTerm
      );
      
      if (exactLocationMatches.length > 0) {
        return exactLocationMatches;
      }
    }
    
    // Otherwise, do a broader search
    const filteredGroups = activeGroups.filter(group => {
      return normalizeText(group.university).includes(normalizedTerm) ||
             normalizeText(group.city).includes(normalizedTerm) ||
             normalizeText(group.state).includes(normalizedTerm) ||
             normalizeText(group.country).includes(normalizedTerm);
    });
    
    // Sort results to prioritize exact matches
    filteredGroups.sort((a, b) => {
      // Prioritize exact city matches
      const aCityMatch = normalizeText(a.city) === normalizedTerm;
      const bCityMatch = normalizeText(b.city) === normalizedTerm;
      
      if (aCityMatch && !bCityMatch) return -1;
      if (!aCityMatch && bCityMatch) return 1;
      
      // Then prioritize exact state matches
      const aStateMatch = normalizeText(a.state) === normalizedTerm;
      const bStateMatch = normalizeText(b.state) === normalizedTerm;
      
      if (aStateMatch && !bStateMatch) return -1;
      if (!aStateMatch && bStateMatch) return 1;
      
      // Then prioritize city containing matches
      const aCityContains = normalizeText(a.city).includes(normalizedTerm);
      const bCityContains = normalizeText(b.city).includes(normalizedTerm);
      
      if (aCityContains && !bCityContains) return -1;
      if (!aCityContains && bCityContains) return 1;
      
      return 0;
    });
    
    return filteredGroups;
  };

  // Function to apply day of week and other filters
  const applyFilters = (groups: Group[]): Group[] => {
    let result = groups;
    
    // Only include active groups
    result = result.filter(group => group.active !== false);
    
    return result;
  };

  // Instead of using the useEffect for filtering, let's ensure the groups shown on the map are properly filtered
  const getDisplayedGroups = useCallback((): Group[] => {
    // Start with the base set of groups
    const baseGroups = searchResults.length > 0 
      ? searchResults 
      : allGroups;
    
    // If user is typing, use previous results to avoid flickering
    const groupsToFilter = isTyping
      ? (prevSearchResults.current.length > 0 
          ? prevSearchResults.current 
          : baseGroups)
      : baseGroups;
    
    // Apply active filter first
    const activeGroups = groupsToFilter.filter(group => group.active !== false);
    
    // If we have explicitly filtered groups, use those
    if (filteredGroups.length > 0 && !isTyping) {
      return filteredGroups;
    }
    
    return activeGroups;
  }, [searchResults, allGroups, isTyping, filteredGroups]);

  // Function to sort search results by quantity (number of groups per location)
  const sortResultsByQuantity = (results: Group[]): Group[] => {
    // Create a map to count groups by location
    const locationCountMap: Record<string, number> = {};
    const locationKeyMap: Record<string, string> = {};
    
    // Count groups per location (city + state)
    results.forEach(group => {
      const locationKey = `${group.city}|${group.state}`;
      const displayKey = `${group.city}, ${group.state}`;
      locationKeyMap[locationKey] = displayKey;
      
      if (!locationCountMap[locationKey]) {
        locationCountMap[locationKey] = 0;
      }
      locationCountMap[locationKey]++;
    });
    
    // Create a group map where key is the location
    const groupsByLocation: Record<string, Group[]> = {};
    results.forEach(group => {
      const locationKey = `${group.city}|${group.state}`;
      if (!groupsByLocation[locationKey]) {
        groupsByLocation[locationKey] = [];
      }
      groupsByLocation[locationKey].push(group);
    });
    
    // Sort the location keys by count (descending)
    const sortedLocationKeys = Object.keys(locationCountMap).sort((a, b) => {
      return locationCountMap[b] - locationCountMap[a];
    });
    
    // Flat map to get final sorted array
    const sortedResults: Group[] = [];
    sortedLocationKeys.forEach(locationKey => {
      sortedResults.push(...groupsByLocation[locationKey]);
    });
    
    return sortedResults;
  };

  // Handle marker click from the map - DON'T zoom, just show details
  // This is called when a user clicks directly on a marker in the map
  const handleMarkerClick = useCallback((groupId: string) => {
    // If user is typing, don't handle marker click to prevent input focus issues
    if (isUserTypingRef.current) {
      console.log('Ignoring marker click while user is typing');
      return;
    }
    
    // Handle null or undefined groupId (from location button) by clearing selection
    if (!groupId) {
      console.log('Clearing selected group (null/undefined groupId received)');
      setSelectedGroupId(null);
      return;
    }
    
    console.log(`Marker clicked on map for group ${groupId}`);
    setSelectedGroupId(groupId);
    
    // Only scroll to the corresponding item in the results list
    // but DON'T change the map zoom or center
    setTimeout(() => {
      if (resultsContainerRef.current) {
        const selectedElement = resultsContainerRef.current.querySelector(`[data-group-id="${groupId}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  }, []);

  // Handle click from the results list - DO zoom and show details
  // This is called when a user clicks on a result item in the sidebar
  const handleResultClick = useCallback((groupId: string) => {
    // If user is typing, don't handle result click to prevent input focus issues
    if (isUserTypingRef.current) {
      console.log('Ignoring result click while user is typing');
      return;
    }
    
    console.log(`Result clicked in list for group ${groupId}`);
    setSelectedGroupId(groupId);
    
    // Find the group from all available groups
    const allAvailableGroups = searchResults.length > 0 ? searchResults : allGroups;
    const group = allAvailableGroups.find(g => g.id === groupId);
    
    if (!group) {
      console.log('Group not found for ID:', groupId);
      return;
    }
    
    // IMPROVED: When clicking on a list result, implement a more reliable zooming sequence
    // First, simply highlight the marker without changing zoom
    if (mapRef.current) {
      console.log('First highlighting marker for:', group.university);
      mapRef.current.showGroupDetails(groupId);
    }
    
    // Then zoom to the location with a slight delay to prevent visual jumps
    setTimeout(() => {
      if (mapRef.current) {
        console.log('Now zooming to clicked result:', group.university);
        mapRef.current.zoomToGroup(groupId);
        
        // Finally, ensure the popup is visible after zooming completes
        setTimeout(() => {
          if (mapRef.current) {
            console.log('Ensuring popup is visible for:', group.university);
            mapRef.current.showGroupDetails(groupId);
          }
        }, 500); // Delay to allow zoom animation to complete
      }
    }, 100);
    
    // For mobile view, switch to map view when a result is clicked
    if (window.innerWidth < 1024) { // lg breakpoint in Tailwind
      setMobileView('map');
    }
  }, [searchResults, allGroups]);

  // Function to safely set search term without causing map flickering
  const updateSearchTerm = (value: string) => {
    // Flag that user is actively typing to prevent focus stealing
    isUserTypingRef.current = true;
    
    // Set a global flag that the map component can check
    window.isUserTyping = true;
    
    // Set typing flag only, we don't need to change any keys or remount the map
    setIsTyping(true);
    setSearchTerm(value);
    
    // Reset the dropdown lock when the user starts typing
    // This allows the suggestions dropdown to appear again for new searches
    if (value.trim() !== searchTerm.trim()) {
      dropdownLockRef.current = false;
    }
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    // More aggressively clear selectedGroupId when typing
    // This prevents the map from trying to recenter on a selected marker during a new search
    // Make it more aggressive by checking if there's any significant change in what the user is typing
    if (value.trim() === '' || Math.abs(value.length - searchTerm.length) > 1 || 
        (value.length > 2 && !value.includes(searchTerm) && !searchTerm.includes(value))) {
      console.log('Clearing selected group due to significant search text change');
      // Set a flag to ignore selection changes during typing
      setIsTyping(true);
      setSelectedGroupId(null);
      
      // Also clear any map click tracking
      if (mapRef.current) {
        mapRef.current.clearMapClicks();
      }
      
      // If we're doing a brand new search, clear any previous search results
      if (value.trim() === '' || !value.includes(searchTerm.substring(0, 3))) {
        prevSearchResults.current = [];
      }
      
      // Ensure focus stays in the input field
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    }
    
    // Set a timeout to mark the end of typing
    searchTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      isUserTypingRef.current = false; // Reset the typing flag after a delay
      window.isUserTyping = false; // Also reset the global flag
    }, 1000);
  };

  // Cleanup on unmount - ensure all timeouts are cleared
  useEffect(() => {
    // Reset the global typing flag on mount
    window.isUserTyping = false;
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Clear the global typing flag on unmount
      window.isUserTyping = false;
    };
  }, []);

  // Completely rewrite the handleSelectSuggestion function to ensure it always performs a search
  const handleSelectSuggestion = (suggestion: SuggestionItem, event: React.MouseEvent) => {
    // Stop propagation to prevent any parent click handlers
    event.stopPropagation();
    event.preventDefault();
    
    console.log(`Selected suggestion: ${suggestion.text}, type: ${suggestion.type}`);
    
    // Set flag to indicate we're in a selection process
    inSuggestionSelectionProcess.current = true;
    
    // Add a lock to prevent dropdown from reopening
    dropdownLockRef.current = true;
    
    // Clear typing state as the user has made a selection
    setIsTyping(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    // Store current search results before updating
    prevSearchResults.current = searchResults;
    
    // Get the actual search term
    let actualSearchTerm = suggestion.text;
    
    // Set the search term and type in the state
    // (This won't be immediately available due to React state batching)
    setSearchTerm(actualSearchTerm);
    setSearchType(suggestion.type);
    
    // Close the dropdown when a suggestion is selected
    setShowSuggestions(false);
    
    // Reset the selection process flag immediately after closing dropdown
    // This ensures click outside detection works properly
    inSuggestionSelectionProcess.current = false;
    
    // Set the search input's value directly
    if (searchInputRef.current) {
      searchInputRef.current.value = actualSearchTerm;
      // Keep focus on the input but don't reopen the dropdown
      searchInputRef.current.focus();
    }
    
    // Update last searched refs immediately
    lastSearchedTermRef.current = actualSearchTerm;
    lastSearchedTypeRef.current = suggestion.type;
    
    // Use a synthetic event for the search function
    const syntheticEvent = {
      preventDefault: () => {}
    } as React.FormEvent;
    
    // Always perform the search immediately, passing the suggestion type directly
    // instead of relying on the React state which might not be updated yet
    setTimeout(() => {
      console.log("Executing search for:", actualSearchTerm, "with type:", suggestion.type);
      // Pass the suggestion type directly to avoid timing issues with React state
      performSearch(actualSearchTerm, syntheticEvent, true, suggestion.type);
      
      // IMPROVED MAP ADJUSTMENT: Create a staggered sequence of map adjustments
      // This ensures more reliable map zooming after selecting a suggestion
      
      // First adjustment: Initial fit to markers (quick)
      setTimeout(() => {
        if (mapRef.current) {
          console.log("Initial map bounds adjustment");
          mapRef.current.fitBoundsToMarkers();
        }
      }, 300); // Short delay for initial adjustment
      
      // Second adjustment: More thorough fit once all markers are definitely loaded
      setTimeout(() => {
        if (mapRef.current) {
          console.log("Final map bounds adjustment");
          mapRef.current.fitBoundsToMarkers();
          
          // If we have a single result, zoom in a bit more for better visibility
          const effectiveResults = searchResults.length > 0 ? searchResults : 
            filterGroupsByNormalizedText(allGroups, actualSearchTerm);
          
          if (effectiveResults.length === 1 && effectiveResults[0]) {
            mapRef.current.zoomToGroup(effectiveResults[0].id);
          }
        }
      }, 1000); // Longer delay to ensure all markers are rendered
    }, 50);
  };

  // Update the performSearch function to accept the type directly
  const performSearch = async (
    term: string, 
    e: React.FormEvent, 
    forceSearch: boolean = false,
    directType?: 'university' | 'city' | 'state' | 'country' | null
  ) => {
    e.preventDefault();
    
    // Use directType if provided, otherwise use the state
    const effectiveType = directType !== undefined ? directType : searchType;
    
    console.log("performSearch called with term:", term, "type:", effectiveType, "force:", forceSearch);
    
    // Don't perform searches with empty or very short terms
    if (!term.trim() || term.trim().length < 2) return;
    
    // Check if we're searching with the exact same term and type
    const isSameSearch = !forceSearch && 
                       lastSearchedTermRef.current === term && 
                       lastSearchedTypeRef.current === effectiveType;
                       
    console.log("Is same search?", isSameSearch, "Force search:", forceSearch);
    
    // Reset selected group at the beginning to prevent map jumping during search
    // Only reset if we're not forcing the same search, which happens with dropdown selection
    if (!isSameSearch) {
      setSelectedGroupId(null);
      
      // Also clear any map click tracking
      if (mapRef.current) {
        mapRef.current.clearMapClicks();
      }
    }
    
    // Update the refs with current search parameters
    lastSearchedTermRef.current = term;
    lastSearchedTypeRef.current = effectiveType;
    
    // Clear typing state immediately when search is executed
    setIsTyping(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    // Always close the suggestions dropdown during search
    setShowSuggestions(false);
    
    // Set the dropdown lock to prevent reopening during search
    dropdownLockRef.current = true;
    
    setIsLoading(true);
    setHasSearched(true); // Mark that a search has been performed
    
    // Try to determine the type automatically if not provided directly
    if (!effectiveType) {
      // Try to determine the type automatically
      const matchingItem = suggestionItems.find(item => 
        normalizeText(item.text) === normalizeText(term)
      );
      if (matchingItem) {
        setSearchType(matchingItem.type);
      } else {
        setSearchType(null);
      }
    }
    
    // Store current search results before updating them
    prevSearchResults.current = searchResults;
    
    try {
      // Create search pattern that's case and accent insensitive
      const searchPattern = `%${normalizeText(term)}%`;
      
      // First try client-side filtering which is more reliable with complex strings
      // This avoids the 400 Bad Request errors from Supabase with special characters
      let filteredResults: Group[] = [];
      
      if (effectiveType) {
        // Filter based on type
        filteredResults = allGroups.filter(group => {
          if (effectiveType === 'city') {
            return normalizeText(group.city) === normalizeText(term) || 
                   normalizeText(group.city).includes(normalizeText(term));
          } else if (effectiveType === 'state') {
            return normalizeText(group.state) === normalizeText(term) || 
                   normalizeText(group.state).includes(normalizeText(term));
          } else if (effectiveType === 'university') {
            return normalizeText(group.university) === normalizeText(term) || 
                   normalizeText(group.university).includes(normalizeText(term));
          } else if (effectiveType === 'country') {
            return normalizeText(group.country) === normalizeText(term) || 
                   normalizeText(group.country).includes(normalizeText(term));
          }
          return false;
        });
      } else {
        // No type specified, use the regular filter function
        filteredResults = filterGroupsByNormalizedText(allGroups, term);
      }
      
      console.log(`Found ${filteredResults.length} results with client-side filtering`);
      
      // Sort and set the results
      const sortedResults = sortResultsByQuantity(filteredResults);
      setSearchResults(sortedResults);
      
      // Force map re-render with new data - done after all search processing is complete
      setMapKey(prevKey => prevKey + 1);
      
      // IMPROVED MAP ADJUSTMENT STRATEGY
      // Use a sequence of map adjustments with different timings to ensure reliability
      
      // First adjustment attempt (quick)
      setTimeout(() => {
        if (mapRef.current && sortedResults.length > 0) {
          console.log("Quick map bounds adjustment, markers:", sortedResults.length);
          mapRef.current.fitBoundsToMarkers();
        }
      }, 300);
      
      // Second adjustment attempt (medium delay)
      setTimeout(() => {
        if (mapRef.current && sortedResults.length > 0) {
          console.log("Medium delay map bounds adjustment");
          mapRef.current.fitBoundsToMarkers();
        }
      }, 600);
      
      // Final adjustment attempt (longer delay to ensure all markers are created)
      setTimeout(() => {
        if (mapRef.current && sortedResults.length > 0) {
          console.log("Final map bounds adjustment");
          mapRef.current.fitBoundsToMarkers();
          
          // Special case for single result - zoom in more for better visibility
          if (sortedResults.length === 1 && sortedResults[0]) {
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.zoomToGroup(sortedResults[0].id);
              }
            }, 200);
          }
        }
      }, 1200);
      
      // Only try server-side search if client-side filtering didn't find enough results
      if (filteredResults.length === 0 && allGroups.length > 0) {
        // Try a safer server-side query approach with ilike
        try {
          const buildSaferQuery = () => {
            if (effectiveType === 'city') {
              return `city.ilike.${searchPattern}`;
            } else if (effectiveType === 'state') {
              return `state.ilike.${searchPattern}`;
            } else if (effectiveType === 'university') {
              return `university.ilike.${searchPattern}`;
            } else if (effectiveType === 'country') {
              return `country.ilike.${searchPattern}`;
            } else {
              return `university.ilike.${searchPattern},` +
                     `city.ilike.${searchPattern},` +
                     `state.ilike.${searchPattern},` +
                     `country.ilike.${searchPattern}`;
            }
          };
          
          const { data, error } = await supabase
            .from('groups')
            .select('*')
            .eq('active', true)
            .or(buildSaferQuery());
            
          if (!error && data.length > 0) {
            console.log(`Found ${data.length} results with server-side query`);
            const serverResults = sortResultsByQuantity(data as Group[]);
            setSearchResults(serverResults);
            // Update map again
            setMapKey(prevKey => prevKey + 1);
            
            // Adjust map for server-side results
            setTimeout(() => {
              if (mapRef.current && serverResults.length > 0) {
                console.log("Adjusting map bounds for server results");
                mapRef.current.fitBoundsToMarkers();
              }
            }, 800);
          }
        } catch (serverError) {
          console.error("Server-side search failed:", serverError);
          // Already using client-side results, so no need for fallback
        }
      }
    } catch (error) {
      console.error("Error during search:", error);
    } finally {
      setIsLoading(false);
      
      // Only release the dropdown lock if this wasn't a selection search
      // This helps prevent the dropdown from reopening when a user selects an item
      if (!forceSearch) {
        setTimeout(() => {
          dropdownLockRef.current = false;
        }, 300);
      }
    }
  };

  // Maintain handleSearch as a wrapper for better API organization
  const handleSearch = (e: React.FormEvent) => {
    // Always clear selected group when performing a new search
    setSelectedGroupId(null);
    
    // Direct use of the current searchType from state is fine here
    // since this is triggered by a form submission, not a React state update
    performSearch(searchTerm, e, false, searchType);
    
    // Close the suggestions dropdown when search is performed
    setShowSuggestions(false);
  };

  // Update the handleSearchInputClick function to better handle dropdown visibility
  const handleSearchInputClick = () => {
    // Don't show suggestions if dropdown is locked
    if (dropdownLockRef.current) return;
    
    // If we have a search term and suggestions, always show the dropdown on click
    if (searchTerm.trim().length >= 2) {
      // If we already have suggestion items, show them immediately
      if (suggestionItems.length > 0) {
        setShowSuggestions(true);
      } else {
        // Otherwise, trigger the suggestions fetch
        const timer = setTimeout(() => {
          if (suggestionItems.length > 0 && !dropdownLockRef.current) {
            setShowSuggestions(true);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  };

  // Add a useEffect to debug the map container dimensions
  useEffect(() => {
    if (mapContainerRef.current) {
      // Log map container dimensions
      const rect = mapContainerRef.current.getBoundingClientRect();
      console.log('Map parent container dimensions:', {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        offsetWidth: mapContainerRef.current.offsetWidth,
        offsetHeight: mapContainerRef.current.offsetHeight,
      });
    }
  }, []);

  // Add an effect to protect the search input focus
  useEffect(() => {
    // Only run this on the client side
    if (typeof window === 'undefined' || !searchInputRef.current) return;
    
    // Only handle blur event since focus is handled by onFocus prop
    const handleBlur = () => {
      // Small delay to avoid immediate flag reset, which could cause focus issues
      setTimeout(() => {
        isUserTypingRef.current = false;
        window.isUserTyping = false;
      }, 300);
    };
    
    // Add event listener for blur only
    searchInputRef.current.addEventListener('blur', handleBlur);
    
    // Clean up
    return () => {
      if (searchInputRef.current) {
        searchInputRef.current.removeEventListener('blur', handleBlur);
      }
    };
  }, []);

  // Add a useEffect to apply filters to the displayed groups
  useEffect(() => {
    // Set filtered groups to match search results (all active)
    setFilteredGroups(searchResults.filter(group => group.active !== false));
    
    // Reset map view if needed
    setTimeout(() => {
      if (mapRef.current && searchResults.length > 0) {
        mapRef.current.fitBoundsToMarkers();
      }
    }, 300);
  }, [searchResults]);

  // Add media query detection for mobile
  useEffect(() => {
    const checkMobileView = () => {
      return window.innerWidth < 1024; // lg breakpoint in Tailwind
    };
    
    // Set initial mobile state
    if (checkMobileView()) {
      setMobileView('map'); // Default to map on mobile
    }
    
    // Update on resize
    const handleResize = () => {
      const isMobile = checkMobileView();
      if (!isMobile) {
        setMobileView('map'); // Reset to map when returning to desktop
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-6">
            Encontre Pockets Dunamis nas Universidades
          </h1>
          
          {/* Search container with elevated card style */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6">
            <form onSubmit={(e) => handleSearch(e)}>
              <div className="relative">
                <div className="flex">
                  <div className="relative flex-grow flex items-center">
                    {searchType && !isTyping && (
                      <div className="absolute left-3 flex items-center">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-2 ${
                          searchType === 'university' ? 'bg-blue-100' :
                          searchType === 'city' ? 'bg-green-100' :
                          searchType === 'country' ? 'bg-amber-100' :
                          'bg-purple-100'
                        }`}>
                          {searchType === 'university' && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M12 14l9-5-9-5-9 5 9 5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998a12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                            </svg>
                          )}
                          {searchType === 'city' && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                          )}
                          {searchType === 'state' && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          )}
                          {searchType === 'country' && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-500 hidden sm:inline">
                          {searchType === 'university' ? 'Universidade' : 
                           searchType === 'city' ? 'Cidade' : 
                           searchType === 'country' ? 'País' :
                           'Estado'}
                        </span>
                      </div>
                    )}
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      updateSearchTerm(e.target.value);
                      // Clear search type when user starts typing
                      if (e.target.value.trim() !== searchTerm) {
                        setSearchType(null);
                      }
                    }}
                    onClick={handleSearchInputClick}
                    onFocus={() => {
                      console.log("Search input focused - setting typing flag");
                      isUserTypingRef.current = true;
                      window.isUserTyping = true;
                      
                      // Don't show suggestions on focus if dropdown is locked
                      if (searchTerm.trim().length >= 2 && suggestionItems.length > 0 && !dropdownLockRef.current) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="Pesquisar por universidade, cidade, estado ou país"
                    className={`flex-grow p-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-primary ${searchType && !isTyping ? 'pl-24 sm:pl-32' : ''}`}
                    autoComplete="off"
                  />
                    {searchTerm && (
                      <button 
                        type="button" 
                        className="absolute right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => {
                          setSearchTerm('');
                          setSearchType(null);
                          if (searchInputRef.current) {
                            searchInputRef.current.value = '';
                            searchInputRef.current.focus();
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-white py-3 rounded-r w-[140px] transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Pesquisando
                      </span>
                    ) : 'Pesquisar'}
                  </button>
                </div>
                
                {/* Enhanced Suggestions dropdown */}
                {showSuggestions && (
                  <div 
                    ref={suggestionsRef}
                    className="absolute z-10 w-full bg-white border border-gray-300 rounded-b mt-0.5 shadow-lg max-h-[300px] overflow-y-auto"
                  >
                    {/* Suggestions dropdown content kept unchanged */}
                    {isLoadingSuggestions ? (
                      <div className="p-2 text-gray-500 text-sm flex justify-center items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mr-2"></div>
                        Carregando sugestões...
                      </div>
                    ) : suggestionItems.length > 0 ? (
                      <ul className="py-1">
                        {suggestionItems.map((suggestion, index) => {
                          // Check if this suggestion matches the current search type and term
                          const isSelected = searchType === suggestion.type && searchTerm === suggestion.text;
                          
                          return (
                          <li 
                            key={index}
                              className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                                isSelected ? 'bg-blue-100' : ''
                              }`}
                              onClick={(e) => handleSelectSuggestion(suggestion, e)}
                            >
                              <div className="flex items-center justify-between">
                                {/* Main content with icon and text */}
                                <div className="flex items-center">
                                  {/* Type badge */}
                                  {suggestion.type === 'university' && (
                                    <div className={`w-8 h-8 flex-shrink-0 ${isSelected ? 'bg-blue-200' : 'bg-blue-100'} rounded-full flex items-center justify-center mr-3`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998a12.078 12.078 0 01.665-6.479L12 14z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998a12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                      </svg>
                                    </div>
                                  )}
                                  {suggestion.type === 'city' && (
                                    <div className={`w-8 h-8 flex-shrink-0 ${isSelected ? 'bg-green-200' : 'bg-green-100'} rounded-full flex items-center justify-center mr-3`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                      </svg>
                                    </div>
                                  )}
                                  {suggestion.type === 'state' && (
                                    <div className={`w-8 h-8 flex-shrink-0 ${isSelected ? 'bg-purple-200' : 'bg-purple-100'} rounded-full flex items-center justify-center mr-3`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                      </svg>
                                    </div>
                                  )}
                                  {suggestion.type === 'country' && (
                                    <div className={`w-8 h-8 flex-shrink-0 ${isSelected ? 'bg-amber-200' : 'bg-amber-100'} rounded-full flex items-center justify-center mr-3`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                  )}
                                  
                                  {/* Text content */}
                                  <div className="flex flex-col">
                                    <span className={`font-medium ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                                      {suggestion.displayText}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {suggestion.type === 'university' ? 'Universidade' : 
                                       suggestion.type === 'city' ? 'Cidade' : 
                                       suggestion.type === 'country' ? 'País' :
                                       'Estado'}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Results count badge */}
                                <div className={`${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-700'} rounded-full px-2 py-1 text-xs font-semibold ml-2 min-w-[50px] text-center`}>
                                  {suggestion.count} {suggestion.count === 1 ? 'resultado' : 'resultados'}
                                </div>
                              </div>
                          </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="p-3 text-gray-500 text-sm text-center">
                        Nenhuma sugestão encontrada
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
            
            {/* Search instructions */}
            {!hasSearched && (
              <div className="mt-4 text-center text-gray-600 text-sm px-4">
                <p>Pesquise por universidade, cidade, estado ou país para encontrar um Pocket Dunamis próximo de você.</p>
                <p className="mt-1">Exemplo: "USP", "São Paulo", "Minas Gerais" ou "Brasil"</p>
              </div>
            )}
          </div>
          
          {/* Mobile View Toggle - only shown on small screens when there are search results */}
          {hasSearched && (
            <div className="lg:hidden mb-4 flex justify-center">
              <div className="bg-gray-100 rounded-lg p-1 inline-flex">
                <button
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    mobileView === 'map' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
                  }`}
                  onClick={() => setMobileView('map')}
                >
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Mapa
                  </span>
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    mobileView === 'list' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'
                  }`}
                  onClick={() => setMobileView('list')}
                >
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Lista
                  </span>
                </button>
              </div>
            </div>
          )}
          
          {/* Main content: Results and Map - only shown after search */}
          {hasSearched && (
            <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)] min-h-[500px] max-h-[800px] mb-4 flex-grow">
              {/* Rest of the results and map sections kept unchanged */}
              {/* Results section - hidden on mobile when map is showing */}
              <div className={`lg:w-[30%] h-full overflow-y-auto bg-white border rounded-lg shadow-sm p-4 ${
                mobileView === 'list' ? 'block' : 'hidden lg:block'
              }`} ref={resultsContainerRef}>
                {/* Display search results */}
                {searchResults.length > 0 ? (
                  <SearchResults
                    searchResults={searchResults}
                    handleResultClick={handleResultClick}
                    selectedGroupId={selectedGroupId}
                  />
                ) : (
                  <div className="text-center text-gray-500 h-full flex items-center justify-center">
                    {isLoading ? (
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-3"></div>
                        <p>Pesquisando...</p>
                      </div>
                    ) : hasSearched && searchTerm ? (
                      <div className="flex flex-col items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>Nenhum resultado encontrado. Tente outro termo de pesquisa.</p>
                      </div>
                    ) : (
                      <p>Digite um termo de pesquisa para encontrar um Pocket Dunamis.</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Map section - hidden on mobile when list is showing */}
              <div className={`lg:w-[70%] h-full overflow-hidden ${
                mobileView === 'map' ? 'block' : 'hidden lg:block'
              }`}>
                <div 
                  ref={mapContainerRef}
                  className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col"
                >
                  <div className="mb-3 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">
                      {searchResults.length > 0 
                        ? `Localizações nas Universidades (${searchResults.length})` 
                        : `Todas as Localizações (${allGroups.length})`}
                    </h2>
                    
                    {/* Map Controls */}
                    <div className="flex gap-2">
                      <button 
                        className="bg-white border border-gray-300 rounded px-3 py-1 text-sm flex items-center gap-1 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          if (mapRef.current) {
                            mapRef.current.fitBoundsToMarkers();
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Ver todos
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow relative" style={{ minHeight: "400px" }}>
                    {isLoadingInitial ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <>
                        {/* Location button */}
                        <button 
                          className="absolute top-4 right-4 z-10 bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary group active:bg-blue-100"
                          onClick={(e) => {
                            if (mapRef.current) {
                              mapRef.current.getUserLocation();
                            }
                          }}
                          title="Encontrar minha localização exata atual"
                          aria-label="Encontrar minha localização exata atual"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          
                          {/* Enhanced tooltip */}
                          <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-64 p-3 bg-white rounded-lg shadow-lg text-sm text-gray-700 z-50">
                            <p className="font-medium mb-1">Mostrar minha localização exata</p>
                            <p>Seu navegador pedirá permissão para acessar sua localização atual.</p>
                            <p className="mt-1 text-xs text-gray-500">Se negada, você pode habilitar nas configurações do navegador.</p>
                          </div>
                        </button>
                        
                        <MapComponent 
                          key={mapKey}
                          ref={mapRef}
                          groups={getDisplayedGroups()}
                          selectedGroupId={selectedGroupId}
                          height="100%"
                          onMarkerClick={handleMarkerClick}
                          enableClustering={false}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Show an empty state when no search has been performed */}
          {!hasSearched && (
            <div className="bg-white border rounded-lg shadow-sm p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Busque por Pockets Dunamis</h2>
              <p className="text-gray-600 max-w-md mb-6">
                Digite uma universidade, cidade, estado ou país no campo de busca acima para
                encontrar grupos Pocket próximos.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                <button 
                  onClick={() => {
                    setSearchTerm('Brasil');
                    setSearchType('country');
                    if (searchInputRef.current) {
                      searchInputRef.current.value = 'Brasil';
                    }
                    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                    performSearch('Brasil', syntheticEvent, true, 'country');
                  }}
                  className="py-1 px-3 bg-amber-100 text-amber-800 rounded-full text-sm hover:bg-amber-200 transition-colors"
                >
                  Brasil
                </button>
                <button 
                  onClick={() => {
                    setSearchTerm('São Paulo');
                    setSearchType('state');
                    if (searchInputRef.current) {
                      searchInputRef.current.value = 'São Paulo';
                    }
                    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                    performSearch('São Paulo', syntheticEvent, true, 'state');
                  }}
                  className="py-1 px-3 bg-purple-100 text-purple-800 rounded-full text-sm hover:bg-purple-200 transition-colors"
                >
                  São Paulo
                </button>
                <button 
                  onClick={() => {
                    setSearchTerm('Rio de Janeiro');
                    setSearchType('city');
                    if (searchInputRef.current) {
                      searchInputRef.current.value = 'Rio de Janeiro';
                    }
                    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                    performSearch('Rio de Janeiro', syntheticEvent, true, 'city');
                  }}
                  className="py-1 px-3 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200 transition-colors"
                >
                  Rio de Janeiro
                </button>
                <button 
                  onClick={() => {
                    setSearchTerm('USP');
                    setSearchType('university');
                    if (searchInputRef.current) {
                      searchInputRef.current.value = 'USP';
                    }
                    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                    performSearch('USP', syntheticEvent, true, 'university');
                  }}
                  className="py-1 px-3 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  USP
                </button>
              </div>
            </div>
          )}
          
          {/* Mobile navigation bar at the bottom - only shown after search */}
          {hasSearched && (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-2 flex justify-around z-20">
              <button 
                className={`flex flex-col items-center p-2 rounded ${mobileView === 'map' ? 'text-primary' : 'text-gray-500'}`}
                onClick={() => setMobileView('map')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="text-xs mt-1">Mapa</span>
              </button>
              
              <button 
                className={`flex flex-col items-center p-2 rounded ${mobileView === 'list' ? 'text-primary' : 'text-gray-500'}`}
                onClick={() => setMobileView('list')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="text-xs mt-1">Lista</span>
              </button>
              
              {/* Mobile location button */}
              <button 
                className="flex flex-col items-center p-2 rounded text-gray-500 relative group active:text-primary active:bg-blue-50"
                onClick={(e) => {
                  if (mapRef.current) {
                    mapRef.current.getUserLocation();
                    setMobileView('map'); // Switch to map view
                  }
                }}
                title="Encontrar minha localização exata atual"
                aria-label="Encontrar minha localização exata atual"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs mt-1">Localização</span>
                
                {/* Enhanced tooltip */}
                <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-white rounded-lg shadow-lg text-xs text-gray-700 z-50">
                  Mostrar minha localização exata atual
                </div>
              </button>
            </div>
          )}
          
          {/* Add padding at the bottom on mobile to account for the nav bar */}
          {hasSearched && (
            <div className="lg:hidden h-16"></div>
          )}
        </div>
      </div>
    </main>
  );
}
