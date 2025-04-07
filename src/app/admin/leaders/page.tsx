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

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  curso?: string;
}

export default function LeadersPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [newLeader, setNewLeader] = useState({ name: '', phone: '', email: '', curso: '', active: true });
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editFormErrors, setEditFormErrors] = useState<FormErrors>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Function to capitalize first letter of each word in a name
  const capitalizeName = (name: string): string => {
    return name.trim().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Format phone number as user types (Brazilian format)
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Format according to Brazilian phone number pattern
    if (digitsOnly.length <= 2) {
      return digitsOnly;
    } else if (digitsOnly.length <= 6) {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2)}`;
    } else if (digitsOnly.length <= 10) {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    } else {
      return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7, 11)}`;
    }
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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

  // Validate form fields and return if valid
  const validateForm = (leader: { name: string; phone: string; email: string; curso: string }): boolean => {
    const errors: FormErrors = {};
    
    if (!leader.name.trim()) {
      errors.name = 'Nome é obrigatório';
    } else if (leader.name.trim().length < 3) {
      errors.name = 'Nome deve ter pelo menos 3 caracteres';
    }
    
    if (!leader.phone.trim()) {
      errors.phone = 'Telefone é obrigatório';
    } else if (leader.phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Telefone deve ter pelo menos 10 dígitos';
    }
    
    if (!leader.email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!isValidEmail(leader.email)) {
      errors.email = 'E-mail inválido';
    }
    
    if (!leader.curso.trim()) {
      errors.curso = 'Curso é obrigatório';
    }
    
    if (editingLeader) {
      setEditFormErrors(errors);
    } else {
      setFormErrors(errors);
    }
    
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    let value = e.target.value;
    
    // Apply formatting for specific fields
    if (field === 'phone') {
      value = formatPhoneNumber(value);
    } else if (field === 'name') {
      // Real-time validation for name field
      if (value && value.length > 0 && !/^[A-Za-zÀ-ÖØ-öø-ÿ\s]*$/.test(value)) {
        if (editingLeader) {
          setEditFormErrors({...editFormErrors, name: 'Nome deve conter apenas letras'});
        } else {
          setFormErrors({...formErrors, name: 'Nome deve conter apenas letras'});
        }
      } else {
        if (editingLeader) {
          setEditFormErrors({...editFormErrors, name: undefined});
        } else {
          setFormErrors({...formErrors, name: undefined});
        }
      }
    } else if (field === 'email') {
      // Real-time validation for email
      if (value && !isValidEmail(value)) {
        if (editingLeader) {
          setEditFormErrors({...editFormErrors, email: 'E-mail inválido'});
        } else {
          setFormErrors({...formErrors, email: 'E-mail inválido'});
        }
      } else {
        if (editingLeader) {
          setEditFormErrors({...editFormErrors, email: undefined});
        } else {
          setFormErrors({...formErrors, email: undefined});
        }
      }
    }
    
    // Update the state based on whether we're editing or adding
    if (editingLeader) {
      setEditingLeader({
        ...editingLeader,
        [field]: value
      });
    } else {
      setNewLeader({
        ...newLeader,
        [field]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields before submission
    if (!validateForm(newLeader)) {
      setStatusMessage({ text: 'Corrija os erros no formulário antes de enviar', type: 'error' });
      return;
    }
    
    setStatusMessage({ text: 'Adicionando líder...', type: 'info' });

    try {
      // Capitalize the name before adding to database
      const capitalizedName = capitalizeName(newLeader.name);

      // Add leader to Supabase
      const { error } = await supabase
        .from('leaders')
        .insert([{
          ...newLeader,
          name: capitalizedName
        }])
        .select();
      
      if (error) throw error;
      
      // Update UI
      setStatusMessage({ text: `Líder ${capitalizedName} adicionado com sucesso!`, type: 'success' });
      setNewLeader({ name: '', phone: '', email: '', curso: '', active: true });
      setFormErrors({});
      
      // Refresh leaders list
      fetchLeaders();
    } catch (error) {
      console.error("Error adding leader:", error);
      setStatusMessage({ text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    }
  };

  const startEditing = (leader: Leader) => {
    setEditingLeader({ ...leader });
    setEditFormErrors({});
    setStatusMessage(null);
  };

  const cancelEditing = () => {
    setEditingLeader(null);
    setEditFormErrors({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof Leader) => {
    handleInputChange(e, field);
  };

  const saveEditedLeader = async () => {
    if (!editingLeader) return;

    // Validate all fields before submission
    if (!validateForm(editingLeader)) {
      setStatusMessage({ text: 'Corrija os erros no formulário antes de enviar', type: 'error' });
      return;
    }

    try {
      // Capitalize the name before updating database
      const capitalizedName = capitalizeName(editingLeader.name);

      setStatusMessage({ text: 'Atualizando líder...', type: 'info' });

      const { error } = await supabase
        .from('leaders')
        .update({
          name: capitalizedName,
          phone: editingLeader.phone,
          email: editingLeader.email,
          curso: editingLeader.curso,
          active: editingLeader.active ?? true
        })
        .eq('id', editingLeader.id);
      
      if (error) throw error;
      
      // Update UI
      setStatusMessage({ text: `Líder ${capitalizedName} atualizado com sucesso!`, type: 'success' });
      setEditingLeader(null);
      setEditFormErrors({});
      
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

  // Filter leaders based on search term
  const filteredLeaders = leaders.filter(leader => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      leader.name.toLowerCase().includes(term) ||
      leader.email.toLowerCase().includes(term) ||
      leader.curso.toLowerCase().includes(term)
    );
  });

  // Auto-dismiss status messages after 5 seconds
  useEffect(() => {
    if (statusMessage && (statusMessage.type === 'success' || statusMessage.type === 'info')) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

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
              <label className="block mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                  formErrors.name ? 'border-red-500 bg-red-50' : ''
                }`}
                placeholder="Nome completo do Líder"
                value={newLeader.name}
                onChange={(e) => handleInputChange(e, 'name')}
                required
              />
              {formErrors.name && (
                <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Digite o nome completo com letras maiúsculas no início de cada palavra.</p>
            </div>
            
            <div>
              <label className="block mb-1">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                  formErrors.phone ? 'border-red-500 bg-red-50' : ''
                }`}
                placeholder="(00) 00000-0000"
                value={newLeader.phone}
                onChange={(e) => handleInputChange(e, 'phone')}
                required
              />
              {formErrors.phone && (
                <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Formato: (00) 00000-0000</p>
            </div>
            
            <div>
              <label className="block mb-1">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input 
                type="email"
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                  formErrors.email ? 'border-red-500 bg-red-50' : ''
                }`}
                placeholder="email@exemplo.com"
                value={newLeader.email}
                onChange={(e) => handleInputChange(e, 'email')}
                required
              />
              {formErrors.email && (
                <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block mb-1">
                Curso <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                  formErrors.curso ? 'border-red-500 bg-red-50' : ''
                }`}
                placeholder="Ex: Engenharia, Medicina, etc."
                value={newLeader.curso}
                onChange={(e) => handleInputChange(e, 'curso')}
                required
              />
              {formErrors.curso && (
                <p className="text-sm text-red-600 mt-1">{formErrors.curso}</p>
              )}
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
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-3">Lista de Líderes ({filteredLeaders.length})</h2>
            
            {/* Search input */}
            <div className="mb-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome, email ou curso..."
                  className="pl-10 w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* Filter dropdown */}
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
          ) : filteredLeaders.length > 0 ? (
            <ul className="space-y-3">
              {filteredLeaders.map(leader => (
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
                        <label className="block text-sm text-gray-600 mb-1">
                          Nome <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                            editFormErrors.name ? 'border-red-500 bg-red-50' : ''
                          }`}
                          value={editingLeader.name}
                          onChange={(e) => handleEditChange(e, 'name')}
                          required
                        />
                        {editFormErrors.name && (
                          <p className="text-sm text-red-600 mt-1">{editFormErrors.name}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Telefone <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                            editFormErrors.phone ? 'border-red-500 bg-red-50' : ''
                          }`}
                          value={editingLeader.phone}
                          onChange={(e) => handleEditChange(e, 'phone')}
                          required
                        />
                        {editFormErrors.phone && (
                          <p className="text-sm text-red-600 mt-1">{editFormErrors.phone}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          E-mail <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="email"
                          className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                            editFormErrors.email ? 'border-red-500 bg-red-50' : ''
                          }`}
                          value={editingLeader.email}
                          onChange={(e) => handleEditChange(e, 'email')}
                          required
                        />
                        {editFormErrors.email && (
                          <p className="text-sm text-red-600 mt-1">{editFormErrors.email}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Curso <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${
                            editFormErrors.curso ? 'border-red-500 bg-red-50' : ''
                          }`}
                          value={editingLeader.curso}
                          onChange={(e) => handleEditChange(e, 'curso')}
                          required
                        />
                        {editFormErrors.curso && (
                          <p className="text-sm text-red-600 mt-1">{editFormErrors.curso}</p>
                        )}
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
                {searchTerm ? 'Nenhum líder encontrado com este termo de busca.' :
                 filterActive === 'active' ? 'Nenhum líder ativo encontrado.' :
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