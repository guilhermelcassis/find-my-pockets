'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Define the auth context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, currentSession: Session | null) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        // If user is logged in, set a cookie for the middleware
        if (currentSession) {
          try {
            const token = currentSession.access_token;
            
            // Set a cookie with the Supabase token
            // This is just for middleware to detect auth state
            document.cookie = `SupabaseAuth=${token}; path=/; max-age=3600; SameSite=Strict`;
          } catch (error) {
            console.error("Error handling session:", error);
          }
        } else {
          // Clear the auth cookie when signed out
          document.cookie = 'SupabaseAuth=; path=/; max-age=0; SameSite=Strict';
        }
        
        setLoading(false);
      }
    );

    // Initial session check
    const initializeAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
        document.cookie = `SupabaseAuth=${initialSession.access_token}; path=/; max-age=3600; SameSite=Strict`;
      }
      setLoading(false);
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return data.user;
    } catch (error) {
      console.error("Error signing in with email and password:", error);
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  // Force token refresh to get latest claims
  const refreshToken = async () => {
    if (session) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) throw error;
        
        if (data.session) {
          // Update cookie with new token
          document.cookie = `SupabaseAuth=${data.session.access_token}; path=/; max-age=3600; SameSite=Strict`;
          
          return data.session.access_token;
        }
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    }
    return null;
  };

  // Sign out
  const logOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear the cookie
      document.cookie = 'SupabaseAuth=; path=/; max-age=0; SameSite=Strict';
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const value = {
    user,
    session,
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