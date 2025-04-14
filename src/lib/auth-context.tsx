'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Define the auth context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<void>;
  checkAdminStatus: () => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<User | null>;
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
  const [isAdmin, setIsAdmin] = useState(false);

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

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-redirect`,
      });
      
      if (error) throw error;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  };

  // Sign up a new user
  const signUp = async (email: string, password: string, name: string): Promise<User | null> => {
    try {
      // Create the user with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      
      if (error) throw error;
      
      // Check if auto-confirm is enabled or if email confirmation is needed
      if (data.user && data.session) {
        // User was auto-confirmed, create any additional user data in your database
        try {
          // Add user profile data to profiles table (assuming you have one)
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: name,
              email: email,
              created_at: new Date().toISOString(),
            });
            
          if (profileError) throw profileError;
        } catch (error) {
          console.error("Error creating user profile:", error);
          // Consider if you want to delete the auth user if profile creation fails
        }
      }
      
      return data.user;
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  };

  // Check if user is an admin
  const checkAdminStatus = async (): Promise<boolean> => {
    if (!session?.access_token || !user) {
      console.log("No session or user available for admin check");
      return false;
    }
    
    try {
      // Try server-side verification first if we're in a component that can make API requests
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch('/api/auth/check-admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: user.id }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setIsAdmin(data.isAdmin);
            return data.isAdmin;
          }
        } catch (apiError) {
          console.log("Server admin check failed, falling back to client check:", apiError);
          // Continue with client-side check if server check fails
        }
      }
      
      // Client-side fallback
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // This is "no rows returned" error - user simply isn't an admin
          console.log(`User ${user.id} has no role assigned`);
          setIsAdmin(false);
          return false;
        }
        
        // For other errors, log more details
        console.error("Error checking admin status:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        throw error;
      }
      
      const hasAdminRole = data?.role === 'admin';
      setIsAdmin(hasAdminRole);
      return hasAdminRole;
    } catch (error) {
      console.error("Error checking admin status:", error);
      
      // Check if this might be an RLS permission error
      if (error && typeof error === 'object' && 'code' in error && error.code === '42501') {
        console.error("This appears to be a permissions error. Check your RLS policies.");
      }
      
      setIsAdmin(false);
      return false;
    }
  };

  // Add effect to check admin status when user changes
  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signInWithGoogle,
    logOut,
    refreshToken,
    resetPassword,
    checkAdminStatus,
    signUp
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 