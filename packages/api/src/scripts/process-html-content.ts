import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'node-html-parser';
import { MappingResult, ContentMapping } from '../utils/content-mapper';

export interface ProcessedNode {
  title: string;
  level: number;
  parentKey: string;
  status: 'pending' | 'processing_chunks' | 'processed' | 'html_mapped' | 'skipped' | 'error';
  
  // Legacy fields (keep for compatibility)
  content_raw: string;
  content_processed: string;
  
  // New HTML fields
  html_file_path?: string;
  html_title?: string;
  html_text_content?: string; // For embeddings
  images?: string[];
  attachments?: string[];
  
  tags: string[];
  error_message?: string;
  chunks?: any[];
  
  [key: string]: any;
}

interface ProcessingResult {
  totalProcessed: number;
  successfulMappings: number;
  failedMappings: number;
  skippedNodes: number;
  errors: Array<{ outlineKey: string; error: string }>;
}

/**
 * Extract clean text from HTML for embeddings
 */
function extractTextFromHtml(htmlContent: string): string {
  try {
    const root = parse(htmlContent);
    
    // Remove script, style, navigation elements
    root.querySelectorAll('script, style, nav, #breadcrumb-section, .page-metadata').forEach(el => el.remove());
    
    // Get main content area if it exists
    const mainContent = root.querySelector('#main-content') || root.querySelector('#content') || root;
    
    // Extract text and clean it up
    let text = mainContent.text;
    
    // Clean up whitespace and formatting
    text = text
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n')  // Multiple newlines to single newline
      .replace(/^\s+|\s+$/g, '')  // Trim start and end
      .trim();
    
    return text;
  } catch (error: any) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

/**
 * Extract image references from HTML content
 */
function extractImages(htmlContent: string): string[] {
  try {
    const root = parse(htmlContent);
    const images = root.querySelectorAll('img');
    
    return images.map(img => {
      const src = img.getAttribute('src');
      return src ? src.trim() : '';
    }).filter(src => src.length > 0);
  } catch (error: any) {
    console.error('Error extracting images from HTML:', error);
    return [];
  }
}

/**
 * Extract attachment references from HTML content
 */
function extractAttachments(htmlContent: string): string[] {
  try {
    const attachmentMatches = htmlContent.match(/attachments\/(\d+)/g);
    if (attachmentMatches) {
      return [...new Set(attachmentMatches.map(match => match.replace('attachments/', '')))];
    }
    return [];
  } catch (error: any) {
    console.error('Error extracting attachments from HTML:', error);
    return [];
  }
}

/**
 * Process a single HTML file and extract content
 */
async function processHtmlFile(mapping: ContentMapping, rosPath: string): Promise<{
  html_file_path: string;
  html_title: string;
  html_text_content: string;
  images: string[];
  attachments: string[];
}> {
  const htmlFilePath = join(rosPath, mapping.htmlFile.filePath);
  
  try {
    const htmlContent = await readFile(htmlFilePath, 'utf-8');
    
    const html_text_content = extractTextFromHtml(htmlContent);
    const images = extractImages(htmlContent);
    const attachments = extractAttachments(htmlContent);
    
    return {
      html_file_path: mapping.htmlFile.filePath,
      html_title: mapping.htmlFile.title,
      html_text_content,
      images,
      attachments
    };
  } catch (error: any) {
    throw new Error(`Failed to process HTML file ${htmlFilePath}: ${error.message}`);
  }
}

/**
 * Update a node in the processed content structure
 * The structure is flat with full path keys, not nested
 */
function updateNodeInStructure(obj: any, targetKey: string, updates: any): boolean {
  // The structure is flat - each key is a full path
  if (obj[targetKey]) {
    Object.assign(obj[targetKey], updates);
    return true;
  }
  
  return false;
}

/**
 * Main processing function
 */
export async function processHtmlContent(
  mappingResultsPath: string = './html-mapping-results.json',
  processedContentPath: string = './processed_content.json',
  rosPath: string = './ROS',
  outputPath: string = './processed_content_with_html.json',
  dryRun: boolean = false
): Promise<ProcessingResult> {
  console.log('🔄 Starting HTML content processing...');
  
  // Load mapping results
  console.log('📄 Loading mapping results...');
  const mappingContent = await readFile(mappingResultsPath, 'utf-8');
  const mappingResult: MappingResult = JSON.parse(mappingContent);
  
  // Load processed content
  console.log('📑 Loading processed content...');
  const processedContent = await readFile(processedContentPath, 'utf-8');
  const processedData = JSON.parse(processedContent);
  
  // Create a copy for processing
  const updatedData = JSON.parse(JSON.stringify(processedData));
  
  const result: ProcessingResult = {
    totalProcessed: 0,
    successfulMappings: 0,
    failedMappings: 0,
    skippedNodes: 0,
    errors: []
  };
  
  console.log(`🔗 Processing ${mappingResult.mappings.length} mappings...`);
  
  // Process each mapping
  for (let i = 0; i < mappingResult.mappings.length; i++) {
    const mapping = mappingResult.mappings[i];
    result.totalProcessed++;
    
    if (i % 50 === 0) {
      console.log(`Processing mapping ${i + 1}/${mappingResult.mappings.length}: ${mapping.htmlFile.title}`);
    }
    
    try {
      // Process the HTML file
      const htmlData = await processHtmlFile(mapping, rosPath);
      
      // Prepare updates for the node
      const updates = {
        status: 'html_mapped',
        html_file_path: htmlData.html_file_path,
        html_title: htmlData.html_title,
        html_text_content: htmlData.html_text_content,
        images: htmlData.images,
        attachments: htmlData.attachments,
        
        // Keep existing data for backward compatibility
        // Note: html_text_content will be used for new embeddings
      };
      
      // Update the node in the structure
      const updated = updateNodeInStructure(updatedData, mapping.outlineKey, updates);
      
      if (updated) {
        result.successfulMappings++;
      } else {
        result.failedMappings++;
        result.errors.push({
          outlineKey: mapping.outlineKey,
          error: `Failed to find node in structure: ${mapping.outlineKey}`
        });
      }
      
    } catch (error: any) {
      result.failedMappings++;
      result.errors.push({
        outlineKey: mapping.outlineKey,
        error: error.message || String(error)
      });
      console.error(`Error processing ${mapping.outlineKey}:`, error.message || String(error));
    }
  }
  
  // Save results
  if (!dryRun) {
    console.log('💾 Saving updated processed content...');
    await writeFile(outputPath, JSON.stringify(updatedData, null, 2));
    console.log(`✅ Updated content saved to ${outputPath}`);
  } else {
    console.log('🔍 Dry run completed - no files saved');
  }
  
  console.log('✅ HTML content processing complete!');
  console.log(`📊 Processing Statistics:
  - Total Processed: ${result.totalProcessed}
  - Successful Mappings: ${result.successfulMappings}
  - Failed Mappings: ${result.failedMappings}
  - Success Rate: ${((result.successfulMappings / result.totalProcessed) * 100).toFixed(1)}%`);
  
  if (result.errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    result.errors.slice(0, 10).forEach(error => {
      console.log(`  ${error.outlineKey}: ${error.error}`);
    });
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }
  
  return result;
}

// CLI execution
if (require.main === module) {
  const mappingResultsPath = process.argv[2] || './html-mapping-results.json';
  const processedContentPath = process.argv[3] || './processed_content.json';
  const rosPath = process.argv[4] || './ROS';
  const outputPath = process.argv[5] || './processed_content_with_html.json';
  const dryRun = process.argv.includes('--dry-run');
  
  processHtmlContent(mappingResultsPath, processedContentPath, rosPath, outputPath, dryRun)
    .then(result => {
      if (result.failedMappings === 0) {
        console.log('🎉 All mappings processed successfully!');
      } else {
        console.log(`⚠️ ${result.failedMappings} mappings failed to process`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Processing failed:', error);
      process.exit(1);
    });
} 