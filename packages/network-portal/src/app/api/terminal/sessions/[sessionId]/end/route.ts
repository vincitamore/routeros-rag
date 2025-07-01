import { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    // Forward request to backend
    const backendUrl = `${process.env.BACKEND_URL || 'http://10.0.0.185:3002'}/api/terminal/sessions/${sessionId}/end`;
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        // Forward cookies for authentication
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error ending session:', error);
    return Response.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
} 