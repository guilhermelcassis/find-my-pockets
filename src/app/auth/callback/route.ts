import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  // Get the code and other parameters from the URL
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '';
  
  try {
    if (code) {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code);
    }
    
    // Determine where to redirect based on the action type
    let redirectUrl = '/';
    
    // If it's a reset password flow
    if (type === 'recovery') {
      redirectUrl = '/reset-password';
    } 
    // If it's a signup confirmation flow
    else if (type === 'signup') {
      redirectUrl = '/login';
    }
    // If there's a specific next parameter, use that
    else if (next) {
      redirectUrl = next;
    }
    // Default to admin page for other auth flows (like signin)
    else {
      redirectUrl = '/admin';
    }
    
    // Forward any additional query params to the redirect URL
    const redirectUrlWithParams = new URL(redirectUrl, requestUrl.origin);
    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (!['code', 'next'].includes(key)) {
        redirectUrlWithParams.searchParams.set(key, value);
      }
    }
    
    // Redirect to the appropriate page
    return NextResponse.redirect(redirectUrlWithParams);
  } catch (error) {
    console.error('Auth callback error:', error);
    // On error, redirect to login with error message
    return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin));
  }
} 