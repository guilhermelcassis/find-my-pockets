'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Create a separate client component for the search params section
const QueryParamsDisplay = () => {
  const searchParams = useSearchParams();
  
  // Format JSON for display
  const formatJson = (json: any) => {
    return JSON.stringify(json, null, 2);
  };
  
  return (
    <>
      <h2 className="text-lg font-semibold text-purple-800 mb-4">Query Parameters</h2>
      <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-60 mb-8">
        {formatJson(
          searchParams 
            ? Object.fromEntries(
                Array.from(searchParams.entries())
              ) 
            : {}
        )}
      </pre>
    </>
  );
};

// Main component that doesn't directly use useSearchParams
export default function AuthDebugPage() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching session:', error);
          return;
        }
        
        setSession(currentSession);
        setUser(currentSession?.user || null);
      } catch (err) {
        console.error('Error in loadSession:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadSession();
  }, []);

  // Format JSON for display
  const formatJson = (json: any) => {
    return JSON.stringify(json, null, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="bg-purple-600 px-6 py-4 text-white">
            <h1 className="text-xl font-bold">Auth Debugging</h1>
            <p className="text-sm opacity-80">
              Use this page to debug authentication issues
            </p>
          </div>
          
          <div className="p-6">
            {/* Wrap the component using useSearchParams in a Suspense boundary */}
            <Suspense fallback={<div className="p-4 text-gray-500">Loading query parameters...</div>}>
              <QueryParamsDisplay />
            </Suspense>
            
            <h2 className="text-lg font-semibold text-purple-800 mb-4">Current Session</h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 rounded-full border-t-transparent"></div>
              </div>
            ) : (
              <>
                <div className="mb-4 px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="font-medium">Status: </span>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${session ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {session ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
                
                {session && (
                  <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-96">
                    {formatJson(session)}
                  </pre>
                )}
                
                {user && (
                  <>
                    <h2 className="text-lg font-semibold text-purple-800 mt-8 mb-4">User Information</h2>
                    <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto max-h-96">
                      {formatJson(user)}
                    </pre>
                  </>
                )}
              </>
            )}
            
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-purple-800 mb-4">Actions</h2>
              
              <div className="flex space-x-4">
                <Link href="/login" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Go to Login
                </Link>
                <Link href="/reset-password" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Go to Reset Password
                </Link>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 text-white">
            <h2 className="text-lg font-semibold">Troubleshooting Tips</h2>
          </div>
          <div className="p-6">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Reset password not working?</strong> Check if the token parameter is present in the URL.</li>
              <li><strong>Token missing?</strong> Ensure your reset-redirect route is correctly passing parameters.</li>
              <li><strong>Can't log in after reset?</strong> Verify the password meets minimum requirements (6+ characters).</li>
              <li><strong>Getting redirected incorrectly?</strong> Check the callback routes and redirectTo settings.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 