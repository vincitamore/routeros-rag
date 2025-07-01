import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/config/devices/${id}/ip-addresses/${addressId}`, {
      method: 'PUT',
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
    console.error('Error updating IP address:', error);
    return NextResponse.json(
      { error: 'Failed to update IP address' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params;
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const queryString = searchParams.toString();
    const backendUrl = `${API_BASE_URL}/api/config/devices/${id}/ip-addresses/${addressId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(backendUrl, {
      method: 'DELETE',
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
    console.error('Error deleting IP address:', error);
    return NextResponse.json(
      { error: 'Failed to delete IP address' },
      { status: 500 }
    );
  }
} 