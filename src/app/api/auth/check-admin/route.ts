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
    
    // Use admin client with service role to bypass RLS policies
    const { data, error } = await adminDb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      // Not found is a normal case (user isn't an admin)
      if (error.code === 'PGRST116') {
        console.log(`User ${userId.substring(0, 8)}... has no admin role assigned`);
        return NextResponse.json({ isAdmin: false });
      }
      
      console.error('Error checking admin status:', {
        code: error.code,
        message: error.message,
        details: error.details,
        userId: userId.substring(0, 8) + '...'
      });
      
      return NextResponse.json(
        { error: 'Error checking admin status', details: error.message, isAdmin: false },
        { status: 500 }
      );
    }
    
    // User is an admin if they have the admin role
    const isAdmin = data?.role === 'admin';
    console.log(`User ${userId.substring(0, 8)}... admin check result: ${isAdmin}`);
    return NextResponse.json({ isAdmin });
    
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