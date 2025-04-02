'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

interface Leader {
  id: string;
  name: string;
  phone: string;
  email: string;
  curso: string;
  active?: boolean;
}

export default function LeadersPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [newLeader, setNewLeader] = useState({ name: '', phone: '', email: '', curso: '', active: true });
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  // Fetch leaders on component mount or when filter changes
  useEffect(() => {
    fetchLeaders();
  }, [filterActive]);

  const fetchLeaders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaders')
        .select('*');
      
      if (error) throw error;
      
      // Make sure active is set for all leaders (default to true if not specified)
      const leadersData = data as Leader[];
      leadersData.forEach(leader => {
        if (leader.active === undefined) {
          leader.active = true;
        }
      });
      
      // Filter leaders based on active status
      let filteredLeaders = leadersData;
      if (filterActive === 'active') {
        filteredLeaders = leadersData.filter(leader => leader.active !== false);
      } else if (filterActive === 'inactive') {
        filteredLeaders = leadersData.filter(leader => leader.active === false);
      }
      
      // Sort by name
      filteredLeaders.sort((a, b) => a.name.localeCompare(b.name));
      
      setLeaders(filteredLeaders);
    } catch (error) {
      console.error("Error fetching leaders:", error);
      setStatusMessage({ text: `Erro ao buscar líderes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ text: 'Adicionando líder...', type: 'info' });

    try {
      // Validate form
      if (!newLeader.name.trim() || !newLeader.phone.trim()) {
        throw new Error("Nome e telefone são obrigatórios");
      }

      // Add leader to Supabase
      const { error } = await supabase
        .from('leaders')
        .insert([newLeader])
        .select();
      
      if (error) throw error;
      
      // Update UI
      setStatusMessage({ text: `Líder ${newLeader.name} adicionado com sucesso!`, type: 'success' });
      setNewLeader({ name: '', phone: '', email: '', curso: '', active: true });
      
      // Refresh leaders list
      fetchLeaders();
    } catch (error) {
      console.error("Error adding leader:", error);
      setStatusMessage({ text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

  const startEditing = (leader: Leader) => {
    setEditingLeader({ ...leader });
    setStatusMessage(null);
  };

  const cancelEditing = () => {
    setEditingLeader(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof Leader) => {
    if (editingLeader) {
      setEditingLeader({
        ...editingLeader,
        [field]: e.target.value
      });
    }
  };

  const saveEditedLeader = async () => {
    if (!editingLeader) return;

    try {
      // Validate form
      if (!editingLeader.name.trim() || !editingLeader.phone.trim()) {
        throw new Error("Nome e telefone são obrigatórios");
      }

      setStatusMessage({ text: 'Atualizando líder...', type: 'info' });

      const { error } = await supabase
        .from('leaders')
        .update({
          name: editingLeader.name,
          phone: editingLeader.phone,
          email: editingLeader.email,
          curso: editingLeader.curso,
          active: editingLeader.active ?? true
        })
        .eq('id', editingLeader.id);
      
      if (error) throw error;
      
      // Update UI
      setStatusMessage({ text: `Líder ${editingLeader.name} atualizado com sucesso!`, type: 'success' });
      setEditingLeader(null);
      
      // Refresh leaders list
      fetchLeaders();
    } catch (error) {
      console.error("Error updating leader:", error);
      setStatusMessage({ text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

  const deactivateLeader = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja desativar ${name}? Você poderá reativá-lo depois.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('leaders')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Líder ${name} desativado com sucesso`, type: 'success' });
      fetchLeaders();
    } catch (error) {
      console.error("Error deactivating leader:", error);
      setStatusMessage({ text: `Erro ao desativar líder: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };
  
  const reactivateLeader = async (id: string, name: string) => {
    if (!confirm(`Deseja reativar ${name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('leaders')
        .update({ active: true })
        .eq('id', id);
      
      if (error) throw error;
      
      setStatusMessage({ text: `Líder ${name} reativado com sucesso`, type: 'success' });
      fetchLeaders();
    } catch (error) {
      console.error("Error reactivating leader:", error);
      setStatusMessage({ text: `Erro ao reativar líder: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Líderes</h1>
        <Link href="/admin" className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded">
          Voltar para Administração
        </Link>
      </div>
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded shadow-sm transition-all duration-300 ${
          statusMessage.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 
          statusMessage.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' : 
          'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Add new leader form */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Adicionar Novo Líder</h2>
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded shadow-sm">
            <div>
              <label className="block mb-1">Nome</label>
              <input 
                type="text"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                placeholder="Nome do Líder"
                value={newLeader.name}
                onChange={(e) => setNewLeader({...newLeader, name: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Telefone</label>
              <input 
                type="text"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                placeholder="Número de Telefone"
                value={newLeader.phone}
                onChange={(e) => setNewLeader({...newLeader, phone: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">E-mail</label>
              <input 
                type="email"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                placeholder="E-mail"
                value={newLeader.email}
                onChange={(e) => setNewLeader({...newLeader, email: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block mb-1">Curso</label>
              <input 
                type="text"
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                placeholder="Curso"
                value={newLeader.curso}
                onChange={(e) => setNewLeader({...newLeader, curso: e.target.value})}
              />
            </div>
            
            <button 
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full transition duration-200 transform hover:translate-y-[-2px] focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Adicionar Líder
            </button>
          </form>
        </div>
        
        {/* Leaders list */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Lista de Líderes ({leaders.length})</h2>
            
            {/* Add filter dropdown */}
            <div className="flex items-center space-x-2">
              <label htmlFor="leader-status-filter" className="text-sm font-medium text-gray-700">Exibir:</label>
              <select 
                id="leader-status-filter"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="active">Apenas Ativos</option>
                <option value="inactive">Apenas Inativos</option>
                <option value="all">Todos</option>
              </select>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-500">Carregando líderes...</span>
            </div>
          ) : leaders.length > 0 ? (
            <ul className="space-y-3">
              {leaders.map(leader => (
                <li 
                  key={leader.id} 
                  className={`border rounded shadow-sm transition-all duration-300 ${
                    editingLeader && editingLeader.id === leader.id 
                      ? 'border-blue-400 bg-blue-50 transform scale-[1.02]' 
                      : !leader.active ? 'bg-gray-50 opacity-75 border-gray-300' : 'hover:border-gray-300 hover:shadow'
                  }`}
                >
                  {editingLeader && editingLeader.id === leader.id ? (
                    <form 
                      className="p-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEditedLeader();
                      }}
                    >
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Nome</label>
                        <input 
                          type="text"
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                          value={editingLeader.name}
                          onChange={(e) => handleEditChange(e, 'name')}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Telefone</label>
                        <input 
                          type="text"
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                          value={editingLeader.phone}
                          onChange={(e) => handleEditChange(e, 'phone')}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                        <input 
                          type="email"
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                          value={editingLeader.email}
                          onChange={(e) => handleEditChange(e, 'email')}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Curso</label>
                        <input 
                          type="text"
                          className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                          value={editingLeader.curso}
                          onChange={(e) => handleEditChange(e, 'curso')}
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2 pt-2">
                        <button 
                          type="button"
                          onClick={cancelEditing}
                          className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200 text-gray-800 transition duration-200"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition duration-200"
                        >
                          Salvar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex justify-between items-start p-3">
                      <div className="flex-1">
                        <div className="font-medium flex items-center">
                          {leader.name}
                          {!leader.active && (
                            <span className="ml-2 bg-gray-500 text-white text-xs px-2 py-1 rounded">Inativo</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{leader.phone}</div>
                        {leader.email && (
                          <div className="text-sm text-gray-600">{leader.email}</div>
                        )}
                        {leader.curso && (
                          <div className="text-sm text-gray-500">{leader.curso}</div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => startEditing(leader)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition duration-200"
                          title="Editar líder"
                          aria-label={`Editar ${leader.name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {leader.active ? (
                          <button 
                            onClick={() => deactivateLeader(leader.id, leader.name)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition duration-200"
                            title="Desativar líder"
                            aria-label={`Desativar ${leader.name}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        ) : (
                          <button 
                            onClick={() => reactivateLeader(leader.id, leader.name)}
                            className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition duration-200"
                            title="Reativar líder"
                            aria-label={`Reativar ${leader.name}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 border rounded bg-gray-50">
              <p className="text-gray-500">
                {filterActive === 'active' ? 'Nenhum líder ativo encontrado.' :
                 filterActive === 'inactive' ? 'Nenhum líder inativo encontrado.' :
                 'Nenhum líder cadastrado. Adicione seu primeiro líder!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 