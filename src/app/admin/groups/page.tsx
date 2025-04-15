"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { Group } from '../../../lib/interfaces';
import { Map as MapIcon, Users, ChevronDown } from 'lucide-react';
import GroupList from '@/components/groups/GroupList';
import GroupListFilter from '@/components/groups/GroupListFilter';
import { Button } from '@/components/ui/button';
import StatusMessage from '@/components/StatusMessage';
import { normalizeText } from '@/lib/utils';
import { toast } from 'react-hot-toast';

// Flag to prevent duplicate Google Maps loading
declare global {
  // Tipagem será herdada de src/components/Map.tsx que já tem a tipagem correta
  interface Window {
    googleMapsLoaded: boolean;
  }
}

// Placeholder for the rest of the file - we'll gradually rebuild the component
export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean; isAssigned: boolean; assignedGroupId: string }[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState<boolean>(false);
  const [filteredLeaders, setFilteredLeaders] = useState<{ id: string; name: string; phone: string; email: string; curso: string; active?: boolean; isAssigned: boolean; assignedGroupId: string }[]>([]);
  const [leaderSearchTerm, setLeaderSearchTerm] = useState<string>('');
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

  // Add state variables for counts
  const [activeCount, setActiveCount] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);

  // Near the top, add the pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 25;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const prevSearchRef = useRef<string>('');
  const prevFilterRef = useRef<'all' | 'active' | 'inactive'>('active');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add this near the top of your component where other refs are defined
  const mapInitializedRef = useRef<boolean>(false);
  const mapLoadingRef = useRef<boolean>(false);

  // Cache for leader search to improve performance
  const leaderSearchCacheRef = useRef<{
    term: string;
    results: Record<string, { groups: Group[]; count: number }>
  }>({ term: '', results: {} });

  // Add this state to track autocomplete initialization
  const [autocompleteInitialized, setAutocompleteInitialized] = useState<boolean>(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Add this new function to fetch total counts
  const fetchTotalCounts = async () => {
    try {
      // Get active count
      const { count: totalActiveCount, error: activeError } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      
      if (!activeError && totalActiveCount !== null) {
        setActiveCount(totalActiveCount);
      }
      
      // Get inactive count
      const { count: totalInactiveCount, error: inactiveError } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('active', false);
      
      if (!inactiveError && totalInactiveCount !== null) {
        setInactiveCount(totalInactiveCount);
      }
    } catch (error) {
      console.error("Error fetching total counts:", error);
    }
  };

  // Fetch groups and leaders on component mount
  useEffect(() => {
    // Start with loading state
    setIsLoading(true);
    
    // Define a function to load all initial data
    const loadInitialData = async () => {
      try {
        // Initialize reference values to prevent duplicate fetches
        prevSearchRef.current = searchTerm;
        prevFilterRef.current = filterActive;
        
        // First load the groups
        await fetchGroups(true);
        
        // Get total counts
        await fetchTotalCounts();
        
        // Then load the leaders
        await fetchLeaders();
      } catch (error) {
        console.error("Error loading initial data:", error);
        setStatusMessage({
          text: "Ocorreu um erro ao carregar os dados. Por favor, tente novamente.",
          type: "error"
        });
      } finally {
        // Ensure loading state is turned off when everything is done
        setIsLoading(false);
      }
    };
    
    loadInitialData();
    
    // Cleanup function - reset state when component unmounts
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Fetch leaders
  const fetchLeaders = async () => {
    try {
      // First get all leaders with a single query
      const { data: leadersData, error } = await supabase
        .from('leaders')
        .select('*');
      
      if (error) throw error;

      // Then get all groups to check which leaders are already assigned in a single query
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('leader_id, id')
        .eq('active', true);
      
      if (groupsError) throw groupsError;
      
      if (leadersData) {
        // Create a map of assigned leader IDs for O(1) lookups
        const assignedLeaderIdsMap = groupsData.reduce((acc, group) => {
          if (group.leader_id) {
            acc[group.leader_id] = group.id;
          }
          return acc;
        }, {} as Record<string, string>);
        
        const formattedLeaders = leadersData.map(leader => ({
          id: leader.id,
          name: leader.name,
          phone: leader.phone,
          email: leader.email || '',
          curso: leader.curso || '',
          active: leader.active ?? true,
          isAssigned: !!assignedLeaderIdsMap[leader.id],
          assignedGroupId: assignedLeaderIdsMap[leader.id]
        }));
        
        // Sort leaders alphabetically by name for better UX
        formattedLeaders.sort((a, b) => a.name.localeCompare(b.name));
        
        // Store all leaders
        setLeaders(formattedLeaders);
        
        // Filter leaders for dropdown based on editing state
        if (editingGroup) {
          updateFilteredLeaders(formattedLeaders, editingGroup);
        } else {
          // Only show unassigned, active leaders if not editing
          setFilteredLeaders(
            formattedLeaders.filter(leader => 
              !leader.isAssigned && leader.active !== false
            )
          );
        }
      }
    } catch (error) {
      console.error("Erro ao buscar líderes:", error);
      setStatusMessage({
        text: `Erro ao buscar líderes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        type: 'error'
      });
    }
  };
  
  // Create a memoized function to update filtered leaders
  const updateFilteredLeaders = useCallback((
    allLeaders: { 
      id: string; 
      name: string; 
      phone: string; 
      email: string; 
      curso: string; 
      active?: boolean; 
      isAssigned: boolean; 
      assignedGroupId: string 
    }[], 
    currentGroup: Group
  ) => {
    const currentEditingLeaderId = currentGroup.leader_id;
    
    // Filter leaders list:
    // 1. Include active leaders
    // 2. Include the current group's leader even if inactive
    // 3. Exclude leaders assigned to other groups
    const availableLeaders = allLeaders.filter((leader) => 
      (leader.active !== false) || // Include active leaders
      (leader.id === currentEditingLeaderId) // Include current leader even if inactive
    ).filter((leader) =>
      !leader.isAssigned || // Include unassigned leaders
      leader.id === currentEditingLeaderId // Include current leader even if assigned
    );
    
    // If there's a search term, filter by that as well
    if (leaderSearchTerm) {
      const searchLower = normalizeText(leaderSearchTerm.toLowerCase());
      setFilteredLeaders(
        availableLeaders.filter((leader) => {
          const nameMatch = normalizeText(leader.name.toLowerCase()).includes(searchLower);
          const emailMatch = leader.email && normalizeText(leader.email.toLowerCase()).includes(searchLower);
          const phoneMatch = leader.phone && leader.phone.includes(searchLower);
          return nameMatch || emailMatch || phoneMatch;
        })
      );
    } else {
      setFilteredLeaders(availableLeaders);
    }
  }, [leaderSearchTerm]);

  // Fetch groups function with pagination and filtering
  const fetchGroups = async (resetPage = false) => {
    setIsLoading(true);
    
    try {
      console.log(`fetchGroups called with searchTerm: "${searchTerm}", filterActive: ${filterActive}`);
      
      let query = supabase.from('groups').select('*', { count: 'exact' });
      
      // Apply active/inactive filter
      if (filterActive === 'active') {
        query = query.eq('active', true);
      } else if (filterActive === 'inactive') {
        query = query.eq('active', false);
      }
      
      // Add sorting by university name - alphabetical order
      query = query.order('university', { ascending: true });
      
      // Apply search term if present
      if (searchTerm) {
        console.log('Original search term:', searchTerm);
        const searchLower = normalizeText(searchTerm);
        
        // Always try both search methods and combine results
        try {
          // First try direct search on groups table
          console.log('Searching directly in groups table for:', searchLower);
          
          // Use more comprehensive normalized search for better text matching
          query = query.or(
            `university.ilike.%${searchLower}%,` +
            `city.ilike.%${searchLower}%,` + 
            `state.ilike.%${searchLower}%,` + 
            `country.ilike.%${searchLower}%`
          );
          
          // Execute the query for direct group search
          console.log('Executing groups table search');
          
          // Calculate pagination values
          const from = (currentPage - 1) * ITEMS_PER_PAGE;
          const to = from + ITEMS_PER_PAGE - 1;
          
          // Apply range for pagination
          query = query.range(from, to);
          
          // Execute the query
          const { data: groupsResult, error: groupsError, count: groupsCount } = await query;
          
          if (groupsError) throw groupsError;
          
          // If we didn't find any results in groups, try leader search
          if (!groupsResult || groupsResult.length === 0) {
            console.log('No results from group search, trying leader search for:', searchLower);
            
            // Search by leader name as fallback
            const leaderSearchResult = await searchByLeaderName(searchTerm, filterActive);
            
            if (leaderSearchResult.groups.length > 0) {
              console.log(`Found ${leaderSearchResult.groups.length} groups via leader search`);
              
              // If we found results through leader search, use those
              setGroups(leaderSearchResult.groups);
              setTotalCount(leaderSearchResult.count);
              
              // Update counts
              setActiveCount(leaderSearchResult.groups.filter(g => g.active).length);
              setInactiveCount(leaderSearchResult.groups.filter(g => !g.active).length);
              
              setIsLoading(false);
              return;
            } else {
              console.log('No results from leader search either');
              // If no results from either search
              setGroups([]);
              setTotalCount(0);
              setIsLoading(false);
              return;
            }
          } else {
            console.log(`Found ${groupsResult.length} groups via direct table search`);
            setGroups(groupsResult);
            if (groupsCount !== null) {
              setTotalCount(groupsCount);
            }
            
            // Add debug logging to check if the filtered results match the selected filter
            console.log(`Fetched ${groupsResult.length} groups with filter: ${filterActive}`);
            console.log(`Active groups in result: ${groupsResult.filter(group => group.active).length}`);
            console.log(`Inactive groups in result: ${groupsResult.filter(group => !group.active).length}`);
            
            // Calculate active/inactive counts for the filters
            const activeGroups = groupsResult.filter(group => group.active).length;
            const inactiveGroups = groupsResult.filter(group => !group.active).length;
            
            setActiveCount(activeGroups);
            setInactiveCount(inactiveGroups);
            
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error in search:", error);
          setStatusMessage({
            text: `Erro na busca: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            type: 'error'
          });
        }
      } else {
        console.log('No search term, fetching all groups with filter:', filterActive);
      }
      
      // Calculate pagination values
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      // Apply range for pagination
      query = query.range(from, to);
      
      // Execute the query
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      if (data) {
        setGroups(data);
        if (count !== null) {
          setTotalCount(count);
        }
        
        // Add debug logging to check if the filtered results match the selected filter
        console.log(`Fetched ${data.length} groups with filter: ${filterActive}`);
        console.log(`Active groups in result: ${data.filter(group => group.active).length}`);
        console.log(`Inactive groups in result: ${data.filter(group => !group.active).length}`);
        
        // Calculate active/inactive counts for the filters
        const activeGroups = data.filter(group => group.active).length;
        const inactiveGroups = data.filter(group => !group.active).length;
        
        // If not filtering, update the counts based on the returned data
        if (filterActive === 'all' && !searchTerm) {
          setActiveCount(activeGroups);
          setInactiveCount(inactiveGroups);
        } 
        // Otherwise, we need to make a separate count query for the filters
        else if (searchTerm || filterActive !== 'all') {
          // For active count
          const { count: activeCount, error: activeError } = await supabase
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);
          
          if (!activeError && activeCount !== null) {
            setActiveCount(activeCount);
          }
          
          // For inactive count
          const { count: inactiveCount, error: inactiveError } = await supabase
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('active', false);
          
          if (!inactiveError && inactiveCount !== null) {
            setInactiveCount(inactiveCount);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      setStatusMessage({
        text: `Erro ao buscar grupos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Implement the searchByLeaderName function
  const searchByLeaderName = async (
    searchTerm: string,
    filter: 'active' | 'inactive' | 'all'
  ): Promise<{ groups: Group[]; count: number }> => {
    try {
      // Check the cache first
      const cacheKey = `${searchTerm}-${filter}`;
      const cachedResult = leaderSearchCacheRef.current.results[cacheKey];
      
      if (cachedResult) {
        console.log('Using cached result for leader search:', cacheKey);
        return cachedResult;
      }
      
      // Normalize search term for better matching
      const normalizedSearchTerm = normalizeText(searchTerm);
      
      // Split the search term into words to search for each word independently
      const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);
      
      // Build the query
      let leadersQuery = supabase.from('leaders').select('id, name');
      
      // If we have multiple words, search for each word independently
      if (searchWords.length > 1) {
        const orConditions = searchWords.map(word => `name.ilike.%${word}%`).join(',');
        leadersQuery = leadersQuery.or(orConditions);
      } else {
        // Single word search
        leadersQuery = leadersQuery.ilike('name', `%${normalizedSearchTerm}%`);
      }
      
      // Execute the query
      const { data: leadersData, error: leadersError } = await leadersQuery.order('name');
      
      if (leadersError) throw leadersError;
      
      if (!leadersData || leadersData.length === 0) {
        return { groups: [], count: 0 };
      }
      
      console.log(`Leader search for "${normalizedSearchTerm}" found ${leadersData.length} matching leaders`);
      
      // Extract the leader IDs
      const leaderIds = leadersData.map(leader => leader.id);
      
      // Now fetch groups with these leader IDs
      let groupsQuery = supabase
        .from('groups')
        .select('*', { count: 'exact' })
        .in('leader_id', leaderIds)
        .order('university', { ascending: true });
      
      // Apply active/inactive filter if needed
      if (filter === 'active') {
        groupsQuery = groupsQuery.eq('active', true);
      } else if (filter === 'inactive') {
        groupsQuery = groupsQuery.eq('active', false);
      }
      
      const { data: groupsData, error: groupsError, count } = await groupsQuery;
      
      if (groupsError) throw groupsError;
      
      const result = {
        groups: groupsData || [],
        count: count !== null ? count : (groupsData?.length || 0),
      };
      
      // Store in cache for future use
      leaderSearchCacheRef.current = {
        term: searchTerm,
        results: {
          ...leaderSearchCacheRef.current.results,
          [cacheKey]: result
        }
      };
      
      return result;
    } catch (error) {
      console.error('Error searching by leader name:', error);
      return { groups: [], count: 0 };
    }
  };
  
  // Add the event handlers needed for basic functionality
  const handleFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    // Skip if we're already on this filter
    if (filterActive === filter) return;
    
    console.log(`Filter changing from ${filterActive} to ${filter}`);
    
    setFilterActive(filter);
    setCurrentPage(1);
    
    // Fetch new data with this filter
    // Pass the new filter value directly to avoid state timing issues
    fetchGroupsWithFilter(filter, true);
    
    // Also fetch total counts to ensure the filter tabs show correct numbers
    fetchTotalCounts();
  };
  
  // New function that takes filter as a parameter to avoid state timing issues
  const fetchGroupsWithFilter = async (filter: 'all' | 'active' | 'inactive', resetPage = false) => {
    setIsLoading(true);
    
    try {
      console.log(`fetchGroupsWithFilter called with searchTerm: "${searchTerm}", filter: ${filter}`);
      
      let query = supabase.from('groups').select('*', { count: 'exact' });
      
      // Apply active/inactive filter
      if (filter === 'active') {
        query = query.eq('active', true);
      } else if (filter === 'inactive') {
        query = query.eq('active', false);
      }
      
      // Apply search filter if there's a search term
      if (searchTerm) {
        // Use normalized text for better search matching
        const searchLower = normalizeText(searchTerm);
        
        // Enhanced search across multiple fields
        query = query.or(
          `university.ilike.%${searchLower}%,` +
          `city.ilike.%${searchLower}%,` + 
          `state.ilike.%${searchLower}%,` + 
          `country.ilike.%${searchLower}%`
        );
      }
      
      // Add sorting by university name - alphabetical order
      query = query.order('university', { ascending: true });
      
      // Calculate pagination values
      const startRow = (currentPage - 1) * ITEMS_PER_PAGE;
      query = query.range(startRow, startRow + ITEMS_PER_PAGE - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching groups:', error);
        toast.error(`Error fetching groups: ${error.message}`);
        return;
      }
      
      // If we have a search term but found no results through standard search, try leader search
      if (searchTerm && (!data || data.length === 0)) {
        console.log('No results from direct group search, trying leader search');
        
        // Search by leader name using our existing function
        const leaderSearchResult = await searchByLeaderName(searchTerm, filter);
        
        if (leaderSearchResult.groups.length > 0) {
          console.log(`Found ${leaderSearchResult.groups.length} groups via leader search`);
          
          // If we found results through leader search, use those
          setGroups(leaderSearchResult.groups);
          setTotalCount(leaderSearchResult.count);
          
          // Update page if needed
          if (resetPage) {
            setCurrentPage(1);
          }
          
          setIsLoading(false);
          return;
        }
      }
      
      // Update the groups with fetched data
      setGroups(data || []);
      
      // Update total count for pagination
      if (count !== null) {
        setTotalCount(count);
        const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
        // Make sure current page doesn't exceed the total number of pages
        if (resetPage) {
          setCurrentPage(1);
        } else if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
        }
      }
      
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error in fetchGroupsWithFilter:', error);
      toast.error(`Error fetching groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };
  
  // Special function to clear search and fetch all
  const clearSearchAndFetchAll = () => {
    console.log("Clearing search and fetching all groups");
    setSearchTerm("");
    prevSearchRef.current = "";
    setCurrentPage(1);
    // Use our filter-aware function to make sure we use the latest filter
    fetchGroupsWithFilter(filterActive);
    fetchTotalCounts();
  };

  const handleSearchChange = (value: string) => {
    console.log(`Search term changed to: "${value}"`);
    
    // Clear any existing debounce timeout first
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // If clearing the search (value is empty), force an immediate fetch
    if (value === '' && searchTerm !== '') {
      console.log("Search cleared, calling special clear function");
      // Use our special function for clearing search
      clearSearchAndFetchAll();
      return;
    }
    
    // For non-empty search terms, update the state then debounce
    setSearchTerm(value);
    
    // Reset to page 1 when search changes
    if (prevSearchRef.current !== value) {
      setCurrentPage(1);
    }
    
    // Debounce for non-empty searches
    console.log(`Debouncing search for: "${value}"`);
    debounceTimeoutRef.current = setTimeout(() => {
      prevSearchRef.current = value;
      // Use the new filter-aware function instead of fetchGroups
      fetchGroupsWithFilter(filterActive);
    }, 500);
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    fetchGroups();
  };
  
  const handleNextPage = () => {
    const nextPage = Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), currentPage + 1);
    handlePageChange(nextPage);
  };
  
  const handlePreviousPage = () => {
    const prevPage = Math.max(1, currentPage - 1);
    handlePageChange(prevPage);
  };
  
  // Use useMemo to calculate the paginated groups from the full list
  const paginatedGroups = useMemo(() => {
    return groups;
  }, [groups]);
  
  // Calculate filtered groups for display
  const filteredGroups = useMemo(() => {
    console.log(`Pagination state: page ${currentPage}, totalCount: ${totalCount}, showing items per page: ${ITEMS_PER_PAGE}`);
    return groups;
  }, [groups, currentPage, totalCount]);

  // Add or update the validation function
  const validateGroupForm = () => {
    const errors: {[key: string]: string} = {};

    // Check required fields
    if (!editingGroup?.university) {
      errors.university = "Nome da instituição é obrigatório";
    }

    if (!editingGroup?.city) {
      errors.city = "Cidade é obrigatória";
    }

    if (!editingGroup?.state) {
      errors.state = "Estado é obrigatório";
    }

    if (!editingGroup?.country) {
      errors.country = "País é obrigatório";
    }

    // Check if a leader is selected
    if (!selectedLeaderId) {
      errors.leader = "Selecione um líder para o grupo";
    }

    // Check Instagram format if provided
    if (editingGroup?.instagram) {
      // Remove @ symbol if present
      const instagramHandle = editingGroup.instagram.startsWith('@') 
        ? editingGroup.instagram.substring(1) 
        : editingGroup.instagram;
      
      // Check for valid format
      if (!/^[a-zA-Z0-9._]+$/.test(instagramHandle)) {
        errors.instagram = "Nome de usuário do Instagram inválido. Use apenas letras, números, pontos e underscores.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Update the saveEdits function
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
        setFormErrors(prev => ({ ...prev, leader: "Líder selecionado não encontrado" }));
        return;
      }
      
      // Format instagram handle (remove @ if present)
      const instagramHandle = editingGroup.instagram?.startsWith('@') 
        ? editingGroup.instagram.substring(1) 
        : editingGroup.instagram || '';
      
      // Prepare update data with all editable fields
      const updateData = {
        instagram: instagramHandle,
        tipo: editingGroup.tipo || 'Publica',
        meetingTimes: editingGroup.meetingTimes || [],
        leader: {
          name: selectedLeader.name,
          phone: selectedLeader.phone,
          email: selectedLeader.email || '',
          curso: selectedLeader.curso || '',
          active: selectedLeader.active ?? true
        },
        leader_id: selectedLeaderId,
        active: editingGroup.active !== false,
        updated_at: new Date().toISOString()
      };
      
      // If location was changed, update related fields
      if (locationSelected) {
        Object.assign(updateData, {
          university: editingGroup.university,
          city: editingGroup.city,
          state: editingGroup.state,
          country: editingGroup.country,
          fulladdress: editingGroup.fulladdress || '',
          coordinates: editingGroup.coordinates
        });
      }
      
      const { error } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', editingGroup.id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Grupo em ${editingGroup.university} atualizado com sucesso`, type: 'success' });
      
      // Reset state
      setEditingGroup(null);
      setShowLocationEdit(false);
      setLocationSelected(false);
      setSelectedLeaderId('');
      setLeaderSearchTerm('');
      setFormErrors({});
      setActiveTab('details');
      
      // Fetch updated groups
      fetchGroups(false);
    } catch (error) {
      console.error("Error saving group:", error);
      setStatusMessage({ 
        text: `Erro ao salvar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 
        type: 'error' 
      });
    }
  };

  // Handlers for group actions
  const startEditing = (group: Group) => {
    console.log("Start editing group:", group.id);
    
    // Reset map initialization flags to ensure proper reinitialization
    mapInitializedRef.current = false;
    mapLoadingRef.current = false;
    
    // Clear previous map instances
    if (map) {
      setMap(null);
    }
    if (marker) {
      setMarker(null);
    }
    
    // Make sure we have valid coordinates to prevent errors
    const safeCoordinates = {
      latitude: group.coordinates?.latitude || 0,
      longitude: group.coordinates?.longitude || 0
    };
    
    // Create a complete copy of the group with all required fields
    setEditingGroup({
      ...group,
      coordinates: safeCoordinates,
      instagram: group.instagram || '',
      tipo: group.tipo || 'Publica',
      active: group.active !== false
    });
    
    setShowLocationEdit(false);
    setLocationSelected(false);
    setActiveTab('details'); // Ensure we start on the details tab
    
    // Find the leader ID based on the leader data in the group
    const leaderInGroup = group.leader;
    const foundLeader = leaders.find(leader => 
      leader.name === leaderInGroup.name && 
      leader.phone === leaderInGroup.phone
    );
    
    if (foundLeader) {
      setSelectedLeaderId(foundLeader.id);
      setLeaderSearchTerm(foundLeader.name); // Set the search term to the leader's name
    } else {
      setSelectedLeaderId('');
      setLeaderSearchTerm(''); // Clear the search term
    }
    
    // Reset form errors when starting edit
    setFormErrors({});
  };
  
  // Implement the toggle active functionality
  const handleToggleActive = (id: string, university: string, currentStatus: boolean) => {
    console.log(`Toggle active for group: ${university}, current status: ${currentStatus}`);
    if (currentStatus) {
      console.log(`Deactivating group: ${university}`);
      deactivateGroup(id, university);
    } else {
      console.log(`Reactivating group: ${university}`);
      reactivateGroup(id, university);
    }
  };
  
  // Function to deactivate a group
  const deactivateGroup = async (id: string, university: string) => {
    try {
      setStatusMessage({ 
        text: `Desativando grupo: ${university}...`, 
        type: 'info' 
      });
      
      const { error } = await supabase
        .from('groups')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      // Refetch groups to update UI
      await fetchGroups();
      
      // Also update the total counts
      await fetchTotalCounts();
      
      setStatusMessage({ 
        text: `Grupo "${university}" desativado com sucesso`, 
        type: 'success' 
      });
      
      // Auto dismiss after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error deactivating group:", error);
      setStatusMessage({ 
        text: `Erro ao desativar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 
        type: 'error' 
      });
    }
  };
  
  // Function to reactivate a group
  const reactivateGroup = async (id: string, university: string) => {
    try {
      setStatusMessage({ 
        text: `Reativando grupo: ${university}...`, 
        type: 'info' 
      });
      
      const { error } = await supabase
        .from('groups')
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      // Refetch groups to update UI
      await fetchGroups();
      
      // Also update the total counts
      await fetchTotalCounts();
      
      setStatusMessage({ 
        text: `Grupo "${university}" reativado com sucesso`, 
        type: 'success' 
      });
      
      // Auto dismiss after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error reactivating group:", error);
      setStatusMessage({ 
        text: `Erro ao reativar grupo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 
        type: 'error' 
      });
    }
  };

  // New helper function to generate page numbers to display
  const getPageNumbers = () => {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    
    // If we have 7 or fewer pages, show all pages
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Otherwise, show first page, current page, last page, and pages around current page
    // with ellipses where needed
    const pageNumbers = [];
    
    // Always show first page
    pageNumbers.push(1);
    
    // Handle start range
    if (currentPage > 3) {
      pageNumbers.push('ellipsis');
    }
    
    // Pages around current page
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);
    
    // Add page numbers around current page
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    // Handle end range
    if (currentPage < totalPages - 2) {
      pageNumbers.push('ellipsis');
    }
    
    // Always show last page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  // Add a new effect for the map initialization when editing location
  useEffect(() => {
    if (!editingGroup || activeTab !== 'location' || !mapRef.current) return;
    
    const loadGoogleMaps = async () => {
      if (!window.google || !window.google.maps) {
        // Check if Google Maps is already being loaded
        if (window.googleMapsLoaded) return;
        
        // Mark as loading to prevent duplicate loading
        window.googleMapsLoaded = true;
        
        try {
          // Load Google Maps API
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
          
          // Wait for the script to load
          await new Promise<void>((resolve) => {
            script.onload = () => resolve();
          });
        } catch (error) {
          console.error('Error loading Google Maps:', error);
          return;
        }
      }
      
      // Initialize the map once Google Maps is loaded
      const coordinates = editingGroup.coordinates || {
        latitude: -23.5505, // Default to São Paulo
        longitude: -46.6333
      };
      
      // Add non-null assertion since we already checked mapRef.current is not null
      const mapInstance = new window.google.maps.Map(mapRef.current!, {
        center: { lat: coordinates.latitude, lng: coordinates.longitude },
        zoom: 14,
        mapTypeControl: true,
        fullscreenControl: false,
        gestureHandling: 'greedy' // Make mobile usage easier
      });
      
      // Create marker
      const markerInstance = new window.google.maps.Marker({
        position: { lat: coordinates.latitude, lng: coordinates.longitude },
        map: mapInstance,
        draggable: true,
        title: "Localização do grupo"
      });
      
      // Add drag end listener to marker
      markerInstance.addListener('dragend', () => {
        const position = markerInstance.getPosition();
        if (position) {
          const lat = position.lat();
          const lng = position.lng();
          
          // Update coordinates in state
          setEditingGroup(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              coordinates: {
                latitude: lat,
                longitude: lng
              }
            };
          });
        }
      });
      
      // Save map and marker instances
      setMap(mapInstance);
      setMarker(markerInstance);
    };
    
    loadGoogleMaps();
    
    // Cleanup function
    return () => {
      if (marker) {
        marker.setMap(null);
      }
    };
  }, [editingGroup, activeTab]);

  // Add this function to clear specific form errors
  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      const updatedErrors = { ...formErrors };
      delete updatedErrors[fieldName];
      setFormErrors(updatedErrors);
    }
  };

  // Add this function to initialize Google Places autocomplete for location selection
  const initAutocomplete = useCallback(() => {
    if (typeof window === 'undefined' || !window.google?.maps?.places || !autocompleteInputRef.current) {
      console.log("Unable to initialize autocomplete - Google Places API or input not available");
      return;
    }
    
    if (autocompleteRef.current) {
      console.log("Cleaning up existing autocomplete instance");
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
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
      setAutocompleteInitialized(true);
      
      // Add place_changed event listener
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place || !place.geometry || !place.geometry.location) {
          return;
        }
        
        const location = place.geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        // Center map and update marker
        if (map) {
          map.setCenter(location);
          map.setZoom(14);
        }
        
        if (marker) {
          marker.setPosition(location);
        }
        
        // Extract address components
        let city = '';
        let state = '';
        let country = '';
        let zipcode = '';
        const university = place.name || '';
        const fulladdress = place.formatted_address || '';
        
        // Parse address components to extract city, state, country
        place.address_components?.forEach(component => {
          const types = component.types;
          
          if (types.includes('locality') || types.includes('postal_town')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          } else if (types.includes('country')) {
            country = component.long_name;
          } else if (types.includes('postal_code')) {
            zipcode = component.long_name;
          }
        });
        
        console.log("Extracted data:", { 
          university, 
          city, 
          state, 
          country, 
          fulladdress
        });
        
        // Update group information
        setEditingGroup(prev => {
          if (!prev) return prev;
          return {
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
          };
        });
        
        // Mark that a location has been selected
        setLocationSelected(true);
      });
      
      console.log("Google Places autocomplete initialized successfully");
    } catch (error) {
      console.error("Error initializing Places autocomplete:", error);
      autocompleteRef.current = null;
      setAutocompleteInitialized(false);
    }
  }, [map, marker, setLocationSelected]);

  // Add a use effect to initialize autocomplete when editing location tab
  useEffect(() => {
    if (editingGroup && activeTab === 'location' && window.google?.maps?.places && !autocompleteInitialized) {
      // Initialize autocomplete
      setTimeout(() => {
        initAutocomplete();
      }, 300);
    }
    
    // Cleanup function
    return () => {
      if (autocompleteRef.current) {
        try {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (e) {
          console.error("Error clearing autocomplete listeners:", e);
        }
        autocompleteRef.current = null;
      }
    };
  }, [editingGroup, activeTab, initAutocomplete, autocompleteInitialized]);

  // Improve leader filtering function to better handle search
  const getFilteredLeadersForDisplay = useMemo(() => {
    if (!leaderSearchTerm.trim()) {
      return filteredLeaders;
    }
    
    // Normalize search term for better matching
    const normalizedSearchTerm = normalizeText(leaderSearchTerm.toLowerCase());
    
    // Filter leaders based on search term
    return filteredLeaders.filter(leader => {
      const normalizedName = normalizeText(leader.name.toLowerCase());
      const normalizedCurso = normalizeText((leader.curso || '').toLowerCase());
      const normalizedEmail = normalizeText((leader.email || '').toLowerCase());
      const normalizedPhone = normalizeText(leader.phone.toLowerCase());
      
      return normalizedName.includes(normalizedSearchTerm) ||
        normalizedCurso.includes(normalizedSearchTerm) ||
        normalizedEmail.includes(normalizedSearchTerm) ||
        normalizedPhone.includes(normalizedSearchTerm);
    });
  }, [filteredLeaders, leaderSearchTerm]);

  // Add this function to focus the input field and initialize autocomplete when needed
  const handleLocationInputFocus = () => {
    if (window.google?.maps?.places && !autocompleteInitialized) {
      initAutocomplete();
    }
  };

  // Update the handleClickOutside function to properly handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle clicks outside leader dropdown
      if (
        leaderDropdownRef.current && 
        !leaderDropdownRef.current.contains(event.target as Node) && 
        showLeaderDropdown
      ) {
        setShowLeaderDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLeaderDropdown]);

  // Updated return statement
  return (
    <div className="min-h-screen">
      {statusMessage && (
        <StatusMessage 
          type={statusMessage.type} 
          text={statusMessage.text} 
          onClose={() => setStatusMessage(null)} 
        />
      )}
      
      <div className="mb-6">
        <div>
          {/* Groups List Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-800 flex items-center justify-center">
                <MapIcon className="h-5 w-5 mr-2 text-primary/70" />
                Lista de Grupos {isLoading ? (
                  <span className="inline-flex items-center ml-2">
                    <span className="w-3 h-3 border-t-2 border-primary rounded-full animate-spin ml-2 mr-1"></span>
                    <span className="text-sm text-gray-500">Carregando...</span>
                  </span>
                ) : (
                  `(${filteredGroups.length})`
                )}
              </h2>
            </div>
            
            <div className="p-4">
              <GroupListFilter 
                totalCount={activeCount + inactiveCount}
                activeFilter={filterActive}
                searchTerm={searchTerm}
                onFilterChange={handleFilterChange}
                onSearchChange={handleSearchChange}
                activeCount={activeCount}
                inactiveCount={inactiveCount}
                isLoading={isLoading}
              />
              
              <GroupList 
                groups={paginatedGroups}
                isLoading={isLoading}
                searchTerm={searchTerm}
                filterActive={filterActive}
                onEdit={startEditing}
                onToggleActive={handleToggleActive}
                onSearchChange={handleSearchChange}
              />
              
              {/* Pagination */}
              {totalCount > ITEMS_PER_PAGE && (
                <div className="flex justify-between items-center border-t border-gray-200 px-4 py-3 mt-4">
                  <div className="hidden sm:block">
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> de <span className="font-medium">{totalCount}</span> grupos
                    </p>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Anterior
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="hidden md:flex mx-1">
                      {getPageNumbers().map((page, index) => 
                        page === 'ellipsis' ? (
                          <span key={`ellipsis-${index}`} className="px-3 py-1 text-sm text-gray-700">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={`page-${page}`}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page as number)}
                            className={`mx-0.5 min-w-8 px-3 py-1 text-sm font-medium ${
                              currentPage === page 
                                ? 'bg-primary text-white hover:bg-primary/90' 
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </Button>
                        )
                      )}
                    </div>
                    
                    {/* Mobile pagination info */}
                    <span className="md:hidden px-3 py-1 text-sm text-gray-700">
                      {currentPage} / {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === Math.ceil(totalCount / ITEMS_PER_PAGE)}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary/90 to-primary border-b border-primary/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Editar Grupo - {editingGroup.university}
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setEditingGroup(null)}
                className="text-white hover:text-white/90 hover:bg-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            
            <div className="p-6">
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
                <div className="flex">
                  <svg className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Edite as informações do grupo preenchendo o formulário abaixo. Todos os campos marcados com <span className="text-red-500">*</span> são obrigatórios.</span>
                </div>
              </div>
              
              {/* Tabs for different sections */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8" aria-label="Tabs">
                  <button
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'details'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setActiveTab('details');
                      // Clear any form errors when switching tabs
                      setFormErrors({});
                    }}
                  >
                    <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Detalhes do Grupo
                  </button>
                  <button
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'location'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setActiveTab('location');
                      // Clear any form errors when switching tabs
                      setFormErrors({});
                    }}
                  >
                    <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Localização
                  </button>
                </nav>
              </div>
              
              {/* Details Tab Content */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Institution Details Section */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-md font-semibold text-gray-700 flex items-center">
                        <svg className="h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Informações da Instituição
                      </h3>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Institution Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Instituição <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={editingGroup.tipo}
                            onChange={(e) => setEditingGroup({...editingGroup, tipo: e.target.value})}
                            className={`w-full p-2 border ${formErrors.tipo ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors`}
                            required
                          >
                            <option value="Publica">Pública</option>
                            <option value="Privada">Privada</option>
                          </select>
                        </div>
                        
                        {/* Instagram */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Instagram
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500">@</span>
                            </div>
                            <input
                              type="text"
                              placeholder="usuário_instagram"
                              value={editingGroup.instagram || ''}
                              onChange={(e) => setEditingGroup({...editingGroup, instagram: e.target.value.startsWith('@') ? e.target.value.substring(1) : e.target.value})}
                              className={`pl-8 w-full p-2 border ${formErrors.instagram ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors`}
                            />
                          </div>
                          {formErrors.instagram && (
                            <p className="mt-1 text-sm text-red-600">{formErrors.instagram}</p>
                          )}
                        </div>
                        
                        {/* Add location display link */}
                        <div className="md:col-span-2 mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Localização
                          </label>
                          <div className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50">
                            <MapIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-700">{editingGroup.university} • {editingGroup.city}, {editingGroup.state}</span>
                            <button 
                              type="button" 
                              className="ml-auto text-sm text-blue-600 hover:text-blue-800"
                              onClick={() => setActiveTab('location')}
                            >
                              Alterar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Meeting Times Section */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-md font-semibold text-gray-700 flex items-center">
                        <svg className="h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Horários de Reunião
                      </h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Add a new meeting time
                          const newMeeting = { dayofweek: '', time: '', local: '' };
                          setEditingGroup({
                            ...editingGroup,
                            meetingTimes: [...editingGroup.meetingTimes, newMeeting]
                          });
                        }}
                        className="bg-primary text-white hover:bg-primary/90 shadow-sm text-xs flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Adicionar Horário
                      </Button>
                    </div>
                    
                    <div className="p-4">
                      {/* Meeting Times List */}
                      {editingGroup.meetingTimes.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-md border border-dashed border-gray-300">
                          <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="font-medium">Nenhum horário cadastrado</p>
                          <p className="text-sm mt-1">Clique em "Adicionar Horário" para incluir um novo horário de reunião</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {editingGroup.meetingTimes.map((meeting, index) => (
                            <div key={index} className="bg-gray-50 border border-gray-200 rounded-md p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-gray-700 flex items-center">
                                  <svg className="w-4 h-4 mr-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Horário #{index + 1}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Remove this meeting time
                                    const updatedMeetings = [...editingGroup.meetingTimes];
                                    updatedMeetings.splice(index, 1);
                                    setEditingGroup({...editingGroup, meetingTimes: updatedMeetings});
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Day of week */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Dia da Semana <span className="text-red-500">*</span>
                                  </label>
                                  <select
                                    value={meeting.dayofweek}
                                    onChange={(e) => {
                                      const updatedMeetings = [...editingGroup.meetingTimes];
                                      updatedMeetings[index] = {
                                        ...meeting,
                                        dayofweek: e.target.value
                                      };
                                      setEditingGroup({...editingGroup, meetingTimes: updatedMeetings});
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
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
                                
                                {/* Time */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Horário <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="time"
                                    value={meeting.time}
                                    onChange={(e) => {
                                      const updatedMeetings = [...editingGroup.meetingTimes];
                                      updatedMeetings[index] = {
                                        ...meeting,
                                        time: e.target.value
                                      };
                                      setEditingGroup({...editingGroup, meetingTimes: updatedMeetings});
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                                    required
                                  />
                                </div>
                                
                                {/* Location */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Local
                                  </label>
                                  <input
                                    type="text"
                                    value={meeting.local || ''}
                                    onChange={(e) => {
                                      const updatedMeetings = [...editingGroup.meetingTimes];
                                      updatedMeetings[index] = {
                                        ...meeting,
                                        local: e.target.value
                                      };
                                      setEditingGroup({...editingGroup, meetingTimes: updatedMeetings});
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                                    placeholder="Ex: Sala 102, Bloco B"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Leader Selection Section */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-md font-semibold text-gray-700 flex items-center">
                        <svg className="h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Líder do Grupo
                      </h3>
                    </div>
                    
                    <div className="p-4">
                      {/* Group Leader */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Líder do Grupo <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Users className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Digite para buscar líder..."
                            value={leaderSearchTerm}
                            onChange={(e) => {
                              setLeaderSearchTerm(e.target.value);
                              // Show dropdown when typing
                              setShowLeaderDropdown(true);
                            }}
                            onFocus={() => {
                              setShowLeaderDropdown(true);
                            }}
                            className={`pl-10 w-full p-2 border ${formErrors.leader ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors`}
                            required
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <ChevronDown 
                              className="h-5 w-5 text-gray-400 cursor-pointer" 
                              onClick={() => setShowLeaderDropdown(!showLeaderDropdown)}
                            />
                          </div>
                        </div>
                        {formErrors.leader && (
                          <p className="mt-1 text-sm text-red-500">{formErrors.leader}</p>
                        )}
                        
                        {showLeaderDropdown && (
                          <div 
                            ref={leaderDropdownRef} 
                            className="absolute z-10 mt-1 w-full max-w-2xl bg-white shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto border border-gray-200"
                          >
                            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-2">
                              <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                                <input
                                  type="text"
                                  className="pl-10 w-full border border-gray-300 rounded-md py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                  placeholder="Buscar por nome, curso, telefone..."
                                  value={leaderSearchTerm}
                                  onChange={(e) => setLeaderSearchTerm(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              </div>
                            </div>
                            
                            <div className="pt-1 pb-1">
                              {getFilteredLeadersForDisplay.length > 0 ? (
                                getFilteredLeadersForDisplay.map(leader => (
                                  <button
                                    key={leader.id}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex flex-col ${
                                      selectedLeaderId === leader.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                                    }`}
                                    onClick={() => {
                                      setSelectedLeaderId(leader.id);
                                      setLeaderSearchTerm(leader.name);
                                      setShowLeaderDropdown(false);
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{leader.name}</span>
                                      {leader.isAssigned && leader.id !== editingGroup?.leader_id && (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                          Atribuído
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 flex flex-col mt-1">
                                      <span>{leader.email || 'Email não informado'}</span>
                                      <span>{leader.phone}</span>
                                      <span>{leader.curso || 'Curso não informado'}</span>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-gray-500 text-center">
                                  {leaderSearchTerm ? 'Nenhum líder encontrado' : 'Nenhum líder disponível'}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Location Tab Content */}
              {activeTab === 'location' && (
                <div className="px-6 py-4">
                  <div className="space-y-6">
                    {/* Google Places Search */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Buscar Universidade <span className="text-red-500">*</span>
                      </label>
                      
                      {locationSelected ? (
                        <div className="flex items-center mb-3">
                          <div className="flex items-center bg-green-50 text-green-800 border border-green-200 rounded-md px-3 py-2 max-w-full">
                            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium text-sm truncate">{editingGroup.university} • {editingGroup.city}, {editingGroup.state}</span>
                            <button 
                              className="ml-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                              onClick={() => setLocationSelected(false)}
                            >
                              Alterar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            ref={autocompleteInputRef}
                            type="text"
                            className="pl-10 w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                            placeholder="Pesquisar por nome da universidade..."
                            onFocus={handleLocationInputFocus}
                            onClick={() => {
                              if (window.google?.maps?.places) {
                                setAutocompleteInitialized(false);
                                autocompleteRef.current = null;
                                initAutocomplete();
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Map */}
                    <div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div
                        ref={mapRef}
                        className="w-full h-[350px]"
                      ></div>
                    </div>
                    
                    {/* Location Details (Hidden Fields) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div className="hidden">
                        <input
                          type="hidden"
                          value={editingGroup.university}
                          readOnly
                        />
                        <input
                          type="hidden"
                          value={editingGroup.city}
                          readOnly
                        />
                        <input
                          type="hidden"
                          value={editingGroup.state}
                          readOnly
                        />
                        <input
                          type="hidden"
                          value={editingGroup.country}
                          readOnly
                        />
                        <input
                          type="hidden"
                          value={editingGroup.fulladdress || ''}
                          readOnly
                        />
                      </div>
                    </div>
                    
                    {/* Location Information Display */}
                    {locationSelected && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Detalhes da Localização</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Cidade</p>
                            <p className="text-sm font-medium">{editingGroup.city}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Estado</p>
                            <p className="text-sm font-medium">{editingGroup.state}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">País</p>
                            <p className="text-sm font-medium">{editingGroup.country}</p>
                          </div>
                          {editingGroup.fulladdress && (
                            <div className="sm:col-span-2">
                              <p className="text-xs text-gray-500">Endereço Completo</p>
                              <p className="text-sm font-medium">{editingGroup.fulladdress}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Form Actions */}
              <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setEditingGroup(null)}
                  className="flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  Cancelar
                </Button>
                <Button
                  variant="default"
                  onClick={() => saveEdits()}
                  className="bg-primary text-white hover:bg-primary/90 shadow-sm flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}