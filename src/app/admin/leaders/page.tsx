"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function AdminLeadersPage() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isAdmin, checkAdminStatus } = useAuth();

  useEffect(() => {
    const verifyAdmin = async () => {
      const isUserAdmin = await checkAdminStatus();
      if (!isUserAdmin) {
        router.push('/login');
      }
    };

    verifyAdmin();
  }, [checkAdminStatus, router]);

  useEffect(() => {
    // Fetch leaders data
    const fetchLeaders = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/leaders');
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaders');
        }
        
        const data = await response.json();
        setLeaders(data.leaders || []);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
        console.error('Error fetching leaders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-800">Leader Management</h1>
        <Link 
          href="/admin" 
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 rounded-full border-t-transparent"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-purple-50">
            <h2 className="font-semibold text-lg">Leaders</h2>
            <p className="text-sm text-gray-500">This page is under construction. Full leader management functionality will be available soon.</p>
          </div>
          
          <div className="p-6">
            <div className="flex justify-center p-8 text-center">
              <div className="max-w-md">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">No leaders added yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new leader.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Add Leader
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 