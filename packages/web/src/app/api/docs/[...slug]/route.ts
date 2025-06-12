import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface ProcessedNode {
    title: string;
    level: number;
    parentKey: string | null;
    status: string;
    content_raw: string;
    content_processed: string;
    tags: string[];
    html_file_path?: string;
    html_title?: string;
    html_text_content?: string;
    images?: string[];
    attachments?: string[];
    chunks?: any[];
    error_message?: string;
}

interface ProcessedContent {
    [key: string]: ProcessedNode;
}

export async function GET(
    request: Request,
    { params }: { params: { slug: string[] } }
) {
    try {
        const awaitedParams = await params;
        const slug = `routeros/${awaitedParams.slug.join('/')}`;
        const filePath = path.resolve(process.cwd(), '../../processed_content.json');
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const allContent: ProcessedContent = JSON.parse(fileContent);

        // --- Enhanced Debugging ---
        console.log('--- Debug Info ---');
        console.log('Received slug for lookup:', `'${slug}'`);
        const availableKeys = Object.keys(allContent);
        console.log(`Found ${availableKeys.length} keys in the JSON file.`);
        console.log('First 5 available keys:', availableKeys.slice(0, 5).map(k => `'${k}'`));
        console.log('--- End Debug Info ---');
        // --- End Enhanced Debugging ---

        if (allContent[slug]) {
            const node = allContent[slug];
            
            // Debug logging
            console.log(`Node for ${slug}:`, {
                hasHtmlFilePath: !!node.html_file_path,
                htmlFilePath: node.html_file_path,
                status: node.status,
                statusCheck: node.status === 'html_mapped'
            });
            

            
            // Check if HTML content is available
            console.log('Checking HTML condition:', {
                hasPath: !!node.html_file_path,
                path: node.html_file_path,
                status: node.status,
                condition: !!(node.html_file_path && node.status === 'html_mapped')
            });
            
            if (node.html_file_path && node.status === 'html_mapped') {
                try {
                    // Serve HTML content - look in ROS directory
                    const htmlFilePath = path.resolve(process.cwd(), '../../ROS', node.html_file_path);
                    console.log(`Attempting to read HTML file: ${htmlFilePath}`);
                    const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
                    
                    return NextResponse.json({
                        title: node.html_title || node.title,
                        content_type: 'html',
                        content_html: htmlContent,
                        content_processed: node.content_processed, // Keep as fallback
                        images: node.images || [],
                        attachments: node.attachments || [],
                        html_text_content: node.html_text_content
                    });
                } catch (htmlError) {
                    console.warn(`Failed to load HTML file for ${slug}:`, htmlError);
                    // Fall through to markdown fallback
                }
            }
            
            // Fallback to markdown content
            return NextResponse.json({
                title: node.title,
                content_type: 'markdown',
                content_processed: node.content_processed,
                images: [],
                attachments: []
            });
        } else {
            console.error(`Key lookup failed: The key '${slug}' was not found in processed_content.json.`);
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Failed to read or parse document content:', error);
        return NextResponse.json({ error: 'Failed to load content' }, { status: 500 });
    }
} 