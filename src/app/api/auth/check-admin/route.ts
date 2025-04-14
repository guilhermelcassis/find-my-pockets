import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;
    
    if (!userId) {
      console.log('Admin check request missing userId');
      return NextResponse.json(
        { error: 'User ID is required', isAdmin: false }, 
        { status: 400 }
      );
    }
    
    // Make sure service role key is set
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error', isAdmin: false },
        { status: 500 }
      );
    }
    
    // First, check the user_roles table (primary source of truth)
    const { data: roleData, error: roleError } = await adminDb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    // If we found a valid admin role in the database
    if (!roleError && roleData?.role === 'admin') {
      console.log(`User ${userId.substring(0, 8)}... is admin (from user_roles table)`);
      return NextResponse.json({ isAdmin: true, source: 'user_roles' });
    }

    // Second, check user metadata as fallback
    const { data: userData, error: userError } = await adminDb.auth.admin.getUserById(userId);

    if (!userError && userData?.user?.user_metadata?.admin === true) {
      console.log(`User ${userId.substring(0, 8)}... is admin (from user metadata)`);
      
      // Since we found admin in metadata but not in user_roles, 
      // let's synchronize by adding to user_roles
      try {
        const now = new Date().toISOString();
        await adminDb
          .from('user_roles')
          .upsert({ 
            user_id: userId,
            role: 'admin',
            created_at: now,
            updated_at: now,
            updated_by: 'system' // System sync operation
          });
        
        console.log(`Synchronized admin role for user ${userId.substring(0, 8)}...`);
      } catch (syncError) {
        console.error('Error synchronizing admin role:', syncError);
        // Continue anyway since the user is still an admin
      }
      
      return NextResponse.json({ isAdmin: true, source: 'metadata' });
    }

    // If we get here, user is not an admin
    console.log(`User ${userId.substring(0, 8)}... is not an admin`);
    return NextResponse.json({ isAdmin: false });
    
  } catch (error) {
    let errorMessage = 'Server error checking admin status';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Server error checking admin status:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200) + '...'
      });
    } else {
      console.error('Unknown server error checking admin status:', error);
    }
    
    return NextResponse.json(
      { error: errorMessage, isAdmin: false },
      { status: 500 }
    );
  }
} 