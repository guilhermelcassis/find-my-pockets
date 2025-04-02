import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// This function handles redirect logic for auth pages
export function middleware(request: NextRequest) {
  // This middleware only redirects authenticated users from login page
  // The actual auth check happens in the client components
  const path = request.nextUrl.pathname;
  
  // Nothing to do for non-login pages
  if (path !== '/login') {
    return NextResponse.next();
  }
  
  // Check for Supabase auth cookie
  // Note: This is a simple check and doesn't validate the token
  // Full validation happens in the client components
  const authCookie = request.cookies.get('SupabaseAuth');
  
  if (authCookie) {
    // If there's a Supabase auth cookie, redirect to admin
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  
  return NextResponse.next();
}

// Only run middleware on the login page
export const config = {
  matcher: ['/login'],
}; 