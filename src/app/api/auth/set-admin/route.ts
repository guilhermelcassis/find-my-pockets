import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/supabase-admin';

// WARNING: This endpoint should be secured in production
// It's primarily for development purposes

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json().catch(() => ({}));
    const { userId, makeAdmin, accessToken } = body;

    if (!userId || typeof makeAdmin !== 'boolean' || !accessToken) {
      return NextResponse.json(
        { error: 'User ID, makeAdmin flag, and access token are required' },
        { status: 400 }
      );
    }

    // Verify that the requester is an admin
    const { isAdmin, isAuthenticated, uid } = await verifyAdmin(accessToken);

    if (!isAuthenticated || !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }
    
    // Check if the role entry exists
    const { data: existingRole } = await adminDb
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Save audit metadata
    const metadata = {
      updated_by: uid,
      updated_at: new Date().toISOString()
    };

    let result;
    
    if (makeAdmin) {
      // Set user as admin
      if (existingRole) {
        // Update existing role
        result = await adminDb
          .from('user_roles')
          .update({ 
            role: 'admin',
            ...metadata
          })
          .eq('user_id', userId);
      } else {
        // Insert new role
        result = await adminDb
          .from('user_roles')
          .insert({ 
            user_id: userId,
            role: 'admin',
            created_at: metadata.updated_at,
            ...metadata
          });
      }
    } else {
      // Remove admin role (set to 'user' or delete)
      if (existingRole) {
        result = await adminDb
          .from('user_roles')
          .update({ 
            role: 'user',
            ...metadata
          })
          .eq('user_id', userId);
      } else {
        // No role to remove, return success
        return NextResponse.json({ success: true });
      }
    }

    if (result.error) {
      console.error('Error updating user role:', result.error);
      return NextResponse.json(
        { error: 'Error updating user role', details: result.error.message },
        { status: 500 }
      );
    }

    // Add an entry to the role change history table
    const { error: historyError } = await adminDb
      .from('role_change_history')
      .insert({
        user_id: userId,
        changed_by: uid,
        old_role: existingRole?.role || 'user',
        new_role: makeAdmin ? 'admin' : 'user',
        changed_at: metadata.updated_at
      });

    if (historyError) {
      console.error('Error recording role change history:', historyError);
      // Don't fail the request just because history logging failed
    }

    return NextResponse.json({
      success: true,
      message: makeAdmin ? 'User set as admin' : 'Admin privileges removed',
    });

  } catch (error) {
    console.error('Server error setting admin status:', error);
    return NextResponse.json(
      { error: 'Server error processing request', details: String(error) },
      { status: 500 }
    );
  }
} 