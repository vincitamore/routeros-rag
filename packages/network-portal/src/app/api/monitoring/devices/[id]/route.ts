/**
 * API Route: /api/monitoring/devices/[id]
 * 
 * Proxies individual device monitoring requests to the Fastify backend server.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get the new query parameters
    const duration = searchParams.get('duration') || '24';
    const unit = searchParams.get('unit') || 'hour';
    
    const backendUrl = `${API_BASE_URL}/api/monitoring/devices/${id}?duration=${duration}&unit=${unit}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch device metrics' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred in the API proxy' },
      { status: 500 }
    );
  }
} 