'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

interface AdminStatusInfo {
  user_roles?: {
    exists: boolean;
    role?: string;
  };
  user_metadata?: {
    exists: boolean;
    admin?: boolean;
    role?: string;
  };
  session?: {
    exists: boolean;
    accessToken?: string;
  };
}

export default function AdminDebugPage() {
  const { user, session, isAdmin, checkAdminStatus } = useAuth();
  const [statusInfo, setStatusInfo] = useState<AdminStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminForceEmail, setAdminForceEmail] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [forceResult, setForceResult] = useState<any>(null);
  const [forceLoading, setForceLoading] = useState(false);

  useEffect(() => {
    if (user && session) {
      checkAdminStatus();
      fetchAdminStatus();
    }
  }, [user, session]);

  const fetchAdminStatus = async () => {
    if (!user || !session?.access_token) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/debug-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          accessToken: session.access_token,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching admin status: ${response.status}`);
      }
      
      const data = await response.json();
      setStatusInfo(data);
    } catch (err) {
      console.error('Error fetching admin status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching admin status');
    } finally {
      setLoading(false);
    }
  };

  const handleForceAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminForceEmail || !adminSecret) {
      setError('Both email and secret key are required');
      return;
    }
    
    try {
      setForceLoading(true);
      setError(null);
      setForceResult(null);
      
      const response = await fetch('/api/admin/force-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: adminForceEmail,
          secretKey: adminSecret,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }
      
      setForceResult(result);
      setAdminForceEmail('');
      setAdminSecret('');
      
      // Refresh status after force admin
      setTimeout(() => {
        checkAdminStatus();
        fetchAdminStatus();
      }, 1000);
      
    } catch (err) {
      console.error('Error forcing admin status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error forcing admin status');
    } finally {
      setForceLoading(false);
    }
  };

  // Format JSON for display
  const formatJson = (json: any) => {
    return JSON.stringify(json, null, 2);
  };

  if (!user || !session) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800">
                You need to be logged in to access this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-purple-900 mb-6">Admin Debug Tools</h1>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="bg-purple-600 px-6 py-4 text-white">
              <h2 className="text-lg font-medium">Current Admin Status</h2>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <span className="font-medium">User ID: </span>
                <span className="font-mono text-sm">{user.id}</span>
              </div>
              
              <div className="mb-4">
                <span className="font-medium">Email: </span>
                <span>{user.email}</span>
              </div>
              
              <div className="mb-6">
                <span className="font-medium">Admin Status from Auth Context: </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isAdmin 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {isAdmin ? 'Is Admin' : 'Not Admin'}
                </span>
              </div>
              
              <button
                onClick={fetchAdminStatus}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh Status'}
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-purple-600 px-6 py-4 text-white">
              <h2 className="text-lg font-medium">Force Admin Access</h2>
              <p className="text-sm text-white/80">
                Use this in case of emergency access issues
              </p>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleForceAdmin} className="space-y-4">
                <div>
                  <label htmlFor="adminForceEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="adminForceEmail"
                    type="email"
                    value={adminForceEmail}
                    onChange={(e) => setAdminForceEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    placeholder="user@example.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="adminSecret" className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Secret Key
                  </label>
                  <input
                    id="adminSecret"
                    type="password"
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    placeholder="Secret key"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={forceLoading || !adminForceEmail || !adminSecret}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {forceLoading ? 'Processing...' : 'Force Admin Status'}
                </button>
              </form>
              
              {forceResult && (
                <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
                  <p className="font-medium">Success!</p>
                  <pre className="mt-2 text-xs overflow-auto">{formatJson(forceResult)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-purple-600 px-6 py-4 text-white">
              <h2 className="text-lg font-medium">Admin Status Details</h2>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : statusInfo ? (
                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">{formatJson(statusInfo)}</pre>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Click "Refresh Status" to fetch admin status details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 