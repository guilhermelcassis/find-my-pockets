import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get('token') || '';
  const type = requestUrl.searchParams.get('type') || '';
  
  // Build URL to reset password page with necessary params
  const resetPasswordUrl = new URL('/reset-password', requestUrl.origin);
  
  // Pass all query parameters to the reset password page
  for (const [key, value] of requestUrl.searchParams.entries()) {
    resetPasswordUrl.searchParams.set(key, value);
  }
  
  // Log the redirection for debugging
  console.log(`Redirecting password reset: ${request.url} -> ${resetPasswordUrl.toString()}`);
  
  // Redirect to the reset password page
  return NextResponse.redirect(resetPasswordUrl);
} 