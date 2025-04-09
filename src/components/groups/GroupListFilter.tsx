import React from 'react';
import { Search, X, Users, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GroupListFilterProps {
  totalCount: number;
  activeFilter: 'all' | 'active' | 'inactive';
  searchTerm: string;
  onFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  onSearchChange: (value: string) => void;
  activeCount?: number;
  inactiveCount?: number;
  isLoading?: boolean;
}

const GroupListFilter: React.FC<GroupListFilterProps> = ({
  totalCount,
  activeFilter,
  searchTerm,
  onFilterChange,
  onSearchChange,
  activeCount,
  inactiveCount,
  isLoading = false
}) => {
  // If activeCount and inactiveCount are not provided, use the total count and 0
  const actualActiveCount = activeCount !== undefined ? activeCount : totalCount;
  const actualInactiveCount = inactiveCount !== undefined ? inactiveCount : 0;
  
  const clearSearch = () => {
    // Set the search term to an empty string and force immediate search refresh
    console.log("Clear search button clicked");
    onSearchChange('');
  };
  
  return (
    <div className="mb-4">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="bg-white rounded-lg p-1 flex gap-1 shadow-sm border border-border">
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-1.5 px-2 text-sm font-medium h-8
              ${activeFilter === 'all' 
                ? 'bg-gray-50 text-primary border border-border shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}
            `}
            onClick={() => onFilterChange('all')}
            disabled={isLoading}
          >
            {isLoading && activeFilter === 'all' ? (
              <div className="h-3.5 w-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-1" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            Todos
            <Badge variant="outline" className="ml-1 bg-gray-100 text-gray-700 text-xs rounded-full px-2 py-0.5 min-w-5 flex items-center justify-center border border-border">
              {totalCount}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-1.5 px-2 text-sm font-medium h-8
              ${activeFilter === 'active' 
                ? 'bg-green-50 text-green-600 border border-green-200 shadow-sm' 
                : 'text-gray-600 hover:bg-green-50/30 hover:text-green-600'}
            `}
            onClick={() => onFilterChange('active')}
            disabled={isLoading}
          >
            {isLoading && activeFilter === 'active' ? (
              <div className="h-3.5 w-3.5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin mr-1" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Ativos
            <Badge variant="outline" className="ml-1 bg-green-50 text-green-600 text-xs rounded-full px-2 py-0.5 min-w-5 flex items-center justify-center border-green-200">
              {actualActiveCount}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`
              rounded-md transition-all flex items-center gap-1.5 px-2 text-sm font-medium h-8
              ${activeFilter === 'inactive' 
                ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm' 
                : 'text-gray-600 hover:bg-red-50/30 hover:text-red-600'}
            `}
            onClick={() => onFilterChange('inactive')}
            disabled={isLoading}
          >
            {isLoading && activeFilter === 'inactive' ? (
              <div className="h-3.5 w-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mr-1" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Inativos
            <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 text-xs rounded-full px-2 py-0.5 min-w-5 flex items-center justify-center border-red-200">
              {actualInactiveCount}
            </Badge>
          </Button>
        </div>

        <div className="relative flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <Input
              type="search" 
              placeholder="Buscar por nome, cidade, estado..." 
              className="w-full pl-10 pr-10 focus:border-primary focus:ring-1 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={isLoading}
            />
            {searchTerm && (
              <button 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                onClick={clearSearch}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupListFilter; 