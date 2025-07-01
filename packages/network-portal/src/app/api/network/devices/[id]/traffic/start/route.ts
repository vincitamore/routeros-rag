import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const response = await fetch(`${API_BASE_URL}/api/network/devices/${id}/traffic/start`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting traffic monitoring:', error);
    return NextResponse.json(
      { error: 'Failed to start traffic monitoring' },
      { status: 500 }
    );
  }
} 