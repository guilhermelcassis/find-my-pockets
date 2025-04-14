"use client";

import { useState, useEffect } from 'react';
import { Leader } from '@/types/Leader';
import Layout from '@/components/Layout';
import StatusMessage from '@/components/StatusMessage';
import LeaderForm from '@/components/leaders/LeaderForm';
import LeaderCard from '@/components/leaders/LeaderCard';
import LeaderListFilter, { FilterStatus } from '@/components/leaders/LeaderListFilter';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Menu, Home, Users } from 'lucide-react';

export default function LeadersPage() {
  // State
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  
  // Pagination
  const leadersPerPage = 25;

  // Toast replacement
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setStatusMessage({ text: message, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Fetch leaders from Supabase
  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leaders')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const formattedLeaders = data.map(leader => ({
          id: leader.id,
          name: leader.name,
          phone: leader.phone,
          email: leader.email || '',
          curso: leader.curso || '',
          active: leader.active ?? true
        }));
        // Sort alphabetically by name
        const sortedLeaders = formattedLeaders.sort((a, b) => a.name.localeCompare(b.name));
        setLeaders(sortedLeaders);
      }
    } catch (error) {
      console.error('Error fetching leaders:', error);
      showNotification('Error fetching leaders. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered leaders
  const filteredLeaders = leaders
    .filter(leader => {
      // Apply active filter
      if (activeFilter === 'active') return leader.active;
      if (activeFilter === 'inactive') return !leader.active;
      return true;
    })
    .filter(leader => {
      // Apply search filter
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        leader.name.toLowerCase().includes(search) ||
        leader.email.toLowerCase().includes(search) ||
        leader.phone.toLowerCase().includes(search) ||
        leader.curso.toLowerCase().includes(search)
      );
    })
    // Sort alphabetically by name
    .sort((a, b) => a.name.localeCompare(b.name));

  // Counts for the filters
  const activeLeaders = leaders.filter(leader => leader.active).length;
  const inactiveLeaders = leaders.filter(leader => !leader.active).length;

  // Pagination logic
  const indexOfLastLeader = currentPage * leadersPerPage;
  const indexOfFirstLeader = indexOfLastLeader - leadersPerPage;
  const currentLeaders = filteredLeaders.slice(indexOfFirstLeader, indexOfLastLeader);

  // New helper function to generate page numbers to display
  const getPageNumbers = () => {
    const totalPages = Math.ceil(filteredLeaders.length / leadersPerPage);
    
    // If we have 7 or fewer pages, show all pages
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Otherwise, show first page, current page, last page, and pages around current page
    // with ellipses where needed
    const pageNumbers = [];
    
    // Always show first page
    pageNumbers.push(1);
    
    // Handle start range
    if (currentPage > 3) {
      pageNumbers.push('ellipsis');
    }
    
    // Pages around current page
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);
    
    // Add page numbers around current page
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    // Handle end range
    if (currentPage < totalPages - 2) {
      pageNumbers.push('ellipsis');
    }
    
    // Always show last page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  // Modified handlePageChange function to change page
  const handleNextPage = () => {
    const nextPage = Math.min(Math.ceil(filteredLeaders.length / leadersPerPage), currentPage + 1);
    handlePageChange(nextPage);
  };
  
  const handlePreviousPage = () => {
    const prevPage = Math.max(1, currentPage - 1);
    handlePageChange(prevPage);
  };

  // Handlers
  const handleAddLeader = async (newLeader: Omit<Leader, 'id' | 'active'>) => {
    // Form validation
    const errors: Record<string, string> = {};
    if (!newLeader.name) errors.name = 'Nome é obrigatório';
    if (!newLeader.phone) errors.phone = 'Telefone é obrigatório';
    if (!newLeader.email) errors.email = 'Email é obrigatório';
    if (!newLeader.curso) errors.curso = 'Curso é obrigatório';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // Clear errors
    setFormErrors({});
    
    try {
      setLoading(true);
      const leaderData = {
        ...newLeader,
        active: true
      };
      
      const { data, error } = await supabase
        .from('leaders')
        .insert([leaderData])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Refresh the leaders list
      fetchLeaders();
        setShowAddForm(false);
        showNotification(`${newLeader.name} foi adicionado com sucesso.`, 'success');
      }
    } catch (error) {
      console.error('Error adding leader:', error);
      showNotification('Error adding leader. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLeader = async (updatedLeader: Omit<Leader, 'id' | 'active'>) => {
    // Form validation
    const errors: Record<string, string> = {};
    if (!updatedLeader.name) errors.name = 'Nome é obrigatório';
    if (!updatedLeader.phone) errors.phone = 'Telefone é obrigatório';
    if (!updatedLeader.email) errors.email = 'Email é obrigatório';
    if (!updatedLeader.curso) errors.curso = 'Curso é obrigatório';
    
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }
    
    // Clear errors
    setEditFormErrors({});
    
    if (!editingLeader) return;

    try {
      setLoading(true);
      const leaderData = {
        ...updatedLeader,
        active: editingLeader.active
      };

      const { error } = await supabase
        .from('leaders')
        .update(leaderData)
        .eq('id', editingLeader.id);
      
      if (error) throw error;
      
      // Refresh the leaders list
      fetchLeaders();
      setEditingLeader(null);
      showNotification(`${updatedLeader.name} foi atualizado com sucesso.`, 'success');
    } catch (error) {
      console.error('Error updating leader:', error);
      showNotification('Error updating leader. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleLeaderActive = async (leader: Leader) => {
    try {
      setLoading(true);
      const updatedActive = !leader.active;
      
      const { error } = await supabase
        .from('leaders')
        .update({ active: updatedActive })
        .eq('id', leader.id);
      
      if (error) throw error;
      
      // Refresh the leaders list
      fetchLeaders();
      // Clear message format to ensure visibility
      showNotification(
        updatedActive 
          ? `${leader.name.split(' ')[0]} foi ativado com sucesso` 
          : `${leader.name.split(' ')[0]} foi desativado com sucesso`, 
        'info'
      );
    } catch (error) {
      console.error('Error toggling leader status:', error);
      showNotification('Erro ao atualizar status do líder. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleFilterChange = (filter: FilterStatus) => {
    setActiveFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen">
      {/* Remove all navbar code and accent line since they're in the layout */}
      
      <div className="mb-6">
      {statusMessage && (
          <StatusMessage
            type={statusMessage.type}
            text={statusMessage.text}
            onClose={() => setStatusMessage(null)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Simplified Add/Edit Leader Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {showAddForm || editingLeader ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-base font-medium text-gray-800 text-center truncate">
                      {editingLeader ? "Editar Líder" : "Adicionar Novo Líder"}
                    </h2>
            </div>
                  <div className="p-4">
                    <LeaderForm
                      initialData={editingLeader || undefined}
                      onSubmit={editingLeader ? handleEditLeader : handleAddLeader}
                      onCancel={() => {
                        setShowAddForm(false);
                        setEditingLeader(null);
                      }}
                      errors={editingLeader ? editFormErrors : formErrors}
              />
            </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-base font-medium text-gray-800 text-center truncate">Gerenciar Líderes</h2>
            </div>
                  <div className="p-4">
                    <p className="text-gray-600 text-sm mb-4 truncate">
                      Adicione um novo líder ou edite informações de líderes existentes
                    </p>
                    <Button
                      onClick={() => setShowAddForm(true)}
                      className="w-full bg-primary text-white hover:bg-primary/90 shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span className="truncate">Adicionar Novo Líder</span>
                    </Button>
        </div>
                </>
              )}
            </div>
          </div>
          
          {/* Leaders List Section */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800 flex items-center justify-center truncate">
                  <Users className="h-5 w-5 mr-2 text-primary/70 flex-shrink-0" />
                  <span className="truncate">Lista de Líderes ({filteredLeaders.length})</span>
                </h2>
                      </div>
                      
              <div className="p-4">
                <LeaderListFilter 
                  activeFilter={activeFilter} 
                  searchTerm={searchTerm}
                  totalLeaders={leaders.length}
                  activeLeaders={leaders.filter(l => l.active).length}
                  inactiveLeaders={leaders.filter(l => !l.active).length}
                  onFilterChange={handleFilterChange}
                  onSearchChange={handleSearchChange}
                  onClearSearch={() => setSearchTerm('')}
                />

                {loading ? (
                  <div className="flex justify-center items-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                ) : filteredLeaders.length === 0 ? (
                  <EmptyState 
                    message={searchTerm ? "Nenhum líder encontrado para esta pesquisa" : "Nenhum líder disponível"} 
                    submessage={searchTerm ? "Tente ajustar os termos da busca ou remover os filtros" : "Adicione novos líderes usando o formulário ao lado"} 
                    showClearButton={!!searchTerm || activeFilter !== 'all'}
                    onClearFilters={clearFilters}
                  />
                ) : (
                  <>
                    {/* Table-like header with border */}
                    <div className="border border-border rounded-md mb-2 overflow-hidden">
                      <div className="flex items-center bg-gray-50">
                        <div className="py-2.5 px-3 w-[40%] border-r border-border text-xs uppercase font-medium text-gray-700 truncate">Nome</div>
                        <div className="py-2.5 px-3 w-[25%] border-r border-border text-xs uppercase font-medium text-gray-700 truncate">Curso</div>
                        <div className="py-2.5 px-3 w-[15%] text-center border-r border-border text-xs uppercase font-medium text-gray-700 truncate">Contato</div>
                        <div className="py-2.5 px-3 w-[20%] text-center text-xs uppercase font-medium text-gray-700 truncate">Ações</div>
                      </div>
                    </div>
                      
                    <div className="mb-4 border border-border rounded-md overflow-hidden">
                      {currentLeaders.map((leader, index) => (
                        <LeaderCard 
                          key={leader.id} 
                          leader={leader}
                          isLastItem={index === currentLeaders.length - 1}
                          onEdit={() => {
                            setEditingLeader(leader);
                            setShowAddForm(true);
                          }}
                          onToggleActive={() => toggleLeaderActive(leader)}
                        />
                      ))}
                    </div>
                      
                    {/* Pagination controls */}
                    {filteredLeaders.length > leadersPerPage && (
                      <div className="flex justify-between items-center border-t border-gray-200 px-4 py-3 mt-4">
                        <div className="hidden sm:block">
                          <p className="text-sm text-gray-700">
                            Mostrando <span className="font-medium">{((currentPage - 1) * leadersPerPage) + 1}</span> a <span className="font-medium">{Math.min(currentPage * leadersPerPage, filteredLeaders.length)}</span> de <span className="font-medium">{filteredLeaders.length}</span> líderes
                          </p>
                        </div>
                        <div className="flex justify-between sm:justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Anterior
                          </Button>
                          
                          {/* Page numbers */}
                          <div className="hidden md:flex mx-1">
                            {getPageNumbers().map((page, index) => 
                              page === 'ellipsis' ? (
                                <span key={`ellipsis-${index}`} className="px-3 py-1 text-sm text-gray-700">
                                  ...
                                </span>
                              ) : (
                                <Button
                                  key={`page-${page}`}
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(page as number)}
                                  className={`mx-0.5 min-w-8 px-3 py-1 text-sm font-medium ${
                                    currentPage === page 
                                      ? 'bg-primary text-white hover:bg-primary/90' 
                                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </Button>
                              )
                            )}
                          </div>
                          
                          {/* Mobile pagination info */}
                          <span className="md:hidden px-3 py-1 text-sm text-gray-700">
                            {currentPage} / {Math.ceil(filteredLeaders.length / leadersPerPage)}
                          </span>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === Math.ceil(filteredLeaders.length / leadersPerPage)}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Próximo
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                        )}
                      </div>
                    </div>
            </div>
        </div>
      </div>
    </div>
  );
} 