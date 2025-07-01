import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deviceId } = await params;
    
    const response = await fetch(`${API_BASE_URL}/api/network/settings/traffic-monitoring/${deviceId}`, {
      method: 'GET',
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
    console.error('Error fetching traffic monitoring settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traffic monitoring settings' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deviceId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/network/settings/traffic-monitoring/${deviceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating traffic monitoring settings:', error);
    return NextResponse.json(
      { error: 'Failed to update traffic monitoring settings' },
      { status: 500 }
    );
  }
} 