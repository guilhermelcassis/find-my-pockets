'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Group, Leader } from '@/lib/interfaces';
import Link from 'next/link';
import Script from 'next/script';
import Map, { MapRef } from '@/components/Map';

// Dashboard metrics interface
interface DashboardMetrics {
  countryCount: number;
  stateCount: number;
  cityCount: number;
  universityCount: number;
  activeGroups: number;
}

// Course stats interface
interface CourseStats {
  name: string;
  count: number;
  percentage: number;
  isGroup?: boolean;
  originalCourses?: string[];
}

// State stats interface
interface StateStats {
  name: string;
  country: string;
  count: number;
  courses: {
    name: string;
    count: number;
  }[];
}

export default function DashboardPage() {
  const mapRef = useRef<MapRef>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    countryCount: 0,
    stateCount: 0,
    cityCount: 0,
    universityCount: 0,
    activeGroups: 0,
  });
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const shouldFitBoundsRef = useRef<boolean>(false);

  // Toggle course selection
  const toggleCourse = (course: CourseStats) => {
    if (course.isGroup && course.originalCourses) {
      // Handle group of engineering courses
      const engineeringCourses = course.originalCourses;
      
      // Check if all engineering courses are already selected
      const allEngSelected = engineeringCourses.every(c => selectedCourses.includes(c));
      
      if (allEngSelected) {
        // Remove all engineering courses
        setSelectedCourses(prev => prev.filter(c => !engineeringCourses.includes(c)));
      } else {
        // Add all engineering courses that aren't already selected
        setSelectedCourses(prev => {
          const newCourses = [...prev];
          engineeringCourses.forEach(c => {
            if (!newCourses.includes(c)) {
              newCourses.push(c);
            }
          });
          return newCourses;
        });
      }
    } else {
      // Regular course toggle
      if (selectedCourses.includes(course.name)) {
        // Remove course from selection
        setSelectedCourses(prev => prev.filter(c => c !== course.name));
      } else {
        // Add course to selection
        setSelectedCourses(prev => [...prev, course.name]);
      }
    }
    
    // Set flag to adjust map boundaries after filteredGroups updates
    shouldFitBoundsRef.current = true;
  };

  // Check if all courses in a group are selected
  const isGroupSelected = (originalCourses: string[]) => {
    return originalCourses.every(course => selectedCourses.includes(course));
  };
  
  // Select state
  const selectState = (stateName: string) => {
    if (selectedState === stateName) {
      // If clicking the already selected state, clear selection
      setSelectedState('');
    } else {
      // Select the new state
      setSelectedState(stateName);
    }
    
    // Set flag to adjust map boundaries after filteredGroups updates
    shouldFitBoundsRef.current = true;
  };

  // Effect to filter groups by selected courses and state
  useEffect(() => {
    if (activeGroups.length === 0) return;

    let filtered = [...activeGroups];

    // Apply course filter if any courses are selected
    if (selectedCourses.length > 0) {
      filtered = filtered.filter(group => {
        if (group.leader && group.leader.curso) {
          return selectedCourses.includes(group.leader.curso);
        }
        return false;
      });
    }

    // Apply state filter if a state is selected
    if (selectedState) {
      filtered = filtered.filter(group => group.state === selectedState);
    }

    setFilteredGroups(filtered);
  }, [selectedCourses, selectedState, activeGroups]);

  // Effect to adjust map view when filteredGroups changes
  useEffect(() => {
    // Only adjust view if we need to (after a course selection change)
    if (shouldFitBoundsRef.current && mapRef.current && filteredGroups.length > 0) {
      // Small timeout to ensure map has updated markers
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitBoundsToMarkers();
        }
      }, 100);
      
      // Reset the flag
      shouldFitBoundsRef.current = false;
    }
  }, [filteredGroups]);

  useEffect(() => {
    // Initialize Google Maps guard
    if (typeof window !== 'undefined') {
      window.__GOOGLE_MAPS_INIT_GUARD = window.__GOOGLE_MAPS_INIT_GUARD || {
        initialized: false,
        loading: false,
        callbacks: []
      };
    }

    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        // Fetch only active groups
        const { data: groups, error } = await supabase
          .from('groups')
          .select('*')
          .eq('active', true);

        if (error) throw error;

        // Calculate metrics
        if (groups) {
          // Extract unique values
          const countries = new Set(groups.map((group) => group.country));
          const states = new Set(groups.map((group) => `${group.state}-${group.country}`));
          const cities = new Set(groups.map((group) => `${group.city}-${group.state}-${group.country}`));
          const universities = new Set(groups.map((group) => group.university));

          setMetrics({
            countryCount: countries.size,
            stateCount: states.size,
            cityCount: cities.size,
            universityCount: universities.size,
            activeGroups: groups.length,
          });

          setActiveGroups(groups);
          setFilteredGroups(groups);

          // Calculate state statistics
          const stateData: Record<string, { 
            country: string, 
            count: number, 
            courses: Record<string, number> 
          }> = {};
          
          groups.forEach(group => {
            if (group.state && group.country) {
              const stateKey = `${group.state}`;
              
              // Initialize state if not exists
              if (!stateData[stateKey]) {
                stateData[stateKey] = {
                  country: group.country,
                  count: 0,
                  courses: {}
                };
              }
              
              // Increment group count
              stateData[stateKey].count++;
              
              // Count courses in state
              if (group.leader && group.leader.curso) {
                const course = group.leader.curso.trim();
                if (course) {
                  stateData[stateKey].courses[course] = 
                    (stateData[stateKey].courses[course] || 0) + 1;
                }
              }
            }
          });
          
          // Convert to array structure for easier rendering
          const stateStatsArray = Object.entries(stateData).map(([name, data]) => ({
            name,
            country: data.country,
            count: data.count,
            courses: Object.entries(data.courses).map(([courseName, count]) => ({
              name: courseName,
              count
            })).sort((a, b) => b.count - a.count)
          })).sort((a, b) => b.count - a.count);
          
          setStateStats(stateStatsArray);
        }

        // Fetch all leaders
        const { data: leaders, error: leadersError } = await supabase
          .from('leaders')
          .select('*')
          .eq('active', true);

        if (leadersError) throw leadersError;

        // Calculate course statistics
        if (leaders) {
          const courseCounts: Record<string, number> = {};
          
          // Count occurrences of each course
          leaders.forEach((leader: Leader) => {
            if (leader.curso) {
              const course = leader.curso.trim();
              if (course) {
                courseCounts[course] = (courseCounts[course] || 0) + 1;
              }
            }
          });

          // Process and group engineering courses
          const engineeringCourses: string[] = [];
          let totalEngineeringCount = 0;
          
          Object.keys(courseCounts).forEach(course => {
            if (course.startsWith('Engenharia')) {
              engineeringCourses.push(course);
              totalEngineeringCount += courseCounts[course];
            }
          });
          
          // Remove individual engineering courses from counts
          engineeringCourses.forEach(course => {
            delete courseCounts[course];
          });
          
          // Add the grouped engineering entry if there are any
          if (engineeringCourses.length > 0) {
            courseCounts['Engenharias (todas)'] = totalEngineeringCount;
          }

          // Convert to array and calculate percentages
          const totalLeaders = leaders.length;
          const courseStatsArray: CourseStats[] = Object.entries(courseCounts)
            .map(([name, count]) => {
              // Special handling for the engineering group
              if (name === 'Engenharias (todas)') {
                return {
                  name,
                  count,
                  percentage: Math.round((count / totalLeaders) * 100),
                  isGroup: true,
                  originalCourses: engineeringCourses
                };
              }
              
              return {
                name,
                count,
                percentage: Math.round((count / totalLeaders) * 100)
              };
            })
            .sort((a, b) => b.count - a.count); // Sort by count in descending order

          setCourseStats(courseStatsArray);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
        // Fit map to markers on initial load
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitBoundsToMarkers();
          }
        }, 500);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <>
      {/* Preload Google Maps script */}
      <Script
        id="google-maps-preload"
        strategy="beforeInteractive"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&v=beta&loading=async&callback=initializeGoogleMapsGuarded`}
      />
      
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white">
        {/* Top accent line with university-themed gradient */}
        <div className="h-2 bg-gradient-to-r from-[hsl(350,65%,30%)] via-[hsl(350,65%,41%)] to-[hsl(350,65%,30%)]"></div>
        
        <div className="container mx-auto max-w-7xl px-6 py-10">
          {/* Hero Section */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center justify-center mb-3 bg-primary/10 px-3 py-1 rounded-full">
              <span className="h-2 w-2 bg-primary rounded-full mr-2"></span>
              <span className="text-xs font-medium tracking-wide uppercase text-primary">Dashboard</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-primary/90">Painel de Impacto Global</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Explore nossas estatísticas de alcance global, incluindo países, estados, cidades e universidades onde temos grupos ativos.
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">Carregando dados do painel...</p>
              </div>
            </div>
          ) : (
            <>
              {/* All metrics in a single row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
                <MetricCard
                  title="Países"
                  value={metrics.countryCount}
                  icon="🌍"
                  description="Países únicos com grupos ativos"
                />
                <MetricCard
                  title="Estados"
                  value={metrics.stateCount}
                  icon="🏙️"
                  description="Estados únicos em todos os países"
                />
                <MetricCard
                  title="Cidades"
                  value={metrics.cityCount}
                  icon="🏙️"
                  description="Cidades únicas com nossa presença"
                />
                <MetricCard
                  title="Universidades"
                  value={metrics.universityCount}
                  icon="🎓"
                  description="Universidades únicas alcançadas"
                />
                <MetricCard
                  title="Grupos Ativos"
                  value={metrics.activeGroups}
                  icon="✅"
                  description="Total de grupos ativos no mundo"
                  className="text-primary"
                />
              </div>

              {/* Map and filters section */}
              <div className="mb-12">                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-6">
                    {/* Course filter */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
                      <h2 className="text-xl font-semibold mb-4 border-l-4 border-primary pl-3 py-1">Filtro de Cursos</h2>
                      <p className="text-sm text-gray-600 mb-6">
                        Selecione cursos para filtrar o mapa e ver universidades onde esses cursos estão presentes
                      </p>
                      
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {courseStats.map((course) => (
                          <div 
                            key={course.name}
                            className={`
                              flex justify-between p-3 rounded-lg cursor-pointer transition-all
                              ${course.isGroup && isGroupSelected(course.originalCourses || []) ||
                                (!course.isGroup && selectedCourses.includes(course.name))
                                ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                                : 'hover:bg-gray-50 border border-gray-100'
                              }
                              ${course.isGroup ? 'border-l-4 border-l-blue-400' : ''}
                            `}
                            onClick={() => toggleCourse(course)}
                          >
                            <span className="truncate pr-3">
                              {course.isGroup && (
                                <span className="mr-2 text-blue-500">🔨</span>
                              )}
                              {course.name}
                            </span>
                            <span className="text-sm whitespace-nowrap">
                              {course.count} ({course.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* State filter */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
                      <h2 className="text-xl font-semibold mb-4 border-l-4 border-primary pl-3 py-1">Filtro por Estado</h2>
                      <p className="text-sm text-gray-600 mb-6">
                        Selecione um estado para ver detalhes de grupos e cursos presentes nessa região
                      </p>
                      
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {stateStats.map((state) => (
                          <div 
                            key={state.name}
                            className={`
                              flex justify-between p-3 rounded-lg cursor-pointer transition-all
                              ${selectedState === state.name
                                ? 'bg-primary/10 text-primary font-medium shadow-sm border-l-4 border-l-primary' 
                                : 'hover:bg-gray-50 border border-gray-100'
                              }
                            `}
                            onClick={() => selectState(state.name)}
                          >
                            <span className="truncate pr-3">
                              <span className="mr-2">🏛️</span>
                              {state.name}
                            </span>
                            <span className="text-sm whitespace-nowrap">
                              {state.count} grupos
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 space-y-6">
                    {/* Map component */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-primary">Mapa de Distribuição Global</h2>
                        <div className="text-sm">
                          <span className="font-medium">{filteredGroups.length}</span> de <span>{activeGroups.length}</span> grupos exibidos
                        </div>
                      </div>
                      <div className="map-wrapper">
                        <Map
                          ref={mapRef}
                          groups={filteredGroups}
                          height="500px"
                          enableClustering={true}
                        />
                      </div>
                    </div>
                    
                    {/* State details card - only shown when a state is selected */}
                    {selectedState && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                          <h2 className="text-xl font-semibold text-primary flex items-center">
                            <span className="mr-2">🏛️</span>
                            Detalhes do Estado: {selectedState}
                          </h2>
                        </div>
                        <div className="p-6">
                          {stateStats.find(s => s.name === selectedState) && (
                            <>
                              <div className="mb-6">
                                <h3 className="text-lg font-medium mb-3">Estatísticas</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-500">Total de Grupos</div>
                                    <div className="text-2xl font-bold text-primary">
                                      {stateStats.find(s => s.name === selectedState)?.count || 0}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-500">Cursos Presentes</div>
                                    <div className="text-2xl font-bold text-primary">
                                      {stateStats.find(s => s.name === selectedState)?.courses.length || 0}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-500">País</div>
                                    <div className="text-xl font-bold text-primary">
                                      {stateStats.find(s => s.name === selectedState)?.country || ''}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h3 className="text-lg font-medium mb-3">Distribuição de Cursos</h3>
                                <div className="space-y-2">
                                  {stateStats.find(s => s.name === selectedState)?.courses.map((course, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-100">
                                      <span className="text-gray-700">{course.name}</span>
                                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                                        {course.count} grupos
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="flex justify-center space-x-4 mt-10">
                <Link 
                  href="/"
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
                >
                  Voltar para Início
                </Link>
              </div>
            </>
          )}
        </div>
        
        {/* Footer area with subtle separation */}
        <div className="py-10 mt-14 border-t border-border bg-gray-50">
          <div className="container mx-auto max-w-7xl px-6">
            <p className="text-xs text-gray-500 text-center">
              © {new Date().getFullYear()} Find My Pockets. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Metric card component
interface MetricCardProps {
  title: string;
  value: number;
  icon: string;
  description?: string;
  className?: string;
}

function MetricCard({ title, value, icon, description, className = '' }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-800">{title}</h3>
          <span className="text-3xl">{icon}</span>
        </div>
        <div className="flex flex-col">
          <span className={`text-3xl font-bold ${className || 'text-gray-900'}`}>{value}</span>
          {description && (
            <span className="text-sm text-gray-500 mt-2">{description}</span>
          )}
        </div>
      </div>
    </div>
  );
} 