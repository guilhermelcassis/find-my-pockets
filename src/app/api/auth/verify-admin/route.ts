import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { idToken } = await request.json();
    
    // If no token is provided, return error
    if (!idToken) {
      return NextResponse.json({ 
        error: 'No ID token provided' 
      }, { status: 400 });
    }
    
    // Verify the token and check admin status
    const { isAuthenticated, isAdmin, uid } = await verifyAdmin(idToken);
    
    // Return the verification result
    return NextResponse.json({ 
      isAuthenticated, 
      isAdmin, 
      uid 
    });
    
  } catch (error) {
    console.error('Error in verify-admin API:', error);
    
    return NextResponse.json({ 
      error: 'An error occurred while verifying admin status' 
    }, { status: 500 });
  }
} 