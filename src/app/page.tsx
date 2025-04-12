'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Group } from '../lib/interfaces';
import { supabase } from '../lib/supabase';
import { normalizeText } from '../lib/utils';
import dynamic from 'next/dynamic';
import { MapRef } from '@/components/Map';
import SearchResults from '@/components/SearchResults';
import Link from 'next/link';
import Image from 'next/image';

// Modern font selection with better combinations
import { Inter, Poppins, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';

// Primary sans-serif font for UI elements
const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700']
});

// Secondary font for headings and feature text
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

// Base UI font
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

// Supporting font for specific elements
const poppins = Poppins({ 
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap'
});

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
      <div className="flex justify-center items-center h-full border border-gray-200 rounded-lg bg-gray-50/30 backdrop-blur-sm">
        <div className="animate-pulse flex flex-col items-center">
          <div className="rounded-full h-12 w-12 border-2 border-indigo-500/30 border-t-indigo-600 animate-spin mb-3"></div>
          <span className="text-xs text-gray-500 font-medium">Carregando mapa...</span>
        </div>
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

// PWA Installation type
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function Home() {
  // Shared state that remains consistent between server and client
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]); 
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(true); // Changed to true to auto-display the map
  const [mapKey, setMapKey] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [searchType, setSearchType] = useState<'university' | 'city' | 'state' | 'country' | null>(null);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  
  // PWA installation state
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Client-side only state with explicit initialization
  const [isClient, setIsClient] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const selectedResultRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSearchResults = useRef<Group[]>([]);
  const selectedSuggestionRef = useRef<string | null>(null);
  const inSuggestionSelectionProcess = useRef<boolean>(false);
  const lastSearchedTermRef = useRef<string>('');
  const lastSearchedTypeRef = useRef<'university' | 'city' | 'state' | 'country' | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dropdownLockRef = useRef<boolean>(false);
  const mapRef = useRef<MapRef>(null);
  const isUserTypingRef = useRef<boolean>(false);

  // Refactor the searchInput event handling to prevent hydration issues
  // Safe check for client-side only code
  useEffect(() => {
    setIsClient(true);
    
    // Set up global window typing flag only on client
    if (typeof window !== 'undefined') {
      window.isUserTyping = false;
    }
    
    return () => {
      // Clean up global flag only on client
      if (typeof window !== 'undefined') {
        window.isUserTyping = false;
      }
    };
  }, []);

  // Add PWA installation event handler
  useEffect(() => {
    if (!isClient) return;
    
    // Check if this is an iOS device
    const checkIOSDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    };
    
    setIsIOSDevice(checkIOSDevice());
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      
      // Store the event for later use
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      
      // Show the install button
      setIsInstallable(true);
    };
    
    // Check if the user has already installed the PWA
    const checkAppInstalled = () => {
      // For iOS, we have to rely on heuristics
      if (checkIOSDevice()) {
        // If it's in standalone mode (already installed)
        if (window.matchMedia('(display-mode: standalone)').matches) {
          setIsInstallable(false);
        } else {
          // On iOS, we'll show instructions instead
          setIsInstallable(true);
        }
        return;
      }
      
      // For other browsers, we listen for the beforeinstallprompt event
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      // If the app is already installed, the event won't fire, and we don't need to show the button
      window.addEventListener('appinstalled', () => {
        setIsInstallable(false);
        deferredPromptRef.current = null;
      });
    };
    
    checkAppInstalled();
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isClient]);
  
  // Function to handle PWA installation
  const handleInstallClick = async () => {
    if (!deferredPromptRef.current && !isIOSDevice) {
      return;
    }
    
    if (isIOSDevice) {
      // For iOS, we show an alert with installation instructions
      alert(
        'Para instalar este app no seu iPhone/iPad:\n\n' +
        '1. Toque no ícone de compartilhamento (o quadrado com a seta para cima)\n' +
        '2. Role para baixo e toque em "Adicionar à Tela de Início"\n' +
        '3. Toque em "Adicionar" no canto superior direito'
      );
      return;
    }
    
    try {
      // Show the installation prompt
      await deferredPromptRef.current?.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPromptRef.current?.userChoice;
      
      if (choiceResult && choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsInstallable(false);
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the saved prompt as it can only be used once
      deferredPromptRef.current = null;
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  // Consolidate all client-side dom manipulations into a single useEffect
  useEffect(() => {
    // Only run client-side DOM operations after client has been confirmed
    if (!isClient) return;
    
    // Setup search input blur handler
    const handleSearchInputBlur = () => {
      // Don't hide suggestions right away to allow clicks on suggestions
      setTimeout(() => {
        if (!dropdownLockRef.current) {
          setShowSuggestions(false);
        }
        // Also handle typing flag reset
        isUserTypingRef.current = false;
        if (typeof window !== 'undefined') {
          window.isUserTyping = false;
        }
      }, 200);
    };
    
    // Set up event handlers
    if (searchInputRef.current) {
      searchInputRef.current.addEventListener('blur', handleSearchInputBlur);
    }
    
    // Debug map container dimensions if needed
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      console.log('Map parent container dimensions:', {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        offsetWidth: mapContainerRef.current.offsetWidth,
        offsetHeight: mapContainerRef.current.offsetHeight,
      });
    }
    
    // Clean up all event listeners
    return () => {
      if (searchInputRef.current) {
        searchInputRef.current.removeEventListener('blur', handleSearchInputBlur);
      }
      
      // Clear any timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [isClient]); // Only depend on isClient

  // Fetch all groups on initial load for the map
  useEffect(() => {
    const fetchAllGroups = async () => {
      try {
        console.log("Fetching all groups...");
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .eq('active', true)
          .order('university', { ascending: true });
        
        if (error) {
          console.error("Error fetching groups:", error);
          return;
        }
        
        console.log(`Fetched ${data.length} groups`);
        const activeGroups = data as Group[];
        
        // Set all the states just like the "Mostrar todos os Pockets" button does
        setAllGroups(activeGroups);
        setFilteredGroups(activeGroups);
        setSearchResults(activeGroups);
        setHasSearched(true);
        setIsLoadingInitial(false);
        
        // Force map to update and fit all markers
        setMapKey(prevKey => prevKey + 1);
        
        // Multiple attempts to fit bounds with increasing delays to ensure markers are loaded
        // First attempt - short delay
        setTimeout(() => {
          if (mapRef.current) {
            console.log("Initial fit bounds to all markers");
            mapRef.current.fitBoundsToMarkers();
          }
        }, 200);
        
        // Second attempt - medium delay
        setTimeout(() => {
          if (mapRef.current) {
            console.log("Second attempt to fit bounds to all markers");
            mapRef.current.fitBoundsToMarkers();
          }
        }, 500);
        
        // Third attempt - longer delay for reliability
        setTimeout(() => {
          if (mapRef.current) {
            console.log("Final attempt to fit bounds to all markers");
            mapRef.current.fitBoundsToMarkers();
          }
        }, 1000);
      } catch (error) {
        console.error("Error in fetchAllGroups:", error);
        setIsLoadingInitial(false);
      }
    };

    if (isClient) {
      fetchAllGroups();
    }
  }, [isClient]);

  // Move media query detection to a client-only useEffect
  useEffect(() => {
    // Only run on client-side
    if (!isClient) return;
    
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
  }, [isClient]); // Only re-run when isClient changes

  // Create a helper function that's safe for both client and server
  const checkMobileView = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
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
    
    // If it's the same group already selected, don't trigger the whole sequence again
    if (selectedGroupId === groupId) {
      console.log('Group already selected, skipping transitions');
      return;
    }
    
    console.log(`Result clicked in list for group ${groupId}`);
    
    // Find the group from all available groups
    const allAvailableGroups = searchResults.length > 0 ? searchResults : allGroups;
    const group = allAvailableGroups.find(g => g.id === groupId);
    const previousGroup = selectedGroupId ? allAvailableGroups.find(g => g.id === selectedGroupId) : null;
    
    if (!group) {
      console.log('Group not found for ID:', groupId);
      return;
    }
    
    // Check if this is a transition between groups at the same university
    // This helps determine if we need special handling
    const isSameUniversity = previousGroup && 
                           previousGroup.university === group.university &&
                           previousGroup.id !== group.id;
                           
    if (isSameUniversity) {
      console.log('Smooth transition between groups at the same university');
    }
    
    // Set selected ID to trigger UI updates
    setSelectedGroupId(groupId);
    
    // IMPROVED TRANSITION SEQUENCE
    if (mapRef.current) {
      console.log('Zooming and showing details for:', group.university);
      
      if (isSameUniversity) {
        // For same university transitions, use a special sequence
        // 1. First just show the details without zooming to avoid jolting the map
        mapRef.current.showGroupDetails(groupId, true);
        
        // 2. Then do a very gentle pan to the new position without changing zoom level
        setTimeout(() => {
          if (mapRef.current) {
            // The false parameter ensures we don't show the popup again (no blinking)
            mapRef.current.zoomToGroup(groupId, false);
          }
        }, 50);
      } else {
        // For different universities, use the regular sequence
        // First zoom to location
        mapRef.current.zoomToGroup(groupId);
        
        // After a short delay, show the card with permanent flag
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.showGroupDetails(groupId, true);
          }
        }, 250);
      }
    }
    
    // For mobile view, switch to map view when a result is clicked
    if (window.innerWidth < 1024) { // lg breakpoint in Tailwind
      setMobileView('map');
    }
  }, [searchResults, allGroups, selectedGroupId]);

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
      
      // Blur the input to dismiss the keyboard on mobile
      searchInputRef.current.blur();
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
    
    // Ensure searchType state is synchronized with the effective type being used
    if (directType !== undefined) {
      setSearchType(directType);
    }
    
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
    
    // Dismiss keyboard on mobile by blurring the input
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    
    // Pass the current searchType explicitly to ensure consistency
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

  // Update the return statement for consistent rendering
  return (
    <main className={`min-h-screen bg-gradient-to-b from-[#fff8f6] to-[#fff0eb] flex flex-col ${plusJakarta.variable} ${spaceGrotesk.variable} ${inter.variable} ${poppins.variable} relative`}>
      {/* Absolutely positioned logos in the top corners - improved responsive sizing */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        {/* Find My Pockets Logo - Left top corner */}
        <div className="w-20 sm:w-24 md:w-[8.4rem] lg:w-[9.8rem] h-auto">
          <div 
            className="w-full h-full"
            style={{
              background: 'linear-gradient(to right, #FF6242, #FF7D67)',
              WebkitMaskImage: 'url(/FMP_LaranjaGradient.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskImage: 'url(/FMP_LaranjaGradient.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center'
            }}
          >
            <img 
              src="/FMP_LaranjaGradient.svg" 
              alt="Find My Pockets Logo"
              className="opacity-0 w-full h-auto" 
            />
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        {/* Dunamis Pockets Logo - Right top corner */}
        <div className="w-20 sm:w-24 md:w-[8.4rem] lg:w-[9.8rem] h-auto">
          <div 
            className="w-full h-full"
            style={{
              background: 'linear-gradient(to right, #FF6242, #FF7D67)',
              WebkitMaskImage: 'url(/pockets-logo.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskImage: 'url(/pockets-logo.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center'
            }}
          >
            <img 
              src="/pockets-logo.svg" 
              alt="Dunamis Pockets Logo"
              className="opacity-0 w-full h-auto" 
            />
          </div>
        </div>
      </div>

      {/* Use stable gradient classes that are consistent between server/client */}
      <div className="bg-dunamis-gradient text-white relative overflow-hidden">
        {/* Enhanced decorative elements with more depth and visual interest */}
        <div className="absolute inset-0">
          {/* Primary glow elements - increased blur radius and size */}
          <div className="absolute top-[-40%] left-[-15%] w-[90%] h-[90%] bg-purple-900/40 rounded-full filter blur-[180px] opacity-50 animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[#FF6242]/30 rounded-full filter blur-[200px] opacity-40 animate-pulse-slower"></div>
          
          {/* Secondary glow elements */}
          <div className="absolute top-[5%] right-[10%] w-[60%] h-[60%] bg-purple-800/30 rounded-full filter blur-[150px] opacity-40 animate-pulse-slow" style={{ animationDelay: '-4s' }}></div>
          <div className="absolute bottom-[10%] left-[5%] w-[50%] h-[50%] bg-[#FF7D67]/25 rounded-full filter blur-[130px] opacity-35 animate-pulse-slower" style={{ animationDelay: '-6s' }}></div>
          
          {/* Additional violet blurs for more depth and variation */}
          <div className="absolute top-[30%] left-[35%] w-[70%] h-[70%] bg-purple-900/30 rounded-full filter blur-[170px] opacity-35 animate-float-subtle" style={{ animationDelay: '-3s' }}></div>
          <div className="absolute bottom-[35%] right-[30%] w-[65%] h-[65%] bg-[#2f1260]/30 rounded-full filter blur-[160px] opacity-40 animate-float-subtle" style={{ animationDelay: '-8s' }}></div>
          
          {/* Swirling accent elements for movement */}
          <div className="absolute top-[15%] left-[25%] w-[40%] h-[40%] bg-purple-800/25 rounded-full filter blur-[120px] opacity-30 animate-float-subtle" style={{ animationDelay: '-12s' }}></div>
          <div className="absolute bottom-[20%] right-[20%] w-[35%] h-[35%] bg-[#461c88]/25 rounded-full filter blur-[110px] opacity-35 animate-float-subtle" style={{ animationDelay: '-5s' }}></div>
          
          {/* Central glowing element */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-purple-900/20 rounded-full filter blur-[130px] opacity-40 animate-pulse-slower"></div>
          
          {/* Subtle moving highlights - enhanced orange accents */}
          <div className="absolute top-[20%] left-[20%] w-[25%] h-[25%] bg-white/5 rounded-full filter blur-[70px] animate-float-subtle"></div>
          <div className="absolute bottom-[25%] right-[25%] w-[20%] h-[20%] bg-[#FF6242]/20 rounded-full filter blur-[60px] animate-float-subtle" style={{ animationDelay: '-7s' }}></div>
          
          {/* Orange accent elements - enhanced and more consistent */}
          <div className="absolute top-[40%] right-[15%] w-[30%] h-[30%] bg-[#FF7D67]/15 rounded-full filter blur-[90px] opacity-30 animate-float-subtle" style={{ animationDelay: '-9s' }}></div>
          <div className="absolute bottom-[15%] left-[40%] w-[20%] h-[20%] bg-[#FF6A50]/15 rounded-full filter blur-[80px] opacity-25 animate-float-subtle" style={{ animationDelay: '-4s' }}></div>
          
          {/* Additional orange glow elements */}
          <div className="absolute top-[60%] right-[35%] w-[45%] h-[25%] bg-[#FF6242]/10 rounded-full filter blur-[120px] opacity-30 animate-float-subtle" style={{ animationDelay: '-2s' }}></div>
          <div className="absolute bottom-[45%] left-[15%] w-[30%] h-[30%] bg-[#FF7D67]/12 rounded-full filter blur-[100px] opacity-25 animate-float-subtle" style={{ animationDelay: '-10s' }}></div>
          
          {/* Subtle overlay pattern for texture */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiPjwvcmVjdD4KPC9zdmc+')] opacity-15"></div>
          
          {/* Vignette effect for more depth - softer version */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/20 opacity-30"></div>
        </div>
        
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-20 pb-14 md:py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            
            {/* PWA Install Button - Only visible when app is installable */}
            {isClient && isInstallable && (
              <div className="mt-6 mb-8 flex justify-center">
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white shadow-lg hover:bg-white/15 transition-all duration-300 group"
                >
                  <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[#FF6242] to-[#FF7D67] rounded-lg shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </span>
                  <span className="font-medium">
                    {isIOSDevice 
                      ? 'Instalar app no iPhone/iPad' 
                      : 'Instalar app no seu dispositivo'}
                  </span>
                  <span className="ml-1 text-xs py-1 px-2 bg-white/20 rounded-full group-hover:bg-white/25 transition-colors">
                    Grátis
                  </span>
                </button>
              </div>
            )}
            
            {/* Logo Section - Removed and repositioned to top corners */}
            <div className="inline-flex items-center justify-center mb-6 bg-white/5 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 shadow-sm mt-6 sm:mt-0">
              <span className="h-2 w-2 bg-primary rounded-full mr-2"></span>
              <span className="text-xs text-white font-medium tracking-wide uppercase">Encontre um polo de avivamento na sua universidade</span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight font-space-grotesk leading-none text-center">
              {/* Mobile: Two lines, Desktop: Single line */}
              <div className="md:whitespace-nowrap">
                <span className="block md:inline">Encontre um </span>
                <span className="block md:inline text-transparent bg-clip-text bg-gradient-to-r from-[#FF6242] to-[#FF7D67] relative">
                  Dunamis Pockets
                  <span className="absolute inset-0 bg-[#FF6242]/20 blur-xl opacity-40 -z-10 rounded-full animate-pulse-slow"></span>
                </span>
              </div>
            </h1>

            
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Only render interactive form on client side */}
            {isClient ? (
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  {/* Refined search input with subtle animation and better focus state */}
                  <div className="relative flex items-center bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-primary/10 border border-white/20 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => updateSearchTerm(e.target.value)}
                      onClick={handleSearchInputClick}
                      onFocus={() => setShowSuggestions(searchTerm.length >= 2)}
                      onBlur={() => {
                        // Don't hide suggestions right away to allow clicks on suggestions
                        setTimeout(() => {
                          if (!dropdownLockRef.current) {
                            setShowSuggestions(false);
                          }
                          // Also handle typing flag reset
                          isUserTypingRef.current = false;
                          if (typeof window !== 'undefined') {
                            window.isUserTyping = false;
                          }
                        }, 200);
                      }}
                      placeholder="Busque por universidade, cidade, estado ou país..."
                      className="w-full py-5 pl-6 pr-32 text-white placeholder-white/70 focus:outline-none text-base md:text-lg rounded-2xl bg-transparent"
                      aria-label="Pesquisar grupos"
                      autoComplete="off"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setShowSuggestions(false);
                          setSearchResults([]);
                          setSearchType(null);
                          
                          // Dismiss keyboard on mobile by blurring the input
                          if (searchInputRef.current) {
                            searchInputRef.current.blur();
                          }
                        }}
                        className="absolute right-24 text-white/70 hover:text-white focus:outline-none p-2 transition-colors"
                        aria-label="Limpar pesquisa"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="submit"
                      className="absolute right-0 h-full px-6 bg-gradient-to-r from-[#FF6242] to-[#FF7D67] text-white font-medium flex items-center justify-center hover:opacity-90 transition-all duration-300 rounded-r-2xl"
                      disabled={isLoading}
                      aria-label="Pesquisar"
                    >
                      {isLoading ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      ) : (
                        <div className="flex items-center">
                          <span className="mr-2 hidden sm:inline font-medium">Pesquisar</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Suggestions dropdown - only visible on client */}
                  {showSuggestions && (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl z-[100] overflow-y-auto border border-gray-100"
                      style={{ 
                        maxHeight: '65vh', // Use viewport height instead of fixed pixels
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        position: 'relative',
                        transform: 'translateZ(0)' // Force hardware acceleration for better rendering
                      }}
                    >
                      {isLoadingSuggestions ? (
                        <div className="p-4 text-gray-500 text-sm flex justify-center items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mr-2"></div>
                          Carregando sugestões...
                        </div>
                      ) : suggestionItems.length > 0 ? (
                        <ul className="py-1">
                          {suggestionItems.map((suggestion, index) => {
                            const isSelected = searchType === suggestion.type && searchTerm === suggestion.text;
                            
                            return (
                              <li 
                                key={index}
                                className={`px-4 py-3 hover:bg-secondary/80 cursor-pointer border-b border-gray-100/60 last:border-b-0 transition-all duration-200 ${
                                  isSelected ? 'bg-secondary/80' : ''
                                }`}
                                onClick={(e) => handleSelectSuggestion(suggestion, e)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    {suggestion.type === 'university' && (
                                      <div className={`w-10 h-10 flex-shrink-0 ${isSelected ? 'bg-secondary' : 'bg-secondary/50'} rounded-xl flex items-center justify-center mr-3 transition-colors duration-200`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14.5V20" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17.5h14" />
                                        </svg>
                                      </div>
                                    )}
                                    {suggestion.type === 'city' && (
                                      <div className={`w-10 h-10 flex-shrink-0 ${isSelected ? 'bg-secondary' : 'bg-secondary/50'} rounded-xl flex items-center justify-center mr-3 transition-colors duration-200`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                      </div>
                                    )}
                                    {suggestion.type === 'state' && (
                                      <div className={`w-10 h-10 flex-shrink-0 ${isSelected ? 'bg-secondary' : 'bg-secondary/50'} rounded-xl flex items-center justify-center mr-3 transition-colors duration-200`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                      </div>
                                    )}
                                    {suggestion.type === 'country' && (
                                      <div className={`w-10 h-10 flex-shrink-0 ${isSelected ? 'bg-secondary' : 'bg-secondary/50'} rounded-xl flex items-center justify-center mr-3 transition-colors duration-200`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-col">
                                      <span className={`font-medium ${isSelected ? 'text-primary' : 'text-gray-800'} transition-colors duration-200`}>
                                        {suggestion.displayText}
                                      </span>
                                      <span className="text-xs text-gray-500 font-medium">
                                        {suggestion.type === 'university' ? 'Universidade' : 
                                         suggestion.type === 'city' ? 'Cidade' : 
                                         suggestion.type === 'country' ? 'País' :
                                         'Estado'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className={`${
                                    suggestion.type === 'university' ? (isSelected ? 'bg-secondary text-secondary-foreground' : 'bg-secondary/50 text-secondary-foreground') :
                                    suggestion.type === 'city' ? (isSelected ? 'bg-secondary text-secondary-foreground' : 'bg-secondary/50 text-secondary-foreground') :
                                    suggestion.type === 'country' ? (isSelected ? 'bg-secondary text-secondary-foreground' : 'bg-secondary/50 text-secondary-foreground') :
                                    (isSelected ? 'bg-secondary text-secondary-foreground' : 'bg-secondary/50 text-secondary-foreground')
                                  } rounded-full px-3 py-1 text-xs font-medium ml-2 min-w-[56px] text-center transition-colors duration-200`}>
                                    {suggestion.count} {suggestion.count === 1 ? 'grupo' : 'grupos'}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="p-4 text-gray-500 text-sm text-center">
                          Nenhuma sugestão encontrada
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modern Quick Filter Pills with improved glass effect */}
                <div className="flex flex-wrap justify-center mt-6 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      // Don't clear search results - show all active groups instead
                      const activeGroups = allGroups.filter(group => group.active !== false);
                      setSearchResults(activeGroups);
                      setSearchType(null);
                      // Also clear the search type reference to prevent type persistence
                      lastSearchedTypeRef.current = null;
                      setHasSearched(true);
                      // Reset search but keep all groups visible on map
                      setFilteredGroups(activeGroups);
                      // Force map to update and fit all markers
                      setMapKey(prevKey => prevKey + 1);
                      
                      // Multiple attempts to fit bounds with increasing delays to ensure markers are loaded
                      // First attempt - short delay
                      setTimeout(() => {
                        if (mapRef.current) {
                          console.log("First attempt to fit bounds to all markers");
                          mapRef.current.fitBoundsToMarkers();
                        }
                      }, 200);
                      
                      // Second attempt - medium delay
                      setTimeout(() => {
                        if (mapRef.current) {
                          console.log("Second attempt to fit bounds to all markers");
                          mapRef.current.fitBoundsToMarkers();
                        }
                      }, 500);
                      
                      // Third attempt - longer delay for reliability
                      setTimeout(() => {
                        if (mapRef.current) {
                          console.log("Final attempt to fit bounds to all markers");
                          mapRef.current.fitBoundsToMarkers();
                        }
                      }, 1000);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#FF6242] to-[#FF7D67] text-white rounded-full text-sm font-medium shadow-lg hover:opacity-95 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#FF6242]/50 border border-[#FF6242]/20 flex items-center backdrop-blur-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mostrar todos os Pockets
                  </button>
                  
                  {['Brasil', 'São Paulo', 'Rio de Janeiro', 'USP'].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={(e: React.MouseEvent) => {
                        setSearchTerm(suggestion);
                        // Explicitly set searchType to null and pass null as directType
                        setSearchType(null);
                        performSearch(suggestion, e as unknown as React.FormEvent, true, null);
                      }}
                      className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-full text-sm hover:bg-white/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 shadow-md"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </form>
            ) : (
              /* Server-side render placeholder with identical structure */
              <div className="w-full">
                <div className="relative flex items-center bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl border border-white/20 h-16 md:h-[70px]">
                  <div className="w-full h-full bg-white/5"></div>
                  <div className="absolute right-0 h-full w-24 bg-primary rounded-r-2xl"></div>
                </div>
                
                <div className="flex flex-wrap justify-center mt-6 gap-2">
                  <div className="px-5 py-2.5 bg-primary/90 text-white rounded-full text-sm font-medium shadow-lg border border-primary/20 flex items-center backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mostrar todos os Pockets
                  </div>
                  
                  {['Brasil', 'São Paulo', 'Rio de Janeiro', 'USP'].map((suggestion) => (
                    <div
                      key={suggestion}
                      className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-full text-sm border border-white/10 shadow-sm"
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Always show the map section regardless of search state */}
        <>
          {/* Mobile View Controls - only show on client */}
          {isClient && (
            <div className="md:hidden flex justify-center mb-6">
              <div className="inline-flex rounded-xl bg-white/80 backdrop-blur-sm p-1 shadow-md border border-[#FF7D67]/20">
                <button
                  onClick={() => setMobileView('map')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    mobileView === 'map'
                      ? 'bg-gradient-to-r from-[#FF6242] to-[#FF7D67] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Mapa
                  </span>
                </button>
                <button
                  onClick={() => setMobileView('list')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    mobileView === 'list'
                      ? 'bg-gradient-to-r from-[#FF6242] to-[#FF7D67] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Lista
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Results Summary Bar - Only show if there are search results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-[#FF7D67]/20 flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-800">
                    {searchResults.length === 0 ? (
                      "Nenhum resultado encontrado"
                    ) : (
                      `${searchResults.length} ${searchResults.length === 1 ? 'grupo encontrado' : 'grupos encontrados'}`
                    )}
                  </span>
                  {searchTerm && (
                    <span className="ml-2 text-sm text-gray-500">
                      para <span className="font-medium text-[#FF6242]">{searchTerm}</span>
                    </span>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {(() => {
                      const startItem = (currentPage - 1) * itemsPerPage + 1;
                      const endItem = Math.min(currentPage * itemsPerPage, searchResults.length);
                      return `Mostrando ${startItem}-${endItem} de ${searchResults.length} grupos`;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Grid - Responsive Layout */}
          <div className={`grid ${isClient ? 'md:grid-cols-[380px,1fr]' : ''} gap-6`}>
            {/* List Column - Only render on client to avoid hydration issues */}
            {isClient && (
              <div className={`${mobileView === 'list' || !checkMobileView() ? 'block' : 'hidden'} md:block order-2 md:order-1`}>
                <div ref={resultsContainerRef} className="h-full flex flex-col">
                  {searchResults.length > 0 ? (
                    <SearchResults
                      searchResults={searchResults}
                      handleResultClick={handleResultClick}
                      selectedGroupId={selectedGroupId}
                    />
                  ) : (
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-[#FF7D67]/20 p-10 text-center">
                      <div className="w-16 h-16 bg-[#fff0eb] rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#FF6242]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
          </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">Nenhum resultado encontrado</h3>
                      <p className="text-gray-600 max-w-xs mx-auto">Tente outras palavras-chave ou explore os filtros rápidos acima para encontrar grupos.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map Column - Always display */}
            <div className={`${(isClient && (mobileView === 'map' || !checkMobileView())) ? 'block' : 'hidden'} md:block order-1 md:order-2 h-[65vh] md:h-[75vh] relative`} ref={mapContainerRef}>
              {/* Only render on client to avoid hydration issues */}
              {isClient && (
                <div className="h-full rounded-2xl overflow-hidden shadow-xl border border-[#FF7D67]/30 bg-white/70 backdrop-blur-sm">
                  <MapComponent
                    ref={mapRef}
                    groups={searchResults.length > 0 ? searchResults : allGroups}
                    selectedGroupId={selectedGroupId}
                    onMarkerClick={(groupId) => {
                      // Handle marker click logic
                      setSelectedGroupId(groupId);
                      handleResultClick(groupId);
                    }}
                    height="100%"
                    key={mapKey}
                    enableClustering={false}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      </div>

      {/* Footer */}
      <footer className="bg-dunamis-gradient text-white py-6 mt-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-white/80">
                {/* Use a static year for server rendering, and update it client-side */}
                © {isClient ? new Date().getFullYear() : 2023} Dunamis Pockets. Todos os direitos reservados.
              </p>
            </div>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/dunamispockets/" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://dunamismovement.com/" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors">
                <span className="sr-only">Website</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
