import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { email, accessToken } = body;

    if (!email || !accessToken) {
      return NextResponse.json(
        { error: 'Email and access token are required' },
        { status: 400 }
      );
    }

    // Verify that the requester is an admin
    const { isAdmin, isAuthenticated } = await verifyAdmin(accessToken);

    if (!isAuthenticated || !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Generate a random temporary password (user will never see or use this)
    const tempPassword = Math.random().toString(36).slice(-12) + 
                        Math.random().toString(36).slice(-12);

    // 1. Create the user with the temporary password
    const { data: userData, error: createUserError } = await adminDb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm the email
    });

    if (createUserError) {
      console.error('Error creating user:', createUserError);
      return NextResponse.json(
        { error: 'Error creating user', details: createUserError.message },
        { status: 500 }
      );
    }

    // 2. Immediately trigger a password reset email
    const { error: resetError } = await adminDb.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/reset-redirect`,
      }
    });

    if (resetError) {
      console.error('Error sending password reset email:', resetError);
      return NextResponse.json(
        { error: 'User created but failed to send password reset email', details: resetError.message },
        { status: 500 }
      );
    }

    // Success
    return NextResponse.json({
      success: true,
      message: 'User invited successfully. Password reset email sent.',
      userId: userData.user.id,
    });
  } catch (error) {
    console.error('Server error inviting user:', error);
    return NextResponse.json(
      { error: 'Server error processing invitation', details: String(error) },
      { status: 500 }
    );
  }
} 