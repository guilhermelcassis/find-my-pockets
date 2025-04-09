import React from 'react';
import { Group } from '@/lib/interfaces';
import { Instagram, Clock, MapPin, User, School, Building, ExternalLink, Edit, Power } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GroupListItemProps {
  group: Group;
  onEdit: (group: Group) => void;
  onToggleActive: (id: string, university: string, currentStatus: boolean) => void;
}

const GroupListItem: React.FC<GroupListItemProps> = ({ 
  group, 
  onEdit, 
  onToggleActive 
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    // Prevent event from propagating to parent elements
    e.stopPropagation();
    
    console.log("Edit button clicked for group:", group.university);
    onEdit(group);
  };

  const handleToggleActive = () => {
    // Log the current active status and what's being passed to onToggleActive
    console.log(`Group ${group.university} - Active status in data:`, group.active);
    
    // Use strict equality to determine if the group is truly active
    // This fixes the issue where the filter is working opposite of what is expected
    onToggleActive(group.id, group.university, group.active === true);
  };
  
  // Format meeting days and times for display
  const formatMeetings = () => {
    // Check if we have meetingTimes array
    if (group.meetingTimes && group.meetingTimes.length > 0) {
      // Return the first meeting time formatted
      const meeting = group.meetingTimes[0];
      return `${meeting.dayofweek} às ${meeting.time}${meeting.local ? ` - ${meeting.local}` : ''}`;
    }
    
    // If no meeting times, return not informed
    return 'Não informado';
  };

  // Get only first and last name
  const formatLeaderName = () => {
    const nameParts = group.leader.name.split(' ');
    if (nameParts.length <= 1) return group.leader.name;
    
    return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
  };

  // Determine if the institution is private or public
  const isPrivate = group.tipo === 'Privada';

  return (
    <>
      {/* Mobile view - Card layout */}
      <div className="md:hidden p-4 border-b hover:bg-gray-50 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <div className="max-w-[calc(100%-70px)]">
            <h3 className="font-medium text-gray-900 flex items-center gap-1">
              {isPrivate ? <Building className="w-4 h-4 text-primary/70 flex-shrink-0" /> : <School className="w-4 h-4 text-primary/70 flex-shrink-0" />}
              <span className="truncate">{group.university}</span>
              <Badge 
                variant="outline" 
                className={`ml-2 text-xs h-5 px-1.5 flex items-center whitespace-nowrap flex-shrink-0 ${
                  group.active === true 
                    ? 'bg-green-50 text-green-600 border-green-200' 
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {group.active === true ? 'Ativo' : 'Inativo'}
              </Badge>
            </h3>
            <p className="text-sm text-gray-600 flex items-center mt-1">
              <Clock className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
              <span className="truncate">{formatMeetings()}</span>
            </p>
            <p className="text-sm text-gray-600 flex items-center mt-1">
              <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
              <span className="truncate">{group.city}, {group.state}</span>
            </p>
          </div>
          <div className="flex space-x-2 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full h-7 w-7 p-0"
                    onClick={handleEdit}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs font-medium">Editar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className={`rounded-full h-7 w-7 p-0 ${
                      group.active === true
                        ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                        : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
                    }`}
                    onClick={handleToggleActive}
                  >
                    <Power className="h-4 w-4" />
                    <span className="sr-only">{group.active === true ? 'Desativar' : 'Ativar'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs font-medium">{group.active === true ? 'Desativar' : 'Ativar'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center text-gray-700 truncate">
            <User className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
            <span className="truncate">{formatLeaderName()}</span>
          </div>
          
          {group.instagram && (
            <div className="flex items-center text-gray-700 truncate">
              <Instagram className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
              <a 
                href={`https://instagram.com/${group.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center truncate"
              >
                <span className="truncate">{group.instagram}</span>
                <ExternalLink className="w-3 h-3 ml-1 inline flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Desktop view - Table row layout styled similar to LeaderCard */}
      <div className={`hidden md:flex items-center border border-border rounded-md mb-0.5 bg-white overflow-hidden hover:shadow-sm transition-shadow ${
        group.active === true
          ? 'border-l-[3px] border-l-primary' 
          : 'border-l-[3px] border-l-gray-400 bg-gray-50'
      }`}>
        
        {/* Institution name with day/time and location - fixed width */}
        <div className="py-2 px-3 min-w-0 w-[50%] flex-shrink-0 border-r border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center min-w-0 max-w-[calc(100%-55px)]">
              {isPrivate ? 
                <Building className="w-4 h-4 mr-1 text-primary/70 flex-shrink-0" /> : 
                <School className="w-4 h-4 mr-1 text-primary/70 flex-shrink-0" />
              }
              <h3 className="text-sm font-medium text-gray-800 truncate">
                {group.university}
              </h3>
            </div>
            <Badge 
              variant="outline" 
              className={`text-xs h-5 px-1.5 flex items-center whitespace-nowrap flex-shrink-0 ${
                group.active === true 
                  ? 'bg-green-50 text-green-600 border-green-200' 
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              {group.active === true ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <div className="text-xs text-gray-500 flex items-center mt-1 truncate">
            <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{formatMeetings()}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center mt-1 truncate">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{group.city}, {group.state}</span>
          </div>
        </div>
        
        {/* Leader info - fixed width */}
        <div className="py-2 px-3 w-[20%] flex-shrink-0 border-r border-border">
          <div className="flex items-center">
            <User className="h-4 w-4 text-primary/70 mr-1.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-gray-700 text-sm font-medium truncate block">
                {formatLeaderName()}
              </span>
              {group.leader.curso && (
                <div className="text-xs text-gray-500 truncate">
                  {group.leader.curso}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Instagram - fixed width to align with the screenshot */}
        <div className="py-2 px-3 w-[20%] flex-shrink-0 border-r border-border">
          <div className="flex items-center">
            <Instagram className="h-4 w-4 text-primary/70 mr-1.5 flex-shrink-0" />
            <div className="min-w-0">
              {group.instagram ? (
                <a 
                  href={`https://instagram.com/${group.instagram.replace('@', '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center"
                >
                  <span className="truncate block">{group.instagram}</span>
                  <ExternalLink className="w-3 h-3 ml-1 inline flex-shrink-0" />
                </a>
              ) : (
                <span className="text-sm text-gray-500 truncate block">Não informado</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions - fixed width */}
        <div className="py-2 px-2 w-[10%] flex-shrink-0 flex items-center justify-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full h-7 w-7 p-0"
                  onClick={handleEdit}
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Editar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs font-medium">Editar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost"
                  size="icon"
                  className={`rounded-full h-7 w-7 p-0 ${
                    group.active === true
                      ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                      : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
                  }`}
                  onClick={handleToggleActive}
                >
                  <Power className="h-4 w-4" />
                  <span className="sr-only">{group.active === true ? 'Desativar' : 'Ativar'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs font-medium">{group.active === true ? 'Desativar' : 'Ativar'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
};

export default GroupListItem; 