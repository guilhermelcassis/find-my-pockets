'use client';

import { useState, useEffect } from 'react';
import { firestore } from '../../../lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Group } from '../../../lib/interfaces';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isValidatingInstagram, setIsValidatingInstagram] = useState<boolean>(false);
  const [isInstagramValid, setIsInstagramValid] = useState<boolean | null>(null);

  // Fetch groups on component mount
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const groupsSnapshot = await getDocs(collection(firestore, 'groups'));
      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Group, 'id'>
      })) as Group[];
      
      // Sort by university
      groupsData.sort((a, b) => a.university.localeCompare(b.university));
      
      setGroups(groupsData);
    } catch (error) {
      console.error("Error fetching groups:", error);
      setStatusMessage({ text: `Error fetching groups: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Validate Instagram username
  const validateInstagram = async (username: string) => {
    if (!username) {
      setIsInstagramValid(null);
      return;
    }
    
    // Remove @ if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    if (!cleanUsername) {
      setIsInstagramValid(null);
      return;
    }
    
    // First, check basic format validation
    const isFormatValid = /^[a-zA-Z0-9_.]{1,30}$/.test(cleanUsername);
    if (!isFormatValid) {
      setIsInstagramValid(false);
      return;
    }
    
    setIsValidatingInstagram(true);
    
    try {
      // Manual verification by checking if the profile URL exists
      const profileUrl = `https://www.instagram.com/${cleanUsername}/`;
      
      // Make a request to check if the profile exists
      const response = await fetch(profileUrl, {
        method: 'HEAD', // Only request headers, not the full page
        mode: 'no-cors', // This is needed for cross-origin requests
      });
      
      // If we can access the page without a 404 error, assume the profile exists
      // Note: Due to CORS restrictions, we might not get detailed status information
      
      // Format the username with @ if it doesn't already have it
      const formattedUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
      setIsInstagramValid(true);
      
      if (editingGroup) {
        setEditingGroup({...editingGroup, instagram: formattedUsername});
      }
      
    } catch (error) {
      console.error("Error validating Instagram:", error);
      setIsInstagramValid(false);
    } finally {
      setIsValidatingInstagram(false);
    }
  };

  const deleteGroup = async (id: string, university: string) => {
    if (!confirm(`Are you sure you want to delete the group at ${university}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(firestore, 'groups', id));
      setStatusMessage({ text: `Group at ${university} deleted successfully`, type: 'success' });
      fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      setStatusMessage({ text: `Error deleting group: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };
  
  const startEditing = (group: Group) => {
    setEditingGroup({...group});
    setIsInstagramValid(null);
  };
  
  const cancelEditing = () => {
    setEditingGroup(null);
    setIsInstagramValid(null);
  };
  
  const saveEdits = async () => {
    if (!editingGroup) return;
    
    try {
      // Only allow editing of certain fields
      const groupRef = doc(firestore, 'groups', editingGroup.id);
      await updateDoc(groupRef, {
        location: editingGroup.location,
        dayofweek: editingGroup.dayofweek,
        time: editingGroup.time,
        instagram: editingGroup.instagram,
        fullAddress: editingGroup.fullAddress || ''
      });
      
      setStatusMessage({ text: `Group at ${editingGroup.university} updated successfully`, type: 'success' });
      setEditingGroup(null);
      setIsInstagramValid(null);
      fetchGroups();
    } catch (error) {
      console.error("Error updating group:", error);
      setStatusMessage({ text: `Error updating group: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Groups</h1>
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
      
      {/* Editing Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Edit Group</h2>
            
            <div className="mb-4">
              <p className="font-semibold">{editingGroup.university}</p>
              <p className="text-sm text-gray-600">{editingGroup.city}, {editingGroup.state}, {editingGroup.country}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm">Specific Location</label>
                <input
                  type="text"
                  value={editingGroup.location}
                  onChange={(e) => setEditingGroup({...editingGroup, location: e.target.value})}
                  className="w-full border p-2 rounded"
                />
              </div>
              
              <div>
                <label className="block mb-1 text-sm">Full Address</label>
                <textarea
                  value={editingGroup.fullAddress || ''}
                  onChange={(e) => setEditingGroup({...editingGroup, fullAddress: e.target.value})}
                  className="w-full border p-2 rounded"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block mb-1 text-sm">Day of Week</label>
                <select
                  value={editingGroup.dayofweek}
                  onChange={(e) => setEditingGroup({...editingGroup, dayofweek: e.target.value})}
                  className="w-full border p-2 rounded"
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
              
              <div>
                <label className="block mb-1 text-sm">Time</label>
                <input
                  type="time"
                  value={editingGroup.time}
                  onChange={(e) => setEditingGroup({...editingGroup, time: e.target.value})}
                  className="w-full border p-2 rounded"
                />
              </div>
              
              <div>
                <label className="block mb-1 text-sm">Instagram</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editingGroup.instagram}
                    onChange={(e) => {
                      setEditingGroup({...editingGroup, instagram: e.target.value});
                      if (isInstagramValid !== null) {
                        setIsInstagramValid(null);
                      }
                    }}
                    className={`w-full border p-2 rounded pl-6 ${
                      isInstagramValid === true ? 'border-green-500' : 
                      isInstagramValid === false ? 'border-red-500' : ''
                    }`}
                  />
                  <span className="absolute left-2 top-2.5 text-gray-500">@</span>
                  {isValidatingInstagram && (
                    <span className="absolute right-2 top-2.5 text-blue-500">Checking...</span>
                  )}
                  {isInstagramValid === true && !isValidatingInstagram && (
                    <span className="absolute right-2 top-2.5 text-green-500">✓ Valid</span>
                  )}
                  {isInstagramValid === false && !isValidatingInstagram && (
                    <span className="absolute right-2 top-2.5 text-red-500">Invalid</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">Enter a valid Instagram username</p>
                  <button 
                    type="button"
                    className="text-xs text-blue-500 hover:text-blue-700"
                    onClick={() => validateInstagram(editingGroup.instagram)}
                    disabled={isValidatingInstagram || !editingGroup.instagram}
                  >
                    Verify Profile
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button 
                onClick={cancelEditing}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={saveEdits}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">All Groups ({groups.length})</h2>
        
        {isLoading ? (
          <p className="text-gray-500">Loading groups...</p>
        ) : groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="border rounded shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-3 border-b">
                  <h3 className="font-bold">{group.university}</h3>
                  <p className="text-sm">{group.city}, {group.state}</p>
                </div>
                
                <div className="p-3 space-y-2">
                  <p>
                    <span className="font-medium">Location:</span> {group.location}
                  </p>
                  {group.fullAddress && (
                    <p>
                      <span className="font-medium">Address:</span> <span className="text-sm">{group.fullAddress}</span>
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Meets:</span> {group.dayofweek} at {group.time}
                  </p>
                  <p>
                    <span className="font-medium">Instagram:</span> {group.instagram}
                  </p>
                  <p>
                    <span className="font-medium">Leader:</span> {group.leader.name} ({group.leader.phone})
                  </p>
                </div>
                
                <div className="bg-gray-50 p-3 border-t flex justify-end space-x-2">
                  <button 
                    onClick={() => startEditing(group)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteGroup(group.id, group.university)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border rounded bg-gray-50">
            <p className="text-gray-500">No groups have been added yet.</p>
            <Link href="/admin" className="text-blue-500 hover:underline mt-2 inline-block">
              Add your first group
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 