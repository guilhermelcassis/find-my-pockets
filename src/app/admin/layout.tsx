'use client';

import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Add state to track whether admin check has started
  const [adminCheckStarted, setAdminCheckStarted] = useState(false);
  const isMountedRef = useRef(true);

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
          <svg 
            className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            ></circle>
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return null; // Will redirect in the useEffect
  }

  return (
    <>
      {/* Preload Google Maps script for admin pages */}
      <Script
        id="google-maps-preload"
        strategy="beforeInteractive"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,marker&v=beta&loading=async&callback=initializeGoogleMapsGuarded`}
      />
      
      {/* Admin layout wrapper */}
      <div className="admin-layout">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-900">Dunamis Pockets Admin</h1>
            <div>
              <span className="text-sm text-gray-600 mr-2">
                Signed in as: {user.email}
              </span>
              <button
                className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded"
                onClick={async () => {
                  await logOut();
                  router.push('/login');
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {isAuthReady ? children : (
            <div className="text-center py-12">
              <div className="animate-pulse">
                <p className="text-gray-600">Finalizing authentication...</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
} 