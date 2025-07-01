import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  try {
    const { id, backupId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/config/devices/${id}/backup/${backupId}/device`, {
      method: 'DELETE',
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
    console.error('Error deleting backup from device:', error);
    return NextResponse.json(
      { error: 'Failed to delete backup from device' },
      { status: 500 }
    );
  }
} 