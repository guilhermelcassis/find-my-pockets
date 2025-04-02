'use client';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-md">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Admin Dashboard</h2>
        <p className="text-gray-600">
          Initializing resources and loading data...
        </p>
      </div>
    </div>
  );
} 