import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' }, 
        { status: 400 }
      );
    }
    
    // Use admin client with service role to bypass RLS policies
    const { data, error } = await adminDb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error checking admin status:', error);
      
      // Not found is a normal case (user isn't an admin)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ isAdmin: false });
      }
      
      return NextResponse.json(
        { error: 'Error checking admin status', details: error.message },
        { status: 500 }
      );
    }
    
    // User is an admin if they have the admin role
    return NextResponse.json({ isAdmin: data?.role === 'admin' });
    
  } catch (error) {
    console.error('Server error checking admin status:', error);
    return NextResponse.json(
      { error: 'Server error checking admin status' },
      { status: 500 }
    );
  }
} 