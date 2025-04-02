/**
 * Script to set a user as admin in Supabase
 * 
 * Usage: node scripts/set-admin-supabase.js [email]
 * 
 * This script updates a user's metadata in Supabase to mark them as an admin
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Get email from command line args or use default
const EMAIL_TO_PROMOTE = process.argv[2] || 'guilhermelcassis@gmail.com';

// Initialize Supabase admin client with service role key
function initializeSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local file');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Function to set user as admin
async function setUserAsAdmin(email) {
  const supabase = initializeSupabaseAdmin();
  
  try {
    // First, get the user by email
    const { data: users, error: getUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    // If user table doesn't exist or we can't query it, try auth API
    if (getUserError || !users) {
      console.log('Could not find user in database tables, trying auth API...');
      
      // Get user by email from auth API
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;
      
      const user = authUsers.find(u => u.email === email);
      
      if (!user) {
        throw new Error(`User with email ${email} not found`);
      }
      
      // Update user metadata to mark as admin
      const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { user_metadata: { admin: true } }
      );
      
      if (error) throw error;
      
      console.log(`Successfully set admin status for user ${email} (ID: ${user.id})`);
      
      // Verify the change
      const { data: updatedUser, error: verifyError } = await supabase.auth.admin.getUserById(user.id);
      
      if (verifyError) throw verifyError;
      
      console.log('Updated user metadata:', updatedUser.user.user_metadata);
      return;
    }
    
    // If we found the user in the database table
    const userId = users.id;
    
    // Update user metadata
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: { admin: true } }
    );
    
    if (error) throw error;
    
    console.log(`Successfully set admin status for user ${email} (ID: ${userId})`);
    
    // Verify the change
    const { data: updatedUser, error: verifyError } = await supabase.auth.admin.getUserById(userId);
    
    if (verifyError) throw verifyError;
    
    console.log('Updated user metadata:', updatedUser.user.user_metadata);
    
  } catch (error) {
    console.error(`Error setting admin status for ${email}:`, error);
    
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure the user has already signed up with this email');
    console.log('2. Check that your SUPABASE_SERVICE_ROLE_KEY has admin permissions');
    console.log('3. Verify that your Supabase project URL is correct');
  }
}

// Main function
async function main() {
  try {
    console.log(`Setting admin status for ${EMAIL_TO_PROMOTE}...`);
    await setUserAsAdmin(EMAIL_TO_PROMOTE);
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
main(); 