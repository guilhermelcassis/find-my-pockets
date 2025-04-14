import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, accessToken } = body;

    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: 'userId and accessToken are required' },
        { status: 400 }
      );
    }

    // Verify that the requester is authenticated
    const { isAuthenticated, uid } = await verifyAdmin(accessToken);

    if (!isAuthenticated || uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized. You can only check your own admin status.' },
        { status: 403 }
      );
    }

    // Response data structure
    const statusInfo: Record<string, any> = {};

    // 1. Check user_roles table
    const { data: roleData, error: roleError } = await adminDb
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    statusInfo.user_roles = {
      exists: !roleError,
      role: roleData?.role || null,
      error: roleError ? {
        code: roleError.code,
        message: roleError.message
      } : null,
      data: roleData || null
    };

    // 2. Check user metadata
    const { data: userData, error: userError } = await adminDb.auth.admin.getUserById(userId);

    statusInfo.user_metadata = {
      exists: !userError && userData?.user !== null,
      admin: userData?.user?.user_metadata?.admin || false,
      role: userData?.user?.user_metadata?.role || null,
      error: userError ? {
        message: userError.message
      } : null
    };

    // 3. Check session information (sanitized)
    statusInfo.session = {
      exists: true,
      accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null
    };

    // 4. Add verification result
    statusInfo.verification = {
      isAuthenticated,
      userId: uid,
      matchesRequestUser: uid === userId
    };

    // Return the debug information
    return NextResponse.json(statusInfo);

  } catch (error) {
    console.error('Error getting admin debug status:', error);
    return NextResponse.json(
      { error: 'Server error checking admin status', details: String(error) },
      { status: 500 }
    );
  }
} 