import React from 'react';
import Link from 'next/link';
import { Group } from '@/lib/interfaces';
import GroupListItem from './GroupListItem';
import { Map as MapIcon, PlusCircle, Building, User, Instagram, Clock } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

interface GroupListProps {
  groups: Group[];
  isLoading: boolean;
  searchTerm: string;
  filterActive: 'all' | 'active' | 'inactive';
  onEdit: (group: Group) => void;
  onToggleActive: (id: string, university: string, currentStatus: boolean) => void;
  onSearchChange: (term: string) => void;
}

const GroupList: React.FC<GroupListProps> = ({
  groups,
  isLoading,
  searchTerm,
  filterActive,
  onEdit,
  onToggleActive,
  onSearchChange
}) => {
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando grupos...</p>
          <p className="text-gray-500 text-sm mt-1">Aguarde enquanto buscamos os dados</p>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        message={
          searchTerm
            ? `Nenhum grupo encontrado com "${searchTerm}"`
            : filterActive !== 'all'
            ? `Nenhum grupo ${filterActive === 'active' ? 'ativo' : 'inativo'} encontrado`
            : "Nenhum grupo cadastrado ainda"
        }
        submessage={
          searchTerm || filterActive !== 'all'
            ? 'Tente ajustar os filtros ou adicione um novo grupo'
            : 'Comece adicionando seu primeiro grupo'
        }
        showClearButton={Boolean(searchTerm || filterActive !== 'all')}
        onClearFilters={() => {
          console.log("EmptyState clear button clicked");
          // Make sure to clear the search with empty string
          onSearchChange('');
        }}
      />
    );
  }

  return (
    <div className="p-4">
      {/* Display count and Add button */}
      <div className="mb-4 px-1 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Mostrando <span className="font-medium text-gray-700">{groups.length}</span> grupos
        </p>
        
        <Link href="/admin" passHref>
          <Button
            className="bg-primary text-white hover:bg-primary/90 shadow-sm flex items-center gap-1"
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            Adicionar Grupo
          </Button>
        </Link>
      </div>
      
      {/* Table Header - Desktop only */}
      <div className="hidden md:flex border border-border rounded-md bg-gray-50 mb-2 text-xs font-medium text-gray-600 uppercase">
        <div className="py-2.5 px-3 w-[50%] flex items-center border-r border-border">
          <Building className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
          Instituição
        </div>
        <div className="py-2.5 px-3 w-[20%] flex items-center border-r border-border">
          <User className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
          Líder
        </div>
        <div className="py-2.5 px-3 w-[20%] flex items-center border-r border-border">
          <Instagram className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
          Instagram
        </div>
        <div className="py-2.5 px-3 w-[10%] text-center">
          Ações
        </div>
      </div>
      
      {/* Group listing */}
      <div className="space-y-1">
        {groups.map((group) => (
          <GroupListItem
            key={group.id}
            group={group}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
          />
        ))}
      </div>
    </div>
  );
};

export default GroupList; 