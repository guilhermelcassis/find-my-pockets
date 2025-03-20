'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  getIdToken
} from 'firebase/auth';
import { auth } from './firebase';

// Define the auth context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  logOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Set persistence on mount
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(error => {
      console.error("Error setting auth persistence:", error);
    });
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // If user is logged in, get the ID token and set a cookie
      // This is used by the middleware for simple auth checks
      if (user) {
        try {
          const token = await getIdToken(user, true);
          
          // Set a cookie with the Firebase token
          // This is just for middleware to detect auth state
          // Not used for actual auth which happens client-side
          document.cookie = `FirebaseAuth=${token}; path=/; max-age=3600; SameSite=Strict`;
        } catch (error) {
          console.error("Error getting ID token:", error);
        }
      } else {
        // Clear the auth cookie when signed out
        document.cookie = 'FirebaseAuth=; path=/; max-age=0; SameSite=Strict';
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Error signing in with email and password:", error);
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      return userCredential.user;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  // Force token refresh to get latest claims
  const refreshToken = async () => {
    if (user) {
      try {
        // This forces a token refresh
        const newToken = await getIdToken(user, true);
        
        // Update cookie with new token
        document.cookie = `FirebaseAuth=${newToken}; path=/; max-age=3600; SameSite=Strict`;
        
        return newToken;
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    }
    return null;
  };

  // Sign out
  const logOut = async () => {
    try {
      await signOut(auth);
      // Clear the cookie
      document.cookie = 'FirebaseAuth=; path=/; max-age=0; SameSite=Strict';
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signInWithGoogle,
    logOut,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 