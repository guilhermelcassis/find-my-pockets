'use client';

import { useState, useEffect } from 'react';
import { firestore } from '../../../lib/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

interface Leader {
  id: string;
  name: string;
  phone: string;
}

export default function LeadersPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [newLeader, setNewLeader] = useState({ name: '', phone: '' });
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch leaders on component mount
  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    setIsLoading(true);
    try {
      const leadersSnapshot = await getDocs(collection(firestore, 'leaders'));
      const leadersData = leadersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as { name: string; phone: string }
      }));
      setLeaders(leadersData);
    } catch (error) {
      console.error("Error fetching leaders:", error);
      setStatusMessage({ text: `Error fetching leaders: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ text: 'Adding leader...', type: 'info' });

    try {
      // Validate form
      if (!newLeader.name.trim() || !newLeader.phone.trim()) {
        throw new Error("Name and phone are required");
      }

      // Add leader to Firestore
      const docRef = await addDoc(collection(firestore, 'leaders'), newLeader);
      
      // Update UI
      setStatusMessage({ text: `Leader ${newLeader.name} added successfully!`, type: 'success' });
      setNewLeader({ name: '', phone: '' });
      
      // Refresh leaders list
      fetchLeaders();
    } catch (error) {
      console.error("Error adding leader:", error);
      setStatusMessage({ text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };

  const deleteLeader = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(firestore, 'leaders', id));
      setStatusMessage({ text: `Leader ${name} deleted successfully`, type: 'success' });
      fetchLeaders();
    } catch (error) {
      console.error("Error deleting leader:", error);
      setStatusMessage({ text: `Error deleting leader: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Leaders</h1>
        <Link href="/admin" className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded">
          Back to Admin
        </Link>
      </div>
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded ${
          statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 
          statusMessage.type === 'error' ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Add new leader form */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Add New Leader</h2>
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded shadow-sm">
            <div>
              <label className="block mb-1">Name</label>
              <input 
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Leader Name"
                value={newLeader.name}
                onChange={(e) => setNewLeader({...newLeader, name: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Phone</label>
              <input 
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Phone Number"
                value={newLeader.phone}
                onChange={(e) => setNewLeader({...newLeader, phone: e.target.value})}
                required
              />
            </div>
            
            <button 
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full"
            >
              Add Leader
            </button>
          </form>
        </div>
        
        {/* Leaders list */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Leaders List</h2>
          {isLoading ? (
            <p className="text-gray-500">Loading leaders...</p>
          ) : leaders.length > 0 ? (
            <ul className="space-y-2">
              {leaders.map(leader => (
                <li key={leader.id} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{leader.name}</div>
                    <div className="text-sm text-gray-600">{leader.phone}</div>
                  </div>
                  <button 
                    onClick={() => deleteLeader(leader.id, leader.name)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No leaders yet. Add your first leader!</p>
          )}
        </div>
      </div>
    </div>
  );
} 