import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // Forward cookies for authentication
    const cookies = request.headers.get('cookie');
    
    const response = await fetch(`${BACKEND_URL}/api/admin/disk/usage`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { cookie: cookies }),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to get disk usage' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding disk usage request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 