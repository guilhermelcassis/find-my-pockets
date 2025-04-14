import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization token' },
        { status: 401 }
      );
    }
    
    const accessToken = authHeader.split(' ')[1];

    // Verify the requester is an admin
    const { isAdmin, isAuthenticated } = await verifyAdmin(accessToken);

    if (!isAuthenticated || !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Fetch all users from Supabase Auth
    const { data: authUsers, error: authError } = await adminDb.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching users:', authError);
      return NextResponse.json(
        { error: 'Error fetching users', details: authError.message },
        { status: 500 }
      );
    }

    // Fetch user roles from the user_roles table
    const { data: userRoles, error: rolesError } = await adminDb
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      // We'll continue without roles data
    }

    // Create a map of user IDs to roles
    const roleMap = new Map();
    if (userRoles) {
      userRoles.forEach(role => {
        roleMap.set(role.user_id, role.role);
      });
    }

    // Fetch user profiles if needed
    const { data: profiles, error: profilesError } = await adminDb
      .from('profiles')
      .select('id, full_name');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      // We'll continue without profiles data
    }

    // Create a map of user IDs to profiles
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }

    // Transform the users data to include admin status
    const users = authUsers.users.map(user => {
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        is_admin: roleMap.get(user.id) === 'admin',
        full_name: profileMap.get(user.id)?.full_name || user.user_metadata?.full_name || null,
      };
    });

    // Return the users list
    return NextResponse.json({ users });
    
  } catch (error) {
    console.error('Server error fetching users:', error);
    return NextResponse.json(
      { error: 'Server error processing request', details: String(error) },
      { status: 500 }
    );
  }
} 