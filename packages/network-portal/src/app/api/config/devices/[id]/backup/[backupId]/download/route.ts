import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  try {
    const { id, backupId } = await params;
    
    const response = await fetch(`${API_BASE_URL}/api/config/devices/${id}/backup/${backupId}/download`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    // For file downloads, we need to pass through the response as-is
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    
    if (contentType === 'application/octet-stream' || contentDisposition?.includes('attachment')) {
      // This is a file download
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
          'Content-Disposition': contentDisposition || 'attachment; filename="backup.backup"',
        },
      });
    } else {
      // This is a JSON response (likely an error)
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error downloading backup file:', error);
    return NextResponse.json(
      { error: 'Failed to download backup file' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  try {
    const { id, backupId } = await params;
    const body = await request.json();
    
    // Use backupId as backupName for the download-from-device endpoint
    const response = await fetch(`${API_BASE_URL}/api/config/devices/${id}/backup/${backupId}/download`, {
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
    console.error('Error downloading backup from device:', error);
    return NextResponse.json(
      { error: 'Failed to download backup from device' },
      { status: 500 }
    );
  }
} 