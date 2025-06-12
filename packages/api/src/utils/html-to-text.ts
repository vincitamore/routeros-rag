import { parse } from 'node-html-parser';

export interface TextExtractionOptions {
  preserveFormatting?: boolean;
  includeImageAltText?: boolean;
  includeLinkText?: boolean;
  includeTableStructure?: boolean;
  maxChunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_OPTIONS: TextExtractionOptions = {
  preserveFormatting: true,
  includeImageAltText: true,
  includeLinkText: true,
  includeTableStructure: true,
  maxChunkSize: 30000,
  chunkOverlap: 1500
};

/**
 * Extract clean text from HTML for vector embeddings
 */
export function extractTextFromHtml(htmlContent: string, options: TextExtractionOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const root = parse(htmlContent);
    
    // Remove unwanted elements
    root.querySelectorAll('script, style, nav, header, footer, .page-metadata, #breadcrumb-section, .navigation').forEach(el => el.remove());
    
    // Get main content area if it exists
    const mainContent = root.querySelector('#main-content, .main-content, #content, .content, main') || root;
    
    let text = '';
    
    if (opts.includeTableStructure) {
      text += extractTableText(mainContent);
    }
    
    if (opts.includeLinkText) {
      text += extractLinkText(mainContent);
    }
    
    if (opts.includeImageAltText) {
      text += extractImageAltText(mainContent);
    }
    
    // Extract main text content
    text += extractMainText(mainContent, opts.preserveFormatting || false);
    
    // Clean up the text
    return cleanText(text);
  } catch (error: any) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

/**
 * Extract text from tables with structure preservation
 */
function extractTableText(element: any): string {
  const tables = element.querySelectorAll('table');
  let tableText = '';
  
  tables.forEach((table: any) => {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td, th');
      const cellTexts = cells.map((cell: any) => cell.text.trim()).filter((text: string) => text);
      if (cellTexts.length > 0) {
        tableText += cellTexts.join(' | ') + '\n';
      }
    });
    tableText += '\n';
  });
  
  return tableText;
}

/**
 * Extract link text and URLs
 */
function extractLinkText(element: any): string {
  const links = element.querySelectorAll('a[href]');
  let linkText = '';
  
  links.forEach((link: any) => {
    const text = link.text.trim();
    const href = link.getAttribute('href');
    if (text && href && !href.startsWith('#')) {
      linkText += `${text} `;
    }
  });
  
  return linkText;
}

/**
 * Extract image alt text
 */
function extractImageAltText(element: any): string {
  const images = element.querySelectorAll('img[alt]');
  let altText = '';
  
  images.forEach((img: any) => {
    const alt = img.getAttribute('alt');
    if (alt && alt.trim()) {
      altText += `${alt.trim()} `;
    }
  });
  
  return altText;
}

/**
 * Extract main text content with optional formatting preservation
 */
function extractMainText(element: any, preserveFormatting: boolean): string {
  if (!preserveFormatting) {
    return element.text;
  }
  
  // Replace block elements with newlines
  let html = element.innerHTML;
  
  // Add newlines for block elements
  html = html.replace(/<\/?(h[1-6]|p|div|br|li|tr)[^>]*>/gi, '\n');
  html = html.replace(/<\/?(ul|ol|table)[^>]*>/gi, '\n\n');
  
  // Remove all other HTML tags
  html = html.replace(/<[^>]*>/g, ' ');
  
  return html;
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Multiple newlines to double newline
    .replace(/^\s+|\s+$/g, '')  // Trim start and end
    .trim();
}

/**
 * Split text into chunks suitable for embeddings
 */
export function splitTextIntoChunks(text: string, chunkSize: number = 30000, chunkOverlap: number = 1500): string[] {
  const chunks: string[] = [];
  
  if (chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be less than chunkSize");
  }
  
  // Try to split on paragraph boundaries first
  const paragraphs = text.split('\n\n');
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap from previous chunk
      const overlapText = currentChunk.slice(-chunkOverlap);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If any chunk is still too large, split it on sentence boundaries
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize) {
      finalChunks.push(chunk);
    } else {
      // Fallback to character-based splitting
      const subChunks = splitByCharacters(chunk, chunkSize, chunkOverlap);
      finalChunks.push(...subChunks);
    }
  }
  
  return finalChunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Fallback character-based splitting
 */
function splitByCharacters(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - chunkOverlap;
  }
  
  return chunks;
}

/**
 * Extract structured content metadata from HTML
 */
export function extractContentMetadata(htmlContent: string): {
  headings: string[];
  codeBlocks: string[];
  tables: number;
  images: number;
  links: number;
} {
  try {
    const root = parse(htmlContent);
    
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6').map((h: any) => h.text.trim());
    const codeBlocks = root.querySelectorAll('code, pre').map((code: any) => code.text.trim());
    const tables = root.querySelectorAll('table').length;
    const images = root.querySelectorAll('img').length;
    const links = root.querySelectorAll('a[href]').length;
    
    return {
      headings: headings.filter(h => h),
      codeBlocks: codeBlocks.filter(c => c),
      tables,
      images,
      links
    };
  } catch (error) {
    console.error('Error extracting content metadata:', error);
    return {
      headings: [],
      codeBlocks: [],
      tables: 0,
      images: 0,
      links: 0
    };
  }
} 