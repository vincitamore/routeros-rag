import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const { id, policyId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${process.env.API_BASE_URL}/api/config/devices/${id}/ipsec/policies/${policyId}`, {
      method: 'PUT',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Failed to update IPsec policy: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating IPsec policy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const { id, policyId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${process.env.API_BASE_URL}/api/config/devices/${id}/ipsec/policies/${policyId}`, {
      method: 'PATCH',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Failed to patch IPsec policy: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error patching IPsec policy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const { id, policyId } = await params;
    
    const response = await fetch(`${process.env.API_BASE_URL}/api/config/devices/${id}/ipsec/policies/${policyId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Failed to delete IPsec policy: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting IPsec policy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 