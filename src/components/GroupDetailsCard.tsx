import React, { useEffect, useRef } from 'react';
import { Group, MeetingTime, Leader } from '@/lib/interfaces';

interface GroupDetailsCardProps {
  group: Group;
  onClose?: () => void;
  isInsideInfoWindow?: boolean;
}

const GroupDetailsCard: React.FC<GroupDetailsCardProps> = ({ 
  group, 
  onClose,
  isInsideInfoWindow = false 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

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
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
          });
          clearInterval(hideGoogleCloseBtn);
        }
      }, 50);
      
      return () => clearInterval(hideGoogleCloseBtn);
    }
  }, [isInsideInfoWindow]);

  // Format meeting times for readable display
  const formatMeetingTimes = (meetingTimes: MeetingTime[]): string => {
    if (!meetingTimes || meetingTimes.length === 0) return "Horários não informados";
    
    return meetingTimes
      .map(time => {
        let timeStr = `${time.dayofweek} `;
        if (time.time) {
          timeStr += `${time.time}`;
        } else {
          timeStr += `(horário a confirmar)`;
        }
        if (time.local) {
          timeStr += ` (${time.local})`;
        }
        return timeStr;
      })
      .join(' | ');
  };

  // Format leader information
  const formatLeaderInfo = (leader: Leader): string => {
    if (!leader || !leader.name) return "Líder não informado";
    return leader.name + (leader.curso ? ` - ${leader.curso}` : '');
  };

  return (
    <div 
      ref={cardRef}
      className="relative bg-white rounded-xl shadow-lg overflow-hidden w-full max-w-md transition-all duration-300 ease-in-out transform hover:shadow-xl"
    >
      {/* Only show our custom close button if onClose callback is provided */}
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex items-center justify-center w-7 h-7 rounded-full bg-white/70 backdrop-blur-sm text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 border border-gray-200/50 shadow-sm"
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
      
      <div className="p-5">
        {/* Header with university and location */}
        <header className="mb-4">
          <h3 
            className="text-base md:text-lg font-bold text-gray-900 mb-1 pr-8 line-clamp-2 overflow-hidden text-ellipsis" 
            title={group.university}
          >
            {group.university}
          </h3>
          <p className="text-sm text-gray-600">{group.city}, {group.state}</p>
        </header>
        
        {/* Meeting times section */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Horários de Encontro</h4>
          <p className="text-sm text-gray-600">{formatMeetingTimes(group.meetingTimes)}</p>
        </div>
        
        {/* Leader information */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Líder</h4>
          <p className="text-sm text-gray-600">{formatLeaderInfo(group.leader)}</p>
        </div>
        
        {/* Improved action buttons with better mobile visibility */}
        <div className="grid grid-cols-3 gap-2">
          {group.leader && group.leader.phone && (
            <a 
              href={`https://wa.me/55${group.leader.phone.replace(/\D/g,'')}`}
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
              className="flex items-center justify-center py-3 px-2 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm transition-all duration-200 hover:bg-blue-500 hover:text-white hover:shadow-md min-h-[48px]"
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

        {/* Mobile tooltip to explain icons */}
        <div className="mt-2 text-xs text-center text-gray-500 sm:hidden">
          Toque nos ícones para WhatsApp, Instagram ou Mapa
        </div>
      </div>
    </div>
  );
};

export default GroupDetailsCard; 