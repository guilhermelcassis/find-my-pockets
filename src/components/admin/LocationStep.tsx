'use client';

import { Dispatch, RefObject, SetStateAction } from 'react';
import { Group } from '@/lib/interfaces';
import { GoogleMap, GoogleMarker } from '@/lib/google-maps-types';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const AdminMapComponent = dynamic(
  () => import('./AdminMapComponent'),
  { ssr: false }
);

interface LocationStepProps {
  group: Group;
  setGroup: Dispatch<SetStateAction<Group>>;
  locationSelected: boolean;
  setLocationSelected: Dispatch<SetStateAction<boolean>>;
  mapsApiLoaded: boolean;
  autocompleteInitialized: boolean;
  map: GoogleMap | null;
  marker: GoogleMarker | null;
  autocompleteInputRef: RefObject<HTMLInputElement | null>;
  initAutocomplete: () => void;
  handleMapReady: (map: GoogleMap, marker: GoogleMarker) => void;
  handleMarkerPositionChange: (lat: number, lng: number) => void;
  goToStep: (step: number) => void;
}

export default function LocationStep({
  group,
  setGroup,
  locationSelected,
  setLocationSelected,
  mapsApiLoaded,
  autocompleteInitialized,
  map,
  marker,
  autocompleteInputRef,
  initAutocomplete,
  handleMapReady,
  handleMarkerPositionChange,
  goToStep
}: LocationStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Selecionar Localização</h2>
      </div>
      
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
        <label className="block mb-2 font-medium text-gray-700">Buscar Universidade <span className="text-red-500">*</span></label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            ref={autocompleteInputRef}
            type="text" 
            className={`pl-10 w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all ${!mapsApiLoaded ? 'bg-gray-100' : 'bg-white'}`}
            placeholder={mapsApiLoaded ? "Pesquisar por nome da universidade..." : "Carregando Google Maps..."}
            disabled={locationSelected || !mapsApiLoaded}
            onClick={() => {
              // Try to initialize autocomplete when the user clicks on the input
              if (window.google?.maps?.places) {
                // Always try to reinitialize on click for better reliability
                console.log("Input clicked, reinitializing autocomplete");
                window.__AUTOCOMPLETE_INITIALIZED = false;
                initAutocomplete();
              }
            }}
            onFocus={() => {
              // Also attempt to initialize on focus
              if (window.google?.maps?.places && !autocompleteInitialized) {
                console.log("Input focused, initializing autocomplete");
                initAutocomplete();
              }
            }}
          />
        </div>
        
        {locationSelected && (
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center">
              <div className="bg-green-100 p-1 rounded-full">
                <svg className="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">
                {group.university}
                {group.city && <span className="text-gray-500"> • {group.city}</span>}
              </span>
            </div>
            <button 
              type="button"
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md text-sm font-medium transition-colors flex items-center"
              onClick={() => {
                setLocationSelected(false);
                // Reset autocomplete
                if (typeof window !== 'undefined') {
                  window.__AUTOCOMPLETE_INITIALIZED = false;
                }
                
                // Reset location field
                setGroup(prev => ({
                  ...prev,
                  university: '',
                }));
                
                // Reinitialize autocomplete after a short delay
                setTimeout(() => {
                  if (window.google?.maps?.places && autocompleteInputRef.current) {
                    initAutocomplete();
                  }
                }, 300);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Alterar
            </button>
          </div>
        )}
          
        {/* Status indicators with better styling */}
        {!mapsApiLoaded && (
          <div className="mt-3 flex items-center text-yellow-600">
            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">Carregando API do Google Maps... Por favor aguarde.</p>
          </div>
        )}
        {mapsApiLoaded && !autocompleteInitialized && (
          <div className="mt-3 flex items-center text-yellow-600">
            <svg className="animate-pulse h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Inicializando autocompletar... Clique no campo de busca para ativar.</p>
          </div>
        )}
        {mapsApiLoaded && autocompleteInitialized && !locationSelected && (
          <div className="mt-3 flex items-center text-green-600">
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Digite o nome da universidade para ver sugestões. Você também pode clicar diretamente no mapa.</p>
          </div>
        )}
      </div>
      
      {/* Map container with better styling */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {mapsApiLoaded ? (
          <div className="map-wrapper">
            <AdminMapComponent
              onMapReady={handleMapReady}
              onMarkerPositionChange={handleMarkerPositionChange}
              initialCoordinates={group.coordinates}
            />
          </div>
        ) : (
          <div className="w-full h-[450px] relative overflow-hidden bg-gray-100">
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-700 font-medium">Carregando API do mapa...</p>
              <p className="text-sm text-gray-500 mt-1">Aguarde enquanto carregamos o Google Maps</p>
            </div>
          </div>
        )}
          
        <div className="bg-gray-50 py-3 px-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 flex items-center">
            <svg className="h-4 w-4 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {!locationSelected 
              ? "Clique no mapa ou pesquise uma universidade acima para definir a localização."
              : ""}
          </p>
        </div>
      </div>
      
      {/* Location Details - Simplified and more concise */}
      {locationSelected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-fadeIn">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
            <svg className="h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Detalhes da Localização
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* University */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-sm text-gray-500 mb-1">Universidade</h4>
              <p className="font-medium text-gray-800">{group.university || 'Não selecionada'}</p>
            </div>
            
            {/* City and State */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="text-sm text-gray-500 mb-1">Localização</h4>
              <p className="font-medium text-gray-800">
                {group.city && group.state 
                  ? `${group.city}, ${group.state}`
                  : group.city || group.state || 'Não disponível'}
              </p>
              {group.country && <p className="text-sm text-gray-500">{group.country}</p>}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-end mt-8">
        <button 
          type="button" 
          className={`px-6 py-3 rounded-lg font-medium text-white flex items-center transition-all ${
            locationSelected ? 'bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg' : 'bg-gray-400 cursor-not-allowed'
          }`}
          onClick={() => goToStep(2)}
          disabled={!locationSelected}
        >
          Próximo
          <svg className="ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 