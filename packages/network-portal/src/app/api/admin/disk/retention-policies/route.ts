import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie');
    
    const response = await fetch(`${BACKEND_URL}/api/admin/disk/retention-policies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { cookie: cookies }),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to get retention policies' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding retention policies request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 