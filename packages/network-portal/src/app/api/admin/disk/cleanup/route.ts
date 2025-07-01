import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie');
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/admin/disk/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { cookie: cookies }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to perform cleanup' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error forwarding cleanup request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 