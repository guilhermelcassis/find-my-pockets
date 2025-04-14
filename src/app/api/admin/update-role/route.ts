import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, role, accessToken } = body;

    if (!userId || !role || !accessToken) {
      return NextResponse.json(
        { error: 'User ID, role, and access token are required' },
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

    // Audit who made the change
    const metadata = {
      updated_by: uid,
      updated_at: new Date().toISOString()
    };

    // Check if role entry exists
    const { data: existingRole } = await adminDb
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    
    if (existingRole) {
      // Update existing role
      result = await adminDb
        .from('user_roles')
        .update({ 
          role,
          ...metadata
        })
        .eq('user_id', userId);
    } else {
      // Insert new role
      result = await adminDb
        .from('user_roles')
        .insert({ 
          user_id: userId,
          role,
          ...metadata
        });
    }

    if (result.error) {
      console.error('Error updating user role:', result.error);
      return NextResponse.json(
        { error: 'Error updating user role', details: result.error.message },
        { status: 500 }
      );
    }

    // Add an entry to the role change history table for audit
    const { error: historyError } = await adminDb
      .from('role_change_history')
      .insert({
        user_id: userId,
        changed_by: uid,
        old_role: existingRole?.role || null,
        new_role: role,
        changed_at: metadata.updated_at
      });

    if (historyError) {
      console.error('Error recording role change history:', historyError);
      // We don't fail the request if just the history logging fails
    }

    // Success
    return NextResponse.json({
      success: true,
      message: `User role updated to ${role}`,
    });

  } catch (error) {
    console.error('Server error updating user role:', error);
    return NextResponse.json(
      { error: 'Server error processing role update', details: String(error) },
      { status: 500 }
    );
  }
} 