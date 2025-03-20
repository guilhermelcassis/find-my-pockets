'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Group } from '../../lib/interfaces';
import Map from '../../components/Map';

export default function MapPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groupsCollection = collection(firestore, 'groups');
        const groupsSnapshot = await getDocs(groupsCollection);
        
        const groupsList: Group[] = [];
        groupsSnapshot.forEach((doc) => {
          groupsList.push({ id: doc.id, ...doc.data() } as Group);
        });
        
        setGroups(groupsList);
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dunamis Pockets Map</h1>
      
      {groups.length > 0 ? (
        <>
          <div className="mb-4">
            <Map groups={groups} />
          </div>
          
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">All Dunamis Pockets ({groups.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div key={group.id} className="border rounded p-4 shadow-sm">
                  <h3 className="font-bold text-lg">{group.university}</h3>
                  <p>{group.city}</p>
                  <p>{`${group.state}, ${group.country}`}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center p-8">
          <p>No groups found. Please add some groups from the admin page.</p>
        </div>
      )}
    </div>
  );
} 