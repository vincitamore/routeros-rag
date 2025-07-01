/**
 * API Route: /api/monitoring/devices
 * 
 * Proxies monitoring devices requests to the Fastify backend server.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    
    const response = await fetch(`${API_BASE_URL}/api/monitoring/devices?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Monitoring devices API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring devices' },
      { status: 500 }
    );
  }
} 