import React, { useState, useEffect } from 'react';
import { Group } from '@/lib/interfaces';

interface SearchResultsProps {
  searchResults: Group[];
  handleResultClick: (groupId: string) => void;
  selectedGroupId: string | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  searchResults,
  handleResultClick,
  selectedGroupId,
}) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; // Constant for items per page
  
  // Reset to first page when search results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchResults.length]);

  // Calculate pagination
  const totalGroups = searchResults.length;
  const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);
  
  // Get groups for current page
  const indexOfLastGroup = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstGroup = indexOfLastGroup - ITEMS_PER_PAGE;
  const currentGroups = searchResults.slice(indexOfFirstGroup, indexOfLastGroup);
  
  // Group current page results by location (city, state)
  const locationGroups: Record<string, Group[]> = {};
  const locationOrder: string[] = [];

  currentGroups.forEach((group) => {
    const locationKey = `${group.city}, ${group.state}`;
    
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = [];
      locationOrder.push(locationKey);
    }
    
    locationGroups[locationKey].push(group);
  });
  
  // Page navigation
  const goToPage = (pageNumber: number) => {
    setCurrentPage(Math.min(Math.max(1, pageNumber), totalPages));
  };

  if (searchResults.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        {/* Results count header - Redesigned to match screenshot */}
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex items-center">
            <div className="text-gray-800 font-medium">
              {searchResults.length} {searchResults.length === 1 ? 'grupo' : 'grupos'} encontrados
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Clique em um grupo para ver no mapa
          </div>
        </div>

        <div className="p-5">
          {locationOrder.map((location) => (
            <div 
              key={location} 
              className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0 border-gray-100"
            >
              <div className="flex items-center mb-4">
                <div className="p-2 bg-secondary rounded-lg mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {location}
                  </h4>
                  <span className="text-sm text-gray-500">
                    {locationGroups[location].length} grupo{locationGroups[location].length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                {locationGroups[location].map((group) => (
                  <div 
                    key={group.id}
                    className={`p-4 rounded-xl transition-all duration-300 cursor-pointer relative ${
                      selectedGroupId === group.id
                        ? 'bg-secondary border border-secondary shadow-sm'
                        : 'bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200'
                    }`}
                    data-group-id={group.id}
                    onClick={() => handleResultClick(group.id)}
                  >
                    <div className="flex items-start mb-3">
                      <div className={`h-12 w-12 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden ${
                        selectedGroupId === group.id ? 'bg-secondary' : 'bg-gray-100'
                      }`}>
                        {group.university && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M12 14l9-5-9-5-9 5 9 5z" />
                            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3 flex-1">
                        <h5 className="font-medium text-base text-gray-900">{group.university}</h5>
                        
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          {group.meetingTimes && group.meetingTimes.length > 0 && (
                            <div className="flex items-center text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {group.meetingTimes[0].dayofweek} • {group.meetingTimes[0].time}
                            </div>
                          )}
                          
                          {group.leader && (
                            <div className="flex items-center text-sm text-gray-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {group.leader.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Improved action buttons with better mobile visibility */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {group.leader && group.leader.phone && (
                        <a 
                          href={`https://wa.me/55${group.leader.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center py-3 px-2 rounded-xl bg-green-50 text-green-600 font-medium text-sm transition-all duration-200 hover:bg-green-500 hover:text-white hover:shadow-md min-h-[48px]"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Contato via WhatsApp"
                        >
                          <svg 
                            className="h-4 w-4 sm:mr-1.5" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                          </svg>
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      )}
                      
                      {group.instagram && (
                        <a 
                          href={`https://instagram.com/${group.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center py-3 px-2 rounded-xl bg-purple-50 text-purple-600 font-medium text-sm transition-all duration-200 hover:bg-purple-500 hover:text-white hover:shadow-md min-h-[48px]"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Página no Instagram"
                        >
                          <svg 
                            className="h-4 w-4 sm:mr-1.5" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                          </svg>
                          <span className="hidden sm:inline">Instagram</span>
                        </a>
                      )}
                      
                      {group.coordinates && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${group.coordinates.latitude},${group.coordinates.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center py-3 px-2 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm transition-all duration-200 hover:bg-secondary/80 hover:text-secondary-foreground hover:shadow-md min-h-[48px]"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Ver no Google Maps"
                        >
                          <svg 
                            className="h-4 w-4 sm:mr-1.5" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          <span className="hidden sm:inline">Mapa</span>
                        </a>
                      )}
                    </div>
                    
                    {/* Mobile-only helper text */}
                    <div className="mt-2 text-xs text-center text-gray-400 sm:hidden">
                      Toque nos ícones para acessar
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Mostrando {indexOfFirstGroup + 1}-{Math.min(indexOfLastGroup, totalGroups)} de {totalGroups} grupos
              </div>
              
              <div className="flex space-x-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg ${
                    currentPage === 1 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label="Página anterior"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => {
                  const pageNum = i + 1;
                  
                  // Only display maximum 5 pages at a time
                  if (totalPages <= 5) {
                    // If 5 or fewer pages, show all
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                          currentPage === pageNum
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else {
                    // For more than 5 pages, show first, last, current, and pages around current
                    const showFirst = pageNum === 1;
                    const showLast = pageNum === totalPages;
                    const showCurrent = Math.abs(pageNum - currentPage) <= 1;
                    
                    if (showFirst || showLast || showCurrent) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                            currentPage === pageNum
                              ? 'bg-indigo-50 text-indigo-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      (pageNum === 2 && currentPage > 3) || 
                      (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      // Show ellipsis for skipped pages
                      return (
                        <span 
                          key={`ellipsis-${pageNum}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-400"
                        >
                          ...
                        </span>
                      );
                    }
                    
                    return null;
                  }
                }).filter(Boolean)}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg ${
                    currentPage === totalPages 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label="Próxima página"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults; 