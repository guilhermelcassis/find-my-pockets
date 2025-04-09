import { Button } from "@/components/ui/button";
import { useBreakpointValue } from "@/lib/use-breakpoint-value";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (pageNumber: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export default function LeaderListPagination({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  onPrevious, 
  onNext 
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  // Use breakpoint value for responsive design
  const isMobile = useBreakpointValue({ base: true, sm: false });
  
  if (totalPages <= 1) return null;
  
  return (
    <div 
      className="flex justify-between items-center border-t border-gray-100 px-5 py-4 mt-6"
    >
      {isMobile ? (
        <div className="flex justify-between w-full items-center">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            onClick={onPrevious}
            className="text-xs border-gray-200 flex items-center gap-1 shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          
          <span className="text-xs text-gray-600 font-medium truncate">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={onNext}
            className="text-xs border-gray-200 flex items-center gap-1 shadow-sm"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className="text-xs text-gray-500 truncate">
            Showing <span className="font-medium">{startItem}</span> to{" "}
            <span className="font-medium">{endItem}</span> of{" "}
            <span className="font-medium">{totalItems}</span> leaders
          </span>
          
          <div className="flex shadow-sm rounded-md overflow-hidden">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={onPrevious}
              className={`
                text-sm rounded-r-none border-gray-200 h-8 px-3
                ${currentPage === 1 
                  ? 'text-gray-300' 
                  : 'text-gray-600 hover:text-primary hover:border-primary'}
              `}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;
              const isCurrentPage = pageNumber === currentPage;
              
              // For many pages, show a limited range
              if (totalPages > 7) {
                // Always show first and last page
                const showFirst = pageNumber === 1;
                const showLast = pageNumber === totalPages;
                
                // Show pages around current page
                const showAround = Math.abs(pageNumber - currentPage) <= 1;
                
                // Show ellipsis
                const showFirstEllipsis = pageNumber === 2 && currentPage > 3;
                const showLastEllipsis = pageNumber === totalPages - 1 && currentPage < totalPages - 2;
                
                if (!(showFirst || showLast || showAround || showFirstEllipsis || showLastEllipsis)) {
                  return null;
                }
                
                if (showFirstEllipsis || showLastEllipsis) {
                  return (
                    <Button
                      key={`ellipsis-${pageNumber}`}
                      size="sm"
                      variant="outline"
                      disabled
                      className="text-sm rounded-none border-l-0 border-r-0 border-gray-200 h-8 px-3 cursor-default"
                    >
                      ...
                    </Button>
                  );
                }
              }
              
              return (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  onClick={() => onPageChange(pageNumber)}
                  className={`
                    text-sm rounded-none border-l-0 border-r-0 h-8 px-3
                    ${isCurrentPage 
                      ? 'bg-primary/5 text-primary border-primary z-10 font-medium border-t-2' 
                      : 'text-gray-600 border-gray-200 hover:text-primary hover:bg-primary/5'}
                  `}
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={onNext}
              className={`
                text-sm rounded-l-none border-gray-200 h-8 px-3
                ${currentPage === totalPages 
                  ? 'text-gray-300' 
                  : 'text-gray-600 hover:text-primary hover:border-primary'}
              `}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
} 