import { Search, X, Users, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FilterStatus = 'all' | 'active' | 'inactive';

interface LeaderListFilterProps {
  activeFilter: FilterStatus;
  searchTerm: string;
  totalLeaders: number;
  activeLeaders: number;
  inactiveLeaders: number;
  onFilterChange: (filter: FilterStatus) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}

export default function LeaderListFilter({
  activeFilter,
  searchTerm,
  totalLeaders,
  activeLeaders,
  inactiveLeaders,
  onFilterChange,
  onSearchChange,
  onClearSearch
}: LeaderListFilterProps) {
  return (
    <div className="py-2">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-5">
        <div className="bg-white rounded-lg p-1.5 flex gap-1 shadow-sm border border-border">
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-2 px-3 text-sm font-medium
              ${activeFilter === 'all' 
                ? 'bg-gray-50 text-primary border border-border shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}
            `}
            onClick={() => onFilterChange('all')}
          >
            <Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Todos</span>
            <Badge variant="outline" className="ml-1.5 bg-gray-100 text-gray-700 text-xs rounded-full px-2 py-0.5 min-w-6 flex items-center justify-center border border-border flex-shrink-0">
              {totalLeaders}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-2 px-3 text-sm font-medium
              ${activeFilter === 'active' 
                ? 'bg-green-50 text-green-600 border border-green-200 shadow-sm' 
                : 'text-gray-600 hover:bg-green-50/30 hover:text-green-600'}
            `}
            onClick={() => onFilterChange('active')}
          >
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Ativos</span>
            <Badge variant="outline" className="ml-1.5 bg-green-50 text-green-600 text-xs rounded-full px-2 py-0.5 min-w-6 flex items-center justify-center border-green-200 flex-shrink-0">
              {activeLeaders}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-2 px-3 text-sm font-medium
              ${activeFilter === 'inactive' 
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm' 
                : 'text-gray-600 hover:bg-red-50/30 hover:text-red-600'}
            `}
            onClick={() => onFilterChange('inactive')}
          >
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Inativos</span>
            <Badge variant="outline" className="ml-1.5 bg-red-50 text-red-600 text-xs rounded-full px-2 py-0.5 min-w-6 flex items-center justify-center border-red-200 flex-shrink-0">
              {inactiveLeaders}
            </Badge>
          </Button>
        </div>

        <div className="w-full md:w-[300px] relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-primary/70 h-4 w-4 pointer-events-none" />
            <Input
              placeholder="Buscar por nome, telefone, email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10 bg-white rounded-lg text-sm border-border focus:border-primary shadow-sm h-10"
            />
            {searchTerm && (
              <button
                className="absolute right-3 text-gray-400 hover:text-primary cursor-pointer p-1 rounded-full hover:bg-gray-100"
                onClick={onClearSearch}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 