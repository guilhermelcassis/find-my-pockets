'use client';
// app/(public)/page.tsx
import { useState } from 'react';

const LandingPage = () => {
    const [university, setUniversity] = useState<string>('');

    const handleSearch = async () => {
        // Fetch groups from Firestore based on the university name
        // ... existing code ...
    };

    return (
        <div>
            <h1>Find University Christian Groups</h1>
            <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="Enter university name"
            />
            <button onClick={handleSearch}>Search</button>
            {/* Display groups on a map */}
            {/* ... existing code ... */}
        </div>
    );
};

export default LandingPage;