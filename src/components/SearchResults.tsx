import React, { useState, useEffect } from 'react';
import { Group } from '@/lib/interfaces';
import AnalyticsService from '@/lib/supabase-analytics';

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
    <div className="w-full bg-white rounded-b-xl shadow-lg overflow-hidden">
      <div>
        {locationOrder.map((location) => (
          <div 
            key={location} 
            className="px-5 py-4 border-b border-gray-100"
          >
            <div className="flex items-center mb-3">
              <div className="p-2 bg-secondary/10 rounded-lg mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">
                  {location}
                </h4>
                <span className="text-xs text-gray-500">
                  {locationGroups[location].length} grupo{locationGroups[location].length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              {locationGroups[location].map((group) => (
                <div 
                  key={group.id}
                  className={`p-3 rounded-xl transition-all duration-300 cursor-pointer relative ${
                    selectedGroupId === group.id
                      ? 'bg-secondary/20 border border-secondary/40 shadow-sm'
                      : 'bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200'
                  }`}
                  data-group-id={group.id}
                  onClick={() => handleResultClick(group.id)}
                >
                  <div className="flex items-start">
                    <div className={`h-10 w-10 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden ${
                      selectedGroupId === group.id ? 'bg-secondary' : 'bg-gray-100'
                    }`}>
                      {group.university && (
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${selectedGroupId === group.id ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <h5 className="font-medium text-sm text-gray-900">{group.university}</h5>
                      
                      <div className="flex flex-wrap gap-2 mt-1">
                        {group.meetingTimes && group.meetingTimes.length > 0 && (
                          <div className="flex items-center text-xs text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {group.meetingTimes[0].dayofweek} • {group.meetingTimes[0].time}
                          </div>
                        )}
                        
                        {group.leader && (
                          <div className="flex items-center text-xs text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {group.leader.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons row */}
                  <div className="flex justify-end gap-1 mt-2">
                    {group.instagram && (
                      <a 
                        href={`https://instagram.com/${group.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-2 rounded-lg bg-purple-50 text-purple-600 transition-all duration-200 hover:bg-purple-500 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation(); // Stop event propagation to parent
                          // Track Instagram button click
                          AnalyticsService.trackButtonClick('instagram', { 
                            group_id: group.id,
                            instagram: group.instagram,
                            university: group.university
                          });
                        }}
                        aria-label="Página no Instagram"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                      </a>
                    )}
                    
                    {group.coordinates && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${group.coordinates.latitude},${group.coordinates.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-2 rounded-lg bg-blue-50 text-blue-600 transition-all duration-200 hover:bg-blue-500 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation(); // Stop event propagation to parent
                          // Track Maps button click
                          AnalyticsService.trackButtonClick('maps', { 
                            group_id: group.id,
                            coordinates: `${group.coordinates.latitude},${group.coordinates.longitude}`,
                            university: group.university
                          });
                        }}
                        aria-label="Ver no Google Maps"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Fixed position pagination controls */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 border-t border-gray-100 px-3 py-2 bg-white flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {indexOfFirstGroup + 1}-{Math.min(indexOfLastGroup, totalGroups)} de {totalGroups}
          </div>
          
          <div className="flex">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-1.5 rounded ${
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
            
            {/* Dynamic page numbers with ellipsis for large pagination */}
            {(() => {
              const visiblePageNumbers = [];
              const totalPageButtons = 5; // Max number of page buttons to show
              
              // Handle cases with fewer pages than max buttons
              if (totalPages <= totalPageButtons) {
                for (let i = 1; i <= totalPages; i++) {
                  visiblePageNumbers.push(i);
                }
              } else {
                // Complex pagination with ellipsis
                // Always show first page
                visiblePageNumbers.push(1);
                
                let startPage = Math.max(2, currentPage - 1);
                let endPage = Math.min(currentPage + 1, totalPages - 1);
                
                // Adjust when at edges
                if (currentPage <= 2) {
                  endPage = 4;
                } else if (currentPage >= totalPages - 1) {
                  startPage = totalPages - 3;
                }
                
                // Add ellipsis before middle range if needed
                if (startPage > 2) {
                  visiblePageNumbers.push('...');
                }
                
                // Add middle range
                for (let i = startPage; i <= endPage; i++) {
                  visiblePageNumbers.push(i);
                }
                
                // Add ellipsis after middle range if needed
                if (endPage < totalPages - 1) {
                  visiblePageNumbers.push('...');
                }
                
                // Always show last page
                visiblePageNumbers.push(totalPages);
              }
              
              return visiblePageNumbers.map((pageNum, idx) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-gray-500">
                      ...
                    </span>
                  );
                }
                
                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => goToPage(pageNum as number)}
                    className={`min-w-[24px] h-6 px-1 mx-0.5 rounded text-xs font-medium ${
                      currentPage === pageNum 
                        ? 'bg-secondary text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              });
            })()}
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded ${
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
      )}
    </div>
  );
};

export default SearchResults; 