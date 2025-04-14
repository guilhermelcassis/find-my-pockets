'use client';

import { useAuth } from '../../lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { Users, Home, Map as MapIcon, LogOut, UserCircle, Layers } from 'lucide-react';

// Add the type declaration for the global guard
declare global {
  interface Window {
    __GOOGLE_MAPS_INIT_GUARD?: {
      initialized: boolean;
      loading: boolean;
      callbacks: Array<() => void>;
    };
    initializeGoogleMapsGuarded?: () => void;
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session, loading, logOut, refreshToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // Use Next.js's usePathname hook to track current path
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [adminCheckStarted, setAdminCheckStarted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isMountedRef = useRef(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Set mounted ref for cleanup
    isMountedRef.current = true;
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in, redirect to login
      router.push('/login');
      return;
    }

    // Check if the user is an admin
    const checkAdminStatus = async () => {
      // Prevent repeated calls and only run when component is mounted
      if (adminCheckStarted || !isMountedRef.current) return;
      setAdminCheckStarted(true);

      if (user && session) {
        try {
          // Force token refresh to get the latest claims
          const accessToken = await refreshToken() || session.access_token;
          
          // Verify admin status using Supabase Admin API via an API endpoint
          const response = await fetch('/api/auth/verify-admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accessToken }),
          });
          
          const data = await response.json();
          
          // Only update state if component is still mounted
          if (!isMountedRef.current) return;
          
          if (data.isAdmin) {
            setIsAdmin(true);
            setIsAuthReady(true);
            console.log('Admin privileges verified successfully');
          } else {
            setIsAdmin(false);
            // Not an admin, redirect to homepage
            alert('You do not have admin privileges');
            router.push('/');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          if (isMountedRef.current) {
            setIsAdmin(false);
          }
        } finally {
          if (isMountedRef.current) {
            // Reset the check status if there was an error
            setAdminCheckStarted(false);
          }
        }
      }
    };
    
    if (user && isAdmin === null && !adminCheckStarted) {
      checkAdminStatus();
    }
  }, [user, session, loading, router, isAdmin, refreshToken, adminCheckStarted]);

  // Pre-initialize __GOOGLE_MAPS_INIT_GUARD on client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__GOOGLE_MAPS_INIT_GUARD = window.__GOOGLE_MAPS_INIT_GUARD || {
        initialized: false,
        loading: false,
        callbacks: []
      };
    }
  }, []);

  if (loading || !user || isAdmin === null) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-t-primary border-r-gray-200 border-b-gray-200 border-l-gray-200 animate-spin"></div>
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary/80" />
            </div>
          </div>
          <p className="text-gray-700 font-medium">Carregando painel de administração...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return null; // Will redirect in the useEffect
  }

  // Check if a path is active - using the pathname from usePathname() hook
  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.includes(path) || false;
  };

  return (
    <>
      {/* Preload Google Maps script for admin pages */}
      <Script
        id="google-maps-preload"
        strategy="beforeInteractive"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&v=beta&loading=async&callback=initializeGoogleMapsGuarded`}
      />
      
      {/* Admin layout wrapper */}
      <div className="admin-layout min-h-screen bg-gray-50 flex flex-col">
        {/* Modern single-row colored navbar */}
        <header className="admin-navbar-gradient backdrop-blur-md sticky top-0 z-10 shadow-lg">
          <div className="max-w-7xl mx-auto">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 relative overflow-hidden">
              {/* Brand */}
              <Link href="/admin" className="flex items-center space-x-3 shrink-0 relative z-10">
                <img 
                  src="/FMP_LaranjaGradient.svg" 
                  alt="Dunamis Pockets" 
                  className="h-8 w-auto"
                />
              </Link>
              
              {/* Main navigation - redesigned with glass-effect pills */}
              <nav className="flex items-center space-x-2 relative z-10">
                <Link
                  href="/admin"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    isActive('/admin') && !isActive('/admin/users') && !isActive('/admin/leaders') && !isActive('/admin/groups')
                      ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Home className={`h-4 w-4 sm:mr-2 ${isActive('/admin') && !isActive('/admin/users') && !isActive('/admin/leaders') && !isActive('/admin/groups') ? 'text-white' : 'text-white/80'}`} />
                  <span className="hidden sm:inline">Add Group</span>
                </Link>
                
                <Link 
                  href="/admin/leaders"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    isActive('/admin/leaders')
                      ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Users className={`h-4 w-4 sm:mr-2 ${isActive('/admin/leaders') ? 'text-white' : 'text-white/80'}`} />
                  <span className="hidden sm:inline">Líderes</span>
                </Link>
                
                <Link
                  href="/admin/groups"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    isActive('/admin/groups')
                      ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <MapIcon className={`h-4 w-4 sm:mr-2 ${isActive('/admin/groups') ? 'text-white' : 'text-white/80'}`} />
                  <span className="hidden sm:inline">Grupos</span>
                </Link>
                
                <Link
                  href="/admin/users"
                  className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    isActive('/admin/users')
                      ? 'bg-white/20 text-white shadow-md backdrop-blur-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <UserCircle className={`h-4 w-4 sm:mr-2 ${isActive('/admin/users') ? 'text-white' : 'text-white/80'}`} />
                  <span className="hidden sm:inline">Usuários</span>
                </Link>
              </nav>
              
              {/* User account - with full-screen overlay dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  className="flex items-center space-x-2 rounded-full pl-2 pr-3 py-1.5 bg-white/10 hover:bg-white/20"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <UserCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-white">
                      {user?.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                </button>
                
                {/* Full-screen overlay when dropdown is open */}
                {dropdownOpen && (
                  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setDropdownOpen(false)}>
                    {/* Visible logout card */}
                    <div 
                      className="fixed top-20 right-4 w-72 bg-white rounded-lg shadow-lg overflow-hidden z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="admin-navbar-gradient p-4 text-white">
                        <h3 className="font-medium">Perfil do Usuário</h3>
                        <p className="text-sm text-white/90 truncate mt-1">{user?.email}</p>
                      </div>
                      
                      <div className="p-4">
                        <button
                          onClick={() => {
                            logOut();
                            router.push('/login');
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 py-2 px-4 rounded-full text-sm font-medium transition-all duration-150"
                        >
                          <LogOut className="h-4 w-4 text-gray-500" />
                          <span>Sair</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {isAuthReady ? children : (
              <div className="text-center py-12">
                <div className="animate-pulse">
                  <p className="text-gray-600">Finalizando autenticação...</p>
                </div>
              </div>
            )}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="admin-navbar-gradient text-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-white/80 relative z-10">
              © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
} 