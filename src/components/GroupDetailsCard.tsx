import React, { useEffect, useRef, useState } from 'react';
import { Group, MeetingTime, Leader } from '@/lib/interfaces';

interface GroupDetailsCardProps {
  group: Group;
  onClose?: () => void;
  isInsideInfoWindow?: boolean;
  animationState?: 'enter' | 'update' | 'exit' | 'idle';
}

const GroupDetailsCard: React.FC<GroupDetailsCardProps> = ({ 
  group, 
  onClose,
  isInsideInfoWindow = false,
  animationState = 'idle'
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousGroupRef = useRef<string | null>(null);
  
  // Track card content transitions
  useEffect(() => {
    // Track transitions between different groups
    if (previousGroupRef.current && previousGroupRef.current !== group.id) {
      // Check if this is a transition within the same university
      const prevGroupId = previousGroupRef.current;
      
      if (group.university === prevGroupId.split('|')[1]) {
        setIsTransitioning(true);
        
        // Reset transition state after animation completes
        const timer = setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
        
        return () => clearTimeout(timer);
      }
    }
    
    // Store the current group ID and university for future comparison
    previousGroupRef.current = `${group.id}|${group.university}`;
  }, [group.id, group.university]);

  // Handle Google Maps InfoWindow close buttons
  useEffect(() => {
    // Only run this if card is rendered in an info window
    if (isInsideInfoWindow) {
      // Try to find and hide any Google Maps close buttons that might appear
      const hideGoogleCloseBtn = setInterval(() => {
        const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
        if (closeButtons.length > 0) {
          closeButtons.forEach(btn => {
            const element = btn as HTMLElement;
            element.style.display = 'none';
          });
          clearInterval(hideGoogleCloseBtn);
        }
      }, 50);
      
      return () => clearInterval(hideGoogleCloseBtn);
    }
  }, [isInsideInfoWindow]);

  // Format meeting times for readable display
  const formatMeetingTimes = (meetingTimes: MeetingTime[]): React.ReactNode => {
    if (!meetingTimes || meetingTimes.length === 0) return "Horários não informados";
    
    return (
      <div className="space-y-1">
        {meetingTimes.map((time, index) => (
          <div key={index} className="flex items-start gap-1">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate text-xs" title={time.dayofweek}>{time.dayofweek}</p>
              <p className="text-xs text-gray-600 truncate" title={`${time.time || "(horário a confirmar)"}${time.local ? ` - ${time.local}` : ''}`}>
                {time.time || "(horário a confirmar)"}
                {time.local && ` - ${time.local}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Format leader information
  const formatLeaderInfo = (leader: Leader): React.ReactNode => {
    if (!leader || !leader.name) return "Líder não informado";
    
    return (
      <div className="flex items-center">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 mr-1.5">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 truncate text-xs" title={leader.name}>{leader.name}</p>
          {leader.curso && <p className="text-xs text-gray-600 truncate" title={leader.curso}>{leader.curso}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <style jsx>{`
        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .card-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .mobile-action-button {
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          border-radius: 8px;
          font-weight: 500;
          text-align: center;
          transition: all 0.2s ease;
          font-size: 12px;
        }
        
        .desktop-action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .desktop-action-button:hover {
          transform: translateY(-1px);
        }
      `}</style>
      
      <div 
        ref={cardRef}
        className={`relative bg-white rounded-lg shadow overflow-hidden w-full max-w-md card-transition ${isTransitioning ? 'scale-[0.98] opacity-95' : ''}`}
      >
        {/* Close button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-2 right-2 z-20 flex items-center justify-center w-6 h-6 rounded-full bg-white/70 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
            aria-label="Fechar detalhes"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4" 
              fill="none"
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Mobile Layout */}
        <div className="sm:hidden">
          {/* Mobile Header */}
          <div className="p-3">
            <header>
              <div className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mr-2">
                </div>
                <div className="min-w-0 flex-1">
                  <h3 
                    className="text-sm font-bold text-gray-900 truncate pr-6" 
                    title={group.university}
                  >
                    {group.university}
                  </h3>
                  <p className="text-xs text-gray-600 truncate" title={`${group.city}, ${group.state}`}>{group.city}, {group.state}</p>
                </div>
              </div>
            </header>
          </div>
          
          {/* Mobile Content */}
          <div className="px-3 pb-2">
            {/* Mobile Leader Section */}
            <div className="mb-2">
              <h4 className="text-xs uppercase font-semibold text-gray-500 mb-1">Líder</h4>
              {formatLeaderInfo(group.leader)}
            </div>
            
            {/* Mobile Meeting Times Section */}
            <div className="mb-2">
              <h4 className="text-xs uppercase font-semibold text-gray-500 mb-1">Horários de Encontro</h4>
              {formatMeetingTimes(group.meetingTimes)}
            </div>
          </div>
          
          {/* Mobile Action Buttons */}
          <div className="p-2 grid grid-cols-3 gap-1 border-t border-gray-100">
            {group.leader && group.leader.phone && (
              <a 
                href={`https://wa.me/55${group.leader.phone.replace(/\D/g,'')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-action-button bg-green-50 text-green-600"
                onClick={(e) => e.stopPropagation()}
                aria-label="Contato via WhatsApp"
              >
                <svg 
                  className="h-4 w-4" 
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
              </a>
            )}
            
            {group.instagram && (
              <a 
                href={`https://instagram.com/${group.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-action-button bg-purple-50 text-purple-600"
                onClick={(e) => e.stopPropagation()}
                aria-label="Página no Instagram"
              >
                <svg 
                  className="h-4 w-4" 
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
              </a>
            )}
            
            {group.coordinates && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${group.coordinates.latitude},${group.coordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-action-button bg-blue-50 text-blue-600"
                onClick={(e) => e.stopPropagation()}
                aria-label="Ver no Google Maps"
              >
                <svg 
                  className="h-4 w-4" 
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
              </a>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:block p-3">
          {/* Header with university and location */}
          <header className="mb-2">
            <h3 
              className="text-sm font-bold text-gray-900 mb-0.5 pr-6 truncate" 
              title={group.university}
            >
              {group.university}
            </h3>
            <p className="text-xs text-gray-600 truncate" title={`${group.city}, ${group.state}`}>{group.city}, {group.state}</p>
          </header>
          
          {/* Meeting times section */}
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-gray-700 mb-0.5">Horários de Encontro</h4>
            <div className="text-xs text-gray-600">{formatMeetingTimes(group.meetingTimes)}</div>
          </div>
          
          {/* Leader information */}
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-gray-700 mb-0.5">Líder</h4>
            <div className="text-xs text-gray-600">{formatLeaderInfo(group.leader)}</div>
          </div>
          
          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {group.leader && group.leader.phone && (
              <a 
                href={`https://wa.me/55${group.leader.phone.replace(/\D/g,'')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-action-button bg-green-50 text-green-600 hover:bg-green-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Contato via WhatsApp"
              >
                <svg 
                  className="h-3.5 w-3.5 mr-1" 
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
                <span className="truncate">WhatsApp</span>
              </a>
            )}
            
            {group.instagram && (
              <a 
                href={`https://instagram.com/${group.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-action-button bg-purple-50 text-purple-600 hover:bg-purple-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Página no Instagram"
              >
                <svg 
                  className="h-3.5 w-3.5 mr-1" 
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
                <span className="truncate">Instagram</span>
              </a>
            )}
            
            {group.coordinates && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${group.coordinates.latitude},${group.coordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-action-button bg-blue-50 text-blue-600 hover:bg-blue-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Ver no Google Maps"
              >
                <svg 
                  className="h-3.5 w-3.5 mr-1" 
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
                <span className="truncate">Mapa</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailsCard;