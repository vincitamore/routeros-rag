import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/terminal/sessions/cleanup - Clean up duplicate sessions and orphaned data
 * STEP 1.3: Session Cleanup and Deduplication - Next.js API Proxy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${process.env.API_BASE_URL}/terminal/sessions/cleanup`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to cleanup terminal sessions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Terminal sessions cleanup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 