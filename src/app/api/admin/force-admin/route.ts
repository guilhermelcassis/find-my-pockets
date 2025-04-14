import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';

// WARNING: This endpoint should be secured in production!
// This is a utility endpoint for emergency admin access restoration

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, email, secretKey } = body;

    // Basic security check - should be replaced with a proper solution in production
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid secret key required.' },
        { status: 403 }
      );
    }

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      );
    }

    let targetUserId = userId;

    // If no userId but email is provided, lookup the user
    if (!targetUserId && email) {
      // Try to find user by email
      const { data: userData, error: userError } = await adminDb.auth.admin.listUsers();
      
      if (userError) {
        return NextResponse.json(
          { error: 'Error listing users', details: userError.message },
          { status: 500 }
        );
      }
      
      const user = userData.users.find(u => u.email === email);
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found with the provided email' },
          { status: 404 }
        );
      }
      
      targetUserId = user.id;
    }

    // Perform all operations to ensure admin access
    
    // 1. Update user metadata
    const { error: metadataError } = await adminDb.auth.admin.updateUserById(
      targetUserId, 
      { user_metadata: { admin: true, role: 'admin' } }
    );

    if (metadataError) {
      return NextResponse.json(
        { error: 'Error updating user metadata', details: metadataError.message },
        { status: 500 }
      );
    }

    // 2. Insert or update user_roles table
    const now = new Date().toISOString();
    const { error: roleError } = await adminDb
      .from('user_roles')
      .upsert({
        user_id: targetUserId,
        role: 'admin',
        created_at: now,
        updated_at: now,
        updated_by: 'system_force_admin'
      });

    if (roleError) {
      return NextResponse.json(
        { 
          error: 'Error updating user_roles table', 
          details: roleError.message,
          partialSuccess: true,
          metadataUpdated: true 
        },
        { status: 500 }
      );
    }

    // 3. Add to audit log
    const { error: logError } = await adminDb
      .from('role_change_history')
      .insert({
        user_id: targetUserId,
        changed_by: 'system_force_admin',
        old_role: 'unknown',
        new_role: 'admin',
        changed_at: now
      });

    if (logError) {
      console.error('Error recording role change history:', logError);
      // Don't fail just because of history logging
    }

    // Success
    return NextResponse.json({
      success: true,
      message: 'User has been forcefully granted admin privileges',
      userId: targetUserId
    });

  } catch (error) {
    console.error('Server error setting admin status:', error);
    return NextResponse.json(
      { error: 'Server error processing request', details: String(error) },
      { status: 500 }
    );
  }
} 