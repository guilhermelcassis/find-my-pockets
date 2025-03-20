'use client';

import { useState } from 'react';
import { Group } from '../lib/interfaces';
import { firestore } from '../lib/firebase';
import { collection, getDocs, query, where, or } from 'firebase/firestore';
import Link from 'next/link';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    try {
      const groupsRef = collection(firestore, 'groups');
      
      // Search across multiple fields
      const q = query(
        groupsRef,
        or(
          where('university', '>=', searchTerm), 
          where('university', '<=', searchTerm + '\uf8ff'),
          where('city', '>=', searchTerm),
          where('city', '<=', searchTerm + '\uf8ff'),
          where('state', '>=', searchTerm),
          where('state', '<=', searchTerm + '\uf8ff'),
          where('country', '>=', searchTerm),
          where('country', '<=', searchTerm + '\uf8ff')
        )
      );
      
      const querySnapshot = await getDocs(q);
      const results: Group[] = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as Group);
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching for groups:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Find Dunamis Pockets at Universities
        </h1>
        
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by university, city, state, or country"
              className="flex-grow p-3 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-r"
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Display search results */}
        {searchResults.length > 0 ? (
          <div>
            <h2 className="text-xl font-semibold mb-4">Search Results:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((group) => (
                <div key={group.id} className="border rounded p-4 shadow-sm">
                  <h3 className="font-bold text-lg">Dunamis Pockets at {group.university}</h3>
                  <p>{group.city}</p>
                  <p>{`${group.state}, ${group.country}`}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center">
              <Link 
                href="/map" 
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              >
                View All Results on Map
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            {isLoading ? (
              <p>Searching...</p>
            ) : searchTerm ? (
              <p>No results found. Try another search term.</p>
            ) : (
              <p>Enter a search term to find a Dunamis Pocket.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
