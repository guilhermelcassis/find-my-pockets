import { Leader } from '../../types/Leader';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Edit, Power, GraduationCap, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeaderCardProps {
  leader: Leader;
  isLastItem?: boolean;
  isAssigned?: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}

export default function LeaderCard({ 
  leader, 
  isLastItem = false, 
  isAssigned = false,
  onEdit, 
  onToggleActive 
}: LeaderCardProps) {
  return (
    <div className={`flex items-center ${!isLastItem ? 'border-b' : ''} bg-white overflow-hidden hover:shadow-sm transition-shadow
      ${leader.active 
        ? 'border-l-[3px] border-l-primary' 
        : 'border-l-[3px] border-l-gray-400 bg-gray-50'}`}>
      
      {/* Name with status badge - fixed width */}
      <div className="py-2 px-3 min-w-0 w-[40%] flex-shrink-0 border-r border-border">
        <div className="flex items-center gap-2 max-w-full">
          <div className="min-w-0 max-w-[calc(100%-120px)]">
            <h3 className="text-sm font-medium text-gray-800 truncate">
              {leader.name}
            </h3>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs h-5 px-1.5 flex items-center whitespace-nowrap flex-shrink-0 ${
              leader.active 
                ? 'bg-green-50 text-green-600 border-green-200' 
                : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            {leader.active ? 'Ativo' : 'Inativo'}
          </Badge>
          
          {isAssigned && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs h-5 px-1.5 flex items-center whitespace-nowrap flex-shrink-0 bg-blue-50 text-blue-600 border-blue-200"
                  >
                    <Users className="h-3 w-3 mr-0.5" />
                    Grupo
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">Líder já está associado a um grupo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* Course - fixed width */}
      <div className="py-2 px-3 w-[25%] min-w-0 flex-shrink-0 border-r border-border">
        <div className="flex items-center">
          <GraduationCap className="h-4 w-4 text-primary mr-1.5 flex-shrink-0" />
          <span className="font-medium text-gray-700 text-sm truncate">
            {leader.curso}
          </span>
        </div>
      </div>
      
      {/* Contact Icons with Tooltips - fixed width */}
      <div className="py-2 px-2 w-[15%] flex-shrink-0 border-r border-border flex items-center justify-center space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost"
                size="icon"
                className="rounded-full h-7 w-7 p-0 text-gray-500 hover:text-primary hover:bg-primary/5"
              >
                <Phone className="h-4 w-4" />
                <span className="sr-only">Telefone</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs font-medium">{leader.phone}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a 
                href={`mailto:${leader.email}`}
                className="rounded-full h-7 w-7 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-primary/5"
              >
                <Mail className="h-4 w-4" />
                <span className="sr-only">Email</span>
              </a>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs font-medium">{leader.email}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Actions - fixed width */}
      <div className="py-2 px-2 w-[20%] flex-shrink-0 flex items-center justify-center space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full h-7 w-7 p-0"
                onClick={onEdit}
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
                  leader.active
                    ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                    : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
                }`}
                onClick={onToggleActive}
              >
                <Power className="h-4 w-4" />
                <span className="sr-only">{leader.active ? 'Desativar' : 'Ativar'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs font-medium">{leader.active ? 'Desativar' : 'Ativar'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
} 