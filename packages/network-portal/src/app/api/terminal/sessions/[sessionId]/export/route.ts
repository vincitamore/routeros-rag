import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/terminal/sessions/${sessionId}/export`, {
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

    // For file downloads, we need to forward the response headers
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    
    if (contentType && contentDisposition) {
      // This is a file download
      const fileData = await response.text();
      
      const nextResponse = new NextResponse(fileData);
      nextResponse.headers.set('Content-Type', contentType);
      nextResponse.headers.set('Content-Disposition', contentDisposition);
      
      return nextResponse;
    } else {
      // This is a JSON response
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error exporting session:', error);
    return NextResponse.json(
      { error: 'Failed to export session' },
      { status: 500 }
    );
  }
} 