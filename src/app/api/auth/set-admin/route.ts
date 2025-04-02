import { NextRequest, NextResponse } from 'next/server';
import { setUserAsAdmin } from '../../../../lib/supabase-admin';

// WARNING: This endpoint should be secured in production
// It's primarily for development purposes

export async function POST(request: NextRequest) {
  try {
    // Check if not in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'This endpoint is disabled in production' 
      }, { status: 403 });
    }
    
    // Parse the request body
    const { uid } = await request.json();
    
    // If no UID is provided, return error
    if (!uid) {
      return NextResponse.json({ 
        error: 'No user ID provided' 
      }, { status: 400 });
    }
    
    // Set the user as an admin
    const result = await setUserAsAdmin(uid);
    
    // Return the result
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in set-admin API:', error);
    
    return NextResponse.json({ 
      error: 'An error occurred while setting admin status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 