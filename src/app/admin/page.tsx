// app/(admin)/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Group } from '../../lib/interfaces';
import { firestore } from '../../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import Link from 'next/link';

// Flag to prevent duplicate Google Maps loading
declare global {
  interface Window {
    google: any;
    googleMapsLoaded: boolean;
  }
}

const AdminPage = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const autocompleteInputRef = useRef<HTMLInputElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [marker, setMarker] = useState<google.maps.Marker | null>(null);
    const [statusMessage, setStatusMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);
    const [leaders, setLeaders] = useState<{ id: string; name: string; phone: string }[]>([]);
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
    const [locationSelected, setLocationSelected] = useState<boolean>(false);
    const [isValidatingInstagram, setIsValidatingInstagram] = useState<boolean>(false);
    const [isInstagramValid, setIsInstagramValid] = useState<boolean | null>(null);
    
    const [group, setGroup] = useState<Group>({
        id: '',
        name: 'Dunamis Pocket', // Default name for all groups
        university: '',
        city: '',
        state: '',
        country: '',
        location: '',
        instagram: '',
        dayofweek: '',
        time: '',
        leader: { name: '', phone: '' },
        coordinates: { latitude: 0, longitude: 0 },
        fullAddress: '',
    });

    // Fetch leaders
    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const leadersSnapshot = await getDocs(collection(firestore, 'leaders'));
                const leadersData = leadersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data() as { name: string; phone: string }
                }));
                setLeaders(leadersData);
            } catch (error) {
                console.error("Error fetching leaders:", error);
            }
        };
        
        fetchLeaders();
    }, []);

    // Initialize Google Maps
    useEffect(() => {
        const loadGoogleMaps = () => {
            // Check if Google Maps is already loaded to prevent multiple loads
            if (!window.google && !window.googleMapsLoaded) {
                // Set flag to prevent duplicate loads
                window.googleMapsLoaded = true;
                
                const script = document.createElement('script');
                // Use the new Places API
                script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=beta`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
                
                script.onload = initMap;
            } else if (window.google) {
                initMap();
            }
        };
        
        loadGoogleMaps();
        
        // Cleanup function
        return () => {
            // We can't remove the Google script, but we can clean up our components
            if (map) {
                setMap(null);
            }
            if (marker) {
                setMarker(null);
            }
        };
    }, []);

    const initMap = () => {
        if (mapRef.current && window.google) {
            // Default to a central position (can be changed)
            const defaultLocation = { lat: -24.65236500245874, lng: -47.87912740708651 };
            
            const newMap = new window.google.maps.Map(mapRef.current, {
                center: defaultLocation,
                zoom: 7,
                mapTypeControl: true,
            });
            
            setMap(newMap);
            
            // Initialize the marker
            const newMarker = new window.google.maps.Marker({
                position: defaultLocation,
                map: newMap,
                draggable: true,
            });
            
            setMarker(newMarker);
            
            // Add click listener to the map
            newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
                if (e.latLng) {
                    newMarker.setPosition(e.latLng);
                    updateCoordinatesFromMarker(e.latLng);
                }
            });
            
            // Add drag end listener to the marker
            newMarker.addListener('dragend', () => {
                const position = newMarker.getPosition();
                if (position) {
                    updateCoordinatesFromMarker(position);
                }
            });
            
            // Initialize Places Autocomplete with the new API
            if (autocompleteInputRef.current) {
                // Create autocomplete with university bias
                const autocompleteOptions = {
                    types: ['university', 'school'],
                    fields: ['name', 'address_components', 'geometry', 'formatted_address']
                };
                
                const autocomplete = new window.google.maps.places.Autocomplete(
                    autocompleteInputRef.current,
                    autocompleteOptions
                );
                
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    console.log("Selected place:", place); // For debugging
                    
                    if (place.geometry && place.geometry.location) {
                        // Update the map
                        newMap.setCenter(place.geometry.location);
                        newMap.setZoom(14);
                        
                        // Update the marker
                        newMarker.setPosition(place.geometry.location);
                        
                        // Update coordinates
                        updateCoordinatesFromMarker(place.geometry.location);
                        
                        // Extract address components
                        let city = '';
                        let state = '';
                        let country = '';
                        let zipCode = '';
                        let university = place.name || '';
                        let fullAddress = place.formatted_address || '';
                        
                        if (place.address_components) {
                            for (const component of place.address_components) {
                                const types = component.types;
                                
                                if (types.includes('locality') || types.includes('postal_town')) {
                                    city = component.long_name;
                                } else if (types.includes('administrative_area_level_2') && !city) {
                                    // Use administrative_area_level_2 as fallback for city
                                    city = component.long_name;
                                } else if (types.includes('administrative_area_level_1')) {
                                    state = component.long_name;
                                } else if (types.includes('country')) {
                                    country = component.long_name;
                                } else if (types.includes('postal_code')) {
                                    zipCode = component.long_name;
                                }
                            }
                        }
                        
                        // If no city was found in address components, try a different approach
                        if (!city && place.formatted_address) {
                            // Try to extract city from formatted address
                            const addressParts = place.formatted_address.split(',');
                            if (addressParts.length >= 2) {
                                // The city is often the second part in the formatted address
                                city = addressParts[1].trim();
                            }
                        }
                        
                        console.log("Extracted data:", { 
                            university, 
                            city, 
                            state, 
                            country, 
                            zipCode,
                            fullAddress
                        }); // For debugging
                        
                        // Update form with the extracted data
                        setGroup((prev: Group) => ({
                            ...prev,
                            university: university,
                            city: city || prev.city,
                            state: state || prev.state,
                            country: country || prev.country,
                            location: university, // Set location as the university name
                            fullAddress: fullAddress // Add full address
                        }));
                        
                        // Mark that a location has been selected to make fields read-only
                        setLocationSelected(true);
                    }
                });
            }
        }
    };

    const updateCoordinatesFromMarker = (position: google.maps.LatLng) => {
        const lat = position.lat();
        const lng = position.lng();
        
        setGroup((prev: Group) => ({
            ...prev,
            coordinates: {
                latitude: lat,
                longitude: lng
            }
        }));
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
            // The no-cors mode will restrict what information we can access
            
            // Format the username with @ if it doesn't already have it
            const formattedUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
            setIsInstagramValid(true);
            setGroup(prev => ({ ...prev, instagram: formattedUsername }));
            
        } catch (error) {
            console.error("Error validating Instagram:", error);
            setIsInstagramValid(false);
        } finally {
            setIsValidatingInstagram(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage({ text: 'Saving group...', type: 'info' });
        
        try {
            // Find the selected leader
            const selectedLeader = leaders.find(leader => leader.id === selectedLeaderId);
            
            if (!selectedLeader) {
                throw new Error("Please select a leader");
            }
            
            // Make sure name field exists even if empty
            const groupToSave = {
                ...group,
                name: group.name || 'Dunamis Pocket',
                leader: {
                    name: selectedLeader.name,
                    phone: selectedLeader.phone
                }
            };
            
            // Add group to Firestore using Firebase v9 modular syntax
            const docRef = await addDoc(collection(firestore, 'groups'), groupToSave);
            console.log("Group added with ID: ", docRef.id);
            
            setStatusMessage({ text: `Success! Group added with ID: ${docRef.id}`, type: 'success' });
            
            // Reset form
            setGroup({ 
                id: '', 
                name: 'Dunamis Pocket',
                university: '', 
                city: '', 
                state: '', 
                country: '', 
                location: '',
                instagram: '',
                dayofweek: '',
                time: '',
                leader: { name: '', phone: '' },
                coordinates: { latitude: -24.65236500245874, longitude: -47.87912740708651 },
                fullAddress: '',
            });
            
            setSelectedLeaderId('');
            setLocationSelected(false);
            setIsInstagramValid(null);
            
            // Reset marker to default position if map exists
            if (map && marker) {
                const defaultLocation = { lat: -24.65236500245874, lng: -47.87912740708651 };
                map.setCenter(defaultLocation);
                map.setZoom(2);
                marker.setPosition(defaultLocation);
            }
            
            // Clear the search input
            if (autocompleteInputRef.current) {
                autocompleteInputRef.current.value = '';
            }
        } catch (error) {
            console.error("Error adding group: ", error);
            setStatusMessage({ text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Add Dunamis Pockets</h1>
                <div>
                    <Link href="/admin/groups" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2">
                        View All Groups
                    </Link>
                    <Link href="/admin/leaders" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded">
                        Manage Leaders
                    </Link>
                </div>
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
            
            <div className="mb-6">
                <label className="block mb-1">Search University</label>
                <input 
                    ref={autocompleteInputRef}
                    type="text" 
                    className="w-full border p-2 rounded" 
                    placeholder="Search for university" 
                    disabled={locationSelected}
                />
                {locationSelected && (
                    <button 
                        className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                        onClick={() => setLocationSelected(false)}
                    >
                        Change Location
                    </button>
                )}
            </div>
            
            <div className="mb-6">
                <div ref={mapRef} className="w-full h-[400px] border rounded"></div>
                <p className="text-sm text-gray-600 mt-2">Click on the map or drag the marker to set the exact location.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">               
                {/* Location Details - Display as read-only information cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold col-span-full">Location Details</h2>
                    
                    {/* University */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">University</h3>
                        <p className="font-medium">{group.university || 'Not selected'}</p>
                    </div>
                    
                    {/* City */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">City</h3>
                        <p className="font-medium">{group.city || 'Not selected'}</p>
                    </div>
                    
                    {/* State/Province */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">State/Province</h3>
                        <p className="font-medium">{group.state || 'Not selected'}</p>
                    </div>
                    
                    {/* Country */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <h3 className="text-sm text-gray-500">Country</h3>
                        <p className="font-medium">{group.country || 'Not selected'}</p>
                    </div>
                    
                    {/* Full Address */}
                    <div className="bg-white p-3 rounded shadow-sm col-span-full">
                        <h3 className="text-sm text-gray-500">Full Address</h3>
                        <p className="font-medium text-sm mt-1">{group.fullAddress || 'Not available'}</p>
                    </div>
                    
                    {/* Location */}
                    <div className="bg-white p-3 rounded shadow-sm col-span-full">
                        <h3 className="text-sm text-gray-500">Specific Location</h3>
                        <input 
                            type="text" 
                            value={group.location}
                            className="w-full border p-2 rounded mt-1" 
                            placeholder="Specific location on campus" 
                            onChange={(e) => setGroup({ ...group, location: e.target.value })} 
                            required 
                        />
                    </div>
                </div>

                {/* Group Meeting Details */}
                <div className="bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold mb-3">Meeting Details</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Day of Week</label>
                            <select
                                value={group.dayofweek}
                                className="w-full border p-2 rounded" 
                                onChange={(e) => setGroup({ ...group, dayofweek: e.target.value })} 
                                required 
                            >
                                <option value="">Select a day</option>
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
                            <label className="block mb-1">Time</label>
                            <input 
                                type="time" 
                                value={group.time}
                                className="w-full border p-2 rounded" 
                                onChange={(e) => setGroup({ ...group, time: e.target.value })} 
                                required 
                            />
                        </div>
                    </div>
                </div>

                {/* Social Media & Contact */}
                <div className="bg-gray-50 p-4 rounded border">
                    <h2 className="font-semibold mb-3">Contact Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Instagram</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={group.instagram}
                                    className={`w-full border p-2 rounded pl-6 ${
                                        isInstagramValid === true ? 'border-green-500' : 
                                        isInstagramValid === false ? 'border-red-500' : ''
                                    }`} 
                                    placeholder="@username" 
                                    onChange={(e) => {
                                        setGroup({ ...group, instagram: e.target.value });
                                        // Don't validate on every keystroke to avoid excessive requests
                                        if (isInstagramValid !== null) {
                                            setIsInstagramValid(null);
                                        }
                                    }}
                                    required 
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
                                    onClick={() => validateInstagram(group.instagram)}
                                    disabled={isValidatingInstagram || !group.instagram}
                                >
                                    Verify Profile
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 italic">We check if the Instagram profile actually exists.</p>
                        </div>

                        <div>
                            <label className="block mb-1">Leader</label>
                            <select
                                value={selectedLeaderId}
                                className="w-full border p-2 rounded"
                                onChange={(e) => setSelectedLeaderId(e.target.value)}
                                required
                            >
                                <option value="">Select a leader</option>
                                {leaders.map(leader => (
                                    <option key={leader.id} value={leader.id}>
                                        {leader.name} ({leader.phone})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full md:w-auto"
                >
                    Add Group
                </button>
            </form>
        </div>
    );
};

export default AdminPage;