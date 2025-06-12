import { readFile } from 'fs/promises';
import { join } from 'path';

interface ProcessedNode {
  title: string;
  level: number;
  parentKey: string | null;
  status: string;
  content_raw?: string;
  content_processed?: string;
  html_file_path?: string;
  html_title?: string;
  html_text_content?: string;
  images?: string[];
  attachments?: string[];
  tags?: string[];
  chunks?: any[];
  error_message?: string;
}

async function validateHtmlContent() {
  try {
    console.log('🔍 Validating HTML-enhanced content...');
    
    // Load the enhanced content
    const enhancedContentPath = join(process.cwd(), 'processed_content_with_html.json');
    const enhancedRaw = await readFile(enhancedContentPath, 'utf-8');
    const enhanced: Record<string, ProcessedNode> = JSON.parse(enhancedRaw);
    
    console.log('✅ JSON parsing successful');
    
    // Basic statistics
    const totalNodes = Object.keys(enhanced).length;
    console.log(`📊 Total nodes: ${totalNodes}`);
    
    // Count HTML-enhanced nodes
    let htmlEnhanced = 0;
    let withImages = 0;
    let withAttachments = 0;
    let statusCounts: Record<string, number> = {};
    
    for (const [key, node] of Object.entries(enhanced)) {
      // Count status
      statusCounts[node.status] = (statusCounts[node.status] || 0) + 1;
      
      if (node.html_file_path) {
        htmlEnhanced++;
      }
      
      if (node.images && node.images.length > 0) {
        withImages++;
      }
      
      if (node.attachments && node.attachments.length > 0) {
        withAttachments++;
      }
    }
    
    console.log(`📝 HTML-enhanced nodes: ${htmlEnhanced}`);
    console.log(`🖼️ Nodes with images: ${withImages}`);
    console.log(`📎 Nodes with attachments: ${withAttachments}`);
    console.log(`📊 Status distribution:`, statusCounts);
    
    // Sample some nodes with HTML content
    console.log('\n📋 Sample HTML-enhanced nodes:');
    let sampleCount = 0;
    for (const [key, node] of Object.entries(enhanced)) {
      if (node.html_file_path && sampleCount < 3) {
        console.log(`\n${sampleCount + 1}. ${key}`);
        console.log(`   Title: ${node.title}`);
        console.log(`   HTML File: ${node.html_file_path}`);
        console.log(`   HTML Title: ${node.html_title}`);
        console.log(`   Status: ${node.status}`);
        console.log(`   Text Length: ${node.html_text_content?.length || 0} chars`);
        console.log(`   Images: ${node.images?.length || 0}`);
        console.log(`   Attachments: ${node.attachments?.length || 0}`);
        
        if (node.images && node.images.length > 0) {
          console.log(`   Sample Images: ${node.images.slice(0, 2).join(', ')}`);
        }
        
        sampleCount++;
      }
    }
    
    console.log('\n✅ Validation complete - file structure is valid!');
    
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    if (error instanceof SyntaxError) {
      console.error('💡 JSON parsing error - file may be corrupted');
    }
  }
}

// Run if called directly
if (require.main === module) {
  validateHtmlContent().catch(console.error);
}

export { validateHtmlContent }; 