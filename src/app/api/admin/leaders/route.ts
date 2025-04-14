import { NextRequest, NextResponse } from 'next/server';
import { adminDb, verifyAdmin } from '@/lib/supabase-admin';
import { Leader } from '@/lib/interfaces';

export async function GET(request: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization token' },
        { status: 401 }
      );
    }
    
    const accessToken = authHeader.split(' ')[1];

    // Verify the requester is an admin
    const { isAdmin, isAuthenticated } = await verifyAdmin(accessToken);

    if (!isAuthenticated || !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Fetch all leaders from the database
    const { data: leadersData, error } = await adminDb
      .from('leaders')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching leaders:', error);
      return NextResponse.json(
        { error: 'Error fetching leaders', details: error.message },
        { status: 500 }
      );
    }

    // Format and return the leaders data
    const leaders = leadersData.map((leader: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      curso?: string;
      active?: boolean;
    }) => ({
      id: leader.id,
      name: leader.name,
      phone: leader.phone,
      email: leader.email || '',
      curso: leader.curso || '',
      active: leader.active ?? true,
    }));

    return NextResponse.json({ leaders });
    
  } catch (error) {
    console.error('Server error fetching leaders:', error);
    return NextResponse.json(
      { error: 'Server error processing request', details: String(error) },
      { status: 500 }
    );
  }
} 