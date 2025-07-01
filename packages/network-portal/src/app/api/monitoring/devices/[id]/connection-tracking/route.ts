import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hours = searchParams.get('hours') || '1';
    const live = searchParams.get('live') === 'true';
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('hours', hours);
    queryParams.set('live', live.toString());
    
    // Forward the request to the backend API
    const response = await fetch(`${process.env.API_BASE_URL}/api/monitoring/devices/${id}/connection-tracking?${queryParams}`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch connection tracking data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Connection tracking proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 