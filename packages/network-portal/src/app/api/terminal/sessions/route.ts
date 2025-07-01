import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/terminal/sessions${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching terminal sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminal sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = `${API_BASE_URL}/api/terminal/sessions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
        'Content-Type': 'application/json',
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
    console.error('Error creating terminal session:', error);
    return NextResponse.json(
      { error: 'Failed to create terminal session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Try to read JSON body, but handle cases where it's empty
    let body = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      // If JSON parsing fails, use empty body
      body = {};
    }

    const url = `${API_BASE_URL}/api/terminal/sessions`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
        'Content-Type': 'application/json',
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
    console.error('Error deleting terminal sessions:', error);
    return NextResponse.json(
      { error: 'Failed to delete terminal sessions' },
      { status: 500 }
    );
  }
} 