import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// MIME type mapping for common file types
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed'
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const awaitedParams = await params;
    const assetPath = awaitedParams.path.join('/');
    
    // Security: Prevent directory traversal
    if (assetPath.includes('..') || assetPath.includes('\\..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    
    // Construct the full file path within the ROS directory
    const fullPath = path.resolve(process.cwd(), '../../ROS', assetPath);
    
    // Ensure the file is within the ROS directory (additional security)
    const rosDir = path.resolve(process.cwd(), '../../ROS');
    if (!fullPath.startsWith(rosDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    try {
      // Check if file exists and get stats
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        return NextResponse.json({ error: 'Not a file' }, { status: 404 });
      }
      
      // Read the file
      const fileBuffer = await fs.readFile(fullPath);
      const mimeType = getMimeType(fullPath);
      
      // Create response with appropriate headers
      const response = new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
          'Last-Modified': stats.mtime.toUTCString(),
          'ETag': `"${stats.mtime.getTime()}-${stats.size}"`,
        },
      });
      
      return response;
      
    } catch (fileError) {
      console.error(`Asset not found: ${fullPath}`, fileError);
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Asset serving error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 