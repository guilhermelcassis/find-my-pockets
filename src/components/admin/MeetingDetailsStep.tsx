'use client';

import { Dispatch, SetStateAction, useState } from 'react';
import { Group, MeetingTime } from '@/lib/interfaces';

interface MeetingDetailsStepProps {
  group: Group;
  setGroup: Dispatch<SetStateAction<Group>>;
  goToStep: (step: number) => void;
  setStatusMessage: (message: {text: string, type: 'success' | 'error' | 'info'} | null) => void;
}

export default function MeetingDetailsStep({
  group,
  setGroup,
  goToStep,
  setStatusMessage
}: MeetingDetailsStepProps) {
  
  // Add a meeting time to the group
  const addMeetingTime = () => {
    const newMeeting: MeetingTime = {
      dayofweek: '',
      time: '',
      local: ''
    };
    
    setGroup(prev => ({
      ...prev,
      meetingTimes: [...prev.meetingTimes, newMeeting]
    }));
  };
  
  // Remove a meeting time at specified index
  const removeMeetingTime = (indexToRemove: number) => {
    setGroup(prev => ({
      ...prev,
      meetingTimes: prev.meetingTimes.filter((_, index) => index !== indexToRemove)
    }));
  };
  
  // Update a specific meeting time
  const updateMeetingTime = (index: number, field: keyof MeetingTime, value: string) => {
    const updatedMeetings = [...group.meetingTimes];
    updatedMeetings[index] = {
      ...updatedMeetings[index],
      [field]: value
    };
    
    setGroup(prev => ({
      ...prev,
      meetingTimes: updatedMeetings
    }));
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-2">Passo 2: Horários de Encontro</h2>
      
      <div className="bg-gray-50 p-4 rounded border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Horários do Grupo</h3>
          <button 
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm flex items-center"
            onClick={addMeetingTime}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Adicionar Horário
          </button>
        </div>
        
        {group.meetingTimes.length === 0 ? (
          <div className="text-center py-8 bg-white rounded border border-dashed border-gray-300">
            <p className="text-gray-600 font-medium">Nenhum horário adicionado</p>
            <p className="text-sm text-gray-500 mt-1">Clique no botão acima para adicionar horários de encontro</p>
          </div>
        ) : (
          <div className="space-y-3">
            {group.meetingTimes.map((meeting, index) => (
              <div key={index} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-blue-600">Horário {index + 1}</h4>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => removeMeetingTime(index)}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium">Dia da Semana <span className="text-red-500">*</span></label>
                    <select
                      value={meeting.dayofweek}
                      className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all" 
                      onChange={(e) => updateMeetingTime(index, 'dayofweek', e.target.value)} 
                      required 
                    >
                      <option value="">Selecione um dia</option>
                      <option value="Segunda-feira">Segunda-feira</option>
                      <option value="Terça-feira">Terça-feira</option>
                      <option value="Quarta-feira">Quarta-feira</option>
                      <option value="Quinta-feira">Quinta-feira</option>
                      <option value="Sexta-feira">Sexta-feira</option>
                      <option value="Sábado">Sábado</option>
                      <option value="Domingo">Domingo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium">Horário <span className="text-red-500">*</span></label>
                    <input 
                      type="time" 
                      value={meeting.time}
                      className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all" 
                      onChange={(e) => updateMeetingTime(index, 'time', e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium">Local</label>
                    <input 
                      type="text" 
                      value={meeting.local || ''}
                      className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all" 
                      placeholder="Ex: Bloco A, Sala 101" 
                      onChange={(e) => updateMeetingTime(index, 'local', e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Type (Tipo) field */}
        <div className="mt-4">
          <div>
            <label className="block mb-1 font-medium">Tipo de Grupo</label>
            <select
              value={group.tipo || 'Publica'}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all" 
              onChange={(e) => setGroup({ ...group, tipo: e.target.value })}
            >
              <option value="Publica">Público</option>
              <option value="Privada">Privado</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Grupos públicos são visíveis para todos. Grupos privados só são visíveis com link direto.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 mt-6">
        <button 
          type="button" 
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded order-2 sm:order-1 transition-colors"
          onClick={() => goToStep(1)}
        >
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Voltar
          </span>
        </button>
        <button 
          type="button" 
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded order-1 sm:order-2 transition-colors"
          onClick={() => {
            if (group.meetingTimes.length === 0) {
              setStatusMessage({ text: 'Por favor, adicione pelo menos um horário de encontro', type: 'error' });
              return;
            }
            
            // Check if all meeting times have day and time
            const invalidMeetings = group.meetingTimes.filter(
              m => !m.dayofweek || !m.time
            );
            
            if (invalidMeetings.length > 0) {
              setStatusMessage({ text: 'Todos os horários precisam ter dia da semana e hora definidos', type: 'error' });
              return;
            }
            
            goToStep(3);
          }}
        >
          <span className="flex items-center">
            Próximo
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
} 