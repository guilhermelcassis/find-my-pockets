import React from 'react';
import { Group } from '@/lib/interfaces';

interface SearchResultsProps {
  searchResults: Group[];
  handleResultClick: (groupId: string) => void;
  selectedGroupId: string | null;
}

export default function SearchResults({ 
  searchResults, 
  handleResultClick,
  selectedGroupId 
}: SearchResultsProps) {

  // Group results by location
  const locationGroups: Record<string, Group[]> = {};
  const locationOrder: string[] = [];
  
  // Group results by location
  searchResults.forEach(group => {
    const locationKey = `${group.city}|${group.state}`;
    const displayKey = `${group.city}, ${group.state}`;
    
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = [];
      locationOrder.push(locationKey);
    }
    locationGroups[locationKey].push(group);
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Resultados ({searchResults.length})</h2>
      <div className="text-xs text-gray-500 -mt-3 mb-3">
        <p>Clique em um resultado para visualizá-lo no mapa</p>
        <p className="mt-1 italic">Dica: clicar aqui na lista <span className="text-primary">zoom</span> no local, mas clicar no mapa <span className="text-primary">não altera o zoom</span></p>
      </div>

      {/* Render each location group */}
      {locationOrder.map(locationKey => {
        const groups = locationGroups[locationKey];
        const [city, state] = locationKey.split('|');
        
        return (
          <div key={locationKey} className="mb-6">
            <div className="flex items-center justify-between bg-gray-100 p-2 rounded-t mb-3">
              <h3 className="font-semibold text-gray-700">
                {city}, {state}
              </h3>
              <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">
                {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {groups.map((group) => (
                <div 
                  key={group.id} 
                  data-group-id={group.id}
                  className={`mb-4 p-4 rounded-lg shadow cursor-pointer transition-all ${
                    selectedGroupId === group.id 
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => handleResultClick(group.id)}
                >
                  <div className="flex flex-col">
                    <h3 className="font-bold text-base">{group.university}</h3>
                    <p className="text-gray-600 text-sm">
                      {group.city}, {group.state}, {group.country}
                    </p>
                    
                    {/* Meeting details */}
                    <div className="mt-2">
                      <p className="text-xs">
                        <span className="font-medium">Encontros:</span> {group.meetingTimes && group.meetingTimes.length > 0 ? 
                          group.meetingTimes.map(meeting => {
                            let meetingText = `${meeting.dayofweek} às ${meeting.time}`;
                            if (meeting.local) {
                              meetingText += ` (${meeting.local})`;
                            }
                            return meetingText;
                          }).join(', ') : 
                          'Informações de horário não disponíveis'
                        }
                      </p>
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
                            href={`https://wa.me/${
                              group.leader.phone.startsWith('+') ? 
                              group.leader.phone.replace(/[^\d+]/g, '') : 
                              group.leader.phone.replace(/\D/g, '')
                            }`}
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
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
} 