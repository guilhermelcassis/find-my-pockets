import { Button } from '@/components/ui/button';
import { SearchX, FileX } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  submessage?: string;
  showClearButton?: boolean;
  onClearFilters?: () => void;
}

export default function EmptyState({
  message,
  submessage,
  showClearButton = false,
  onClearFilters
}: EmptyStateProps) {
  const isSearch = message.toLowerCase().includes('pesquisa') || message.toLowerCase().includes('search');
  
  return (
    <div className="flex flex-col justify-center items-center bg-white rounded-lg py-12 px-8 text-center my-6 border border-gray-100 shadow-sm">
      <div className="bg-accent/40 shadow-sm rounded-full w-16 h-16 flex items-center justify-center mb-6 border border-accent/20">
        {isSearch ? (
          <SearchX className="w-7 h-7 text-primary/70" />
        ) : (
          <FileX className="w-7 h-7 text-primary/70" />
        )}
      </div>
      
      <div className="flex flex-col gap-3 max-w-md items-center">
        <h2 className="text-lg font-medium text-gray-800">
          {message}
        </h2>
        
        {submessage && (
          <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
            {submessage}
          </p>
        )}
        
        {showClearButton && onClearFilters && (
          <div className="mt-6 w-full text-center">
            <Button 
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white px-6 shadow-sm"
              onClick={onClearFilters}
            >
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 