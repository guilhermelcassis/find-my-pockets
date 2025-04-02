'use client';

import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session, loading, logOut, refreshToken } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in, redirect to login
      router.push('/login');
      return;
    }

    // Check if the user is an admin
    const checkAdminStatus = async () => {
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
          setIsAdmin(false);
        }
      }
    };
    
    if (user && isAdmin === null) {
      checkAdminStatus();
    }
  }, [user, session, loading, router, isAdmin, refreshToken]);

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
    <div>
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
  );
} 