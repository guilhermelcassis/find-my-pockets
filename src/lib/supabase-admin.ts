import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Initialize the Supabase admin client with the service role key
// This has admin privileges and should only be used in trusted server environments
export const adminDb = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Function to set a user as admin by updating their user metadata
export const setUserAsAdmin = async (userId: string) => {
  try {
    // Update user metadata to mark them as admin
    const { error } = await adminDb.auth.admin.updateUserById(
      userId,
      { user_metadata: { admin: true } }
    );

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error setting admin metadata:', error);
    return { success: false, error };
  }
};

// Function to verify if a user is an admin
export const verifyAdmin = async (accessToken: string) => {
  try {
    // Create a client with the user's access token
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Get the user data
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { 
        isAuthenticated: false,
        isAdmin: false,
        uid: null
      };
    }

    const userId = data.user.id;

    // First check the user_roles table - this is the primary source of truth
    const { data: roleData, error: roleError } = await adminDb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // If we found a role record and it's 'admin', user is an admin
    if (!roleError && roleData?.role === 'admin') {
      return {
        isAuthenticated: true,
        isAdmin: true,
        uid: userId
      };
    }

    // Fallback to check if user has admin role in metadata
    // This is for backward compatibility
    const isAdminInMetadata = data.user.user_metadata?.admin === true;
    
    // If user has admin in metadata but not in the roles table,
    // let's update the roles table to reflect this
    if (isAdminInMetadata && (roleError || roleData?.role !== 'admin')) {
      // Update or insert admin role
      await adminDb
        .from('user_roles')
        .upsert({ 
          user_id: userId,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      console.log(`Updated user ${userId} to admin based on metadata`);
    }
    
    return { 
      isAuthenticated: true,
      isAdmin: isAdminInMetadata,
      uid: userId
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