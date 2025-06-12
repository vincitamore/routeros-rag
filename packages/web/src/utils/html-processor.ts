import DOMPurify from 'dompurify';

// Configuration for DOMPurify to allow safe HTML elements
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'b', 'i', 'u',
    'div', 'span',
    'dl', 'dt', 'dd'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'width', 'height', 'style',
    'target', 'rel'
  ],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true
};

/**
 * Process HTML content for safe rendering
 */
export function processHtmlContent(htmlContent: string, images: string[] = []): string {
  if (!htmlContent) return '';
  
  // First, process relative image paths
  let processedHtml = processImagePaths(htmlContent, images);
  
  // Remove Confluence-specific navigation and UI elements
  processedHtml = removeNavigationElements(processedHtml);
  
  // Sanitize the HTML
  const sanitizedHtml = DOMPurify.sanitize(processedHtml, PURIFY_CONFIG);
  
  return sanitizedHtml;
}

/**
 * Convert relative image paths to use our asset API
 */
function processImagePaths(html: string, images: string[]): string {
  return html.replace(/src="([^"]+)"/g, (match, src) => {
    // Skip if already absolute URL
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/api/')) {
      return match;
    }
    
    // Convert relative paths to use our asset API
    if (src.startsWith('./') || src.startsWith('../') || !src.startsWith('/')) {
      // Clean up the path
      const cleanPath = src.replace(/^\.\//, '').replace(/^\//, '');
      return `src="/api/assets/${cleanPath}"`;
    }
    
    return match;
  });
}

/**
 * Remove Confluence navigation and UI elements
 */
function removeNavigationElements(html: string): string {
  // Create a temporary DOM to process
  if (typeof window === 'undefined') {
    // Server-side: use simple regex replacements
    return html
      .replace(/<div[^>]*class="[^"]*navigation[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*header[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*footer[^"]*"[^>]*>.*?<\/div>/gi, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gi, '')
      .replace(/<aside[^>]*>.*?<\/aside>/gi, '');
  }
  
  // Client-side: use DOM manipulation
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove navigation elements
  const selectorsToRemove = [
    '.navigation',
    '.breadcrumb',
    '.header',
    '.footer',
    'nav',
    'aside',
    '.confluence-navigation',
    '.page-metadata',
    '.page-restrictions'
  ];
  
  selectorsToRemove.forEach(selector => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  return doc.body.innerHTML;
}

/**
 * Extract clean text content from HTML for search/preview
 */
export function extractTextContent(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: simple regex approach
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Client-side: use DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * Check if content is HTML or markdown
 */
export function isHtmlContent(content: string): boolean {
  return content.includes('<') && content.includes('>');
} 