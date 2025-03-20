import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Check if the Firebase Admin SDK is already initialized
const apps = getApps();

// Initialize the app only if it hasn't been initialized before
if (!apps.length) {
  try {
    // For production, use environment variables rather than a file
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      // Parse the credentials JSON from environment variable
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS, 'base64').toString()
      );
      
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
    } else {
      // Fallback for development - still better than including the file directly
      console.warn('FIREBASE_ADMIN_CREDENTIALS env variable not found, using default setup');
      initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

// Export the Firestore database
export const adminDb = getFirestore();
// Export the Auth instance
export const adminAuth = getAuth();

// Function to set a user as admin
export const setUserAsAdmin = async (uid: string) => {
  try {
    // Set custom claims on the user
    await adminAuth.setCustomUserClaims(uid, { admin: true });
    return { success: true };
  } catch (error) {
    console.error('Error setting admin claim:', error);
    return { success: false, error };
  }
};

// Function to verify if a user is an admin
export const verifyAdmin = async (idToken: string) => {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Check if user has admin role in custom claims
    const isAdmin = decodedToken.admin === true;
    
    return { 
      isAuthenticated: true,
      isAdmin,
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return { 
      isAuthenticated: false,
      isAdmin: false,
      uid: null
    };
  }
}; 