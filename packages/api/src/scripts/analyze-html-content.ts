import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { parse, HTMLElement } from 'node-html-parser';

export interface HtmlFileInfo {
  filePath: string;
  fileName: string;
  title: string;
  extractedText: string;
  imageReferences: string[];
  attachments: string[];
  hierarchy: string[];
  estimatedTokens: number;
  fileSize: number;
  lastModified: Date;
}

export interface AnalysisResult {
  totalFiles: number;
  htmlFiles: HtmlFileInfo[];
  imageFiles: string[];
  attachmentDirs: string[];
  summary: {
    totalHtmlFiles: number;
    totalImages: number;
    totalAttachmentDirs: number;
    averageFileSize: number;
    estimatedTotalTokens: number;
  };
}

/**
 * Extract title from HTML content using priority order:
 * 1. <title> tag content (cleaned)
 * 2. First <h1> tag
 * 3. First <h2> tag if h1 is generic
 * 4. File name as fallback
 */
function extractTitle(htmlContent: string, fileName: string): string {
  const root = parse(htmlContent);
  
  // Try title tag first
  const titleElement = root.querySelector('title');
  if (titleElement) {
    let title = titleElement.text.trim();
    // Clean common prefixes
    title = title.replace(/^RouterOS\s*:\s*/i, '');
    title = title.replace(/^MikroTik\s*-?\s*/i, '');
    if (title && title.length > 0) {
      return title;
    }
  }
  
  // Try h1 tag
  const h1Element = root.querySelector('h1');
  if (h1Element) {
    let title = h1Element.text.trim();
    title = title.replace(/^RouterOS\s*:\s*/i, '');
    if (title && title.length > 2) {
      return title;
    }
  }
  
  // Try h2 tag
  const h2Element = root.querySelector('h2');
  if (h2Element) {
    let title = h2Element.text.trim();
    if (title && title.length > 2) {
      return title;
    }
  }
  
  // Fallback to filename without extension
  return fileName.replace(/\.(html|htm)$/i, '').replace(/[_-]/g, ' ');
}

/**
 * Extract breadcrumb hierarchy from HTML
 */
function extractHierarchy(htmlContent: string): string[] {
  const root = parse(htmlContent);
  const breadcrumbs = root.querySelector('#breadcrumbs');
  
  if (breadcrumbs) {
    const links = breadcrumbs.querySelectorAll('a');
    return links.map((link: HTMLElement) => link.text.trim()).filter((text: string) => text.length > 0);
  }
  
  return [];
}

/**
 * Extract image references from HTML
 */
function extractImageReferences(htmlContent: string): string[] {
  const root = parse(htmlContent);
  const images = root.querySelectorAll('img');
  
  return images.map((img: HTMLElement) => {
    const src = img.getAttribute('src');
    return src ? src.trim() : '';
  }).filter((src: string) => src.length > 0);
}

/**
 * Extract clean text from HTML for token estimation
 */
function extractCleanText(htmlContent: string): string {
  const root = parse(htmlContent);
  
  // Remove script and style elements
  root.querySelectorAll('script, style').forEach((el: HTMLElement) => el.remove());
  
  // Get text content
  const text = root.text;
  
  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Estimate token count (rough approximation: ~4 characters per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Recursively scan directory for HTML files
 */
async function scanDirectory(dirPath: string, basePath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Skip attachments, images, styles directories for HTML files
        if (!['attachments', 'images', 'styles'].includes(entry)) {
          const subFiles = await scanDirectory(fullPath, basePath);
          files.push(...subFiles);
        }
      } else if (stats.isFile() && entry.toLowerCase().endsWith('.html')) {
        files.push(relative(basePath, fullPath));
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * Analyze a single HTML file
 */
async function analyzeHtmlFile(filePath: string, rosPath: string): Promise<HtmlFileInfo> {
  const fullPath = join(rosPath, filePath);
  const fileName = filePath.split('/').pop() || filePath;
  
  try {
    const [content, stats] = await Promise.all([
      readFile(fullPath, 'utf-8'),
      stat(fullPath)
    ]);
    
    const title = extractTitle(content, fileName);
    const hierarchy = extractHierarchy(content);
    const imageReferences = extractImageReferences(content);
    const extractedText = extractCleanText(content);
    const estimatedTokens = estimateTokens(extractedText);
    
    // Find potential attachment references
    const attachments: string[] = [];
    const attachmentMatches = content.match(/attachments\/(\d+)/g);
    if (attachmentMatches) {
      attachments.push(...attachmentMatches.map(match => match.replace('attachments/', '')));
    }
    
    return {
      filePath,
      fileName,
      title,
      extractedText,
      imageReferences,
      attachments: [...new Set(attachments)], // Remove duplicates
      hierarchy,
      estimatedTokens,
      fileSize: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    return {
      filePath,
      fileName,
      title: fileName.replace(/\.(html|htm)$/i, ''),
      extractedText: '',
      imageReferences: [],
      attachments: [],
      hierarchy: [],
      estimatedTokens: 0,
      fileSize: 0,
      lastModified: new Date()
    };
  }
}

/**
 * Get list of attachment directories
 */
async function getAttachmentDirectories(rosPath: string): Promise<string[]> {
  const attachmentsPath = join(rosPath, 'attachments');
  try {
    const entries = await readdir(attachmentsPath);
    const dirs: string[] = [];
    
    for (const entry of entries) {
      const fullPath = join(attachmentsPath, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        dirs.push(entry);
      }
    }
    
    return dirs;
  } catch (error) {
    console.error('Error reading attachments directory:', error);
    return [];
  }
}

/**
 * Get list of image files
 */
async function getImageFiles(rosPath: string): Promise<string[]> {
  const imagesPath = join(rosPath, 'images');
  const imageFiles: string[] = [];
  
  try {
    const scanImages = async (dirPath: string, basePath: string): Promise<void> => {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanImages(fullPath, basePath);
        } else if (stats.isFile() && /\.(png|jpg|jpeg|gif|svg|ico)$/i.test(entry)) {
          imageFiles.push(relative(basePath, fullPath));
        }
      }
    };
    
    await scanImages(imagesPath, rosPath);
  } catch (error) {
    console.error('Error reading images directory:', error);
  }
  
  return imageFiles;
}

/**
 * Main analysis function
 */
export async function analyzeHtmlContent(rosPath: string = './ROS'): Promise<AnalysisResult> {
  console.log('🔍 Starting HTML content analysis...');
  
  // Scan for HTML files
  console.log('📄 Scanning for HTML files...');
  const htmlFilePaths = await scanDirectory(rosPath, rosPath);
  console.log(`Found ${htmlFilePaths.length} HTML files`);
  
  // Analyze each HTML file
  console.log('🔬 Analyzing HTML files...');
  const htmlFiles: HtmlFileInfo[] = [];
  
  for (let i = 0; i < htmlFilePaths.length; i++) {
    const filePath = htmlFilePaths[i];
    if (i % 10 === 0) {
      console.log(`Analyzing file ${i + 1}/${htmlFilePaths.length}: ${filePath}`);
    }
    
    const fileInfo = await analyzeHtmlFile(filePath, rosPath);
    htmlFiles.push(fileInfo);
  }
  
  // Get attachment directories
  console.log('📎 Scanning attachment directories...');
  const attachmentDirs = await getAttachmentDirectories(rosPath);
  console.log(`Found ${attachmentDirs.length} attachment directories`);
  
  // Get image files
  console.log('🖼️ Scanning image files...');
  const imageFiles = await getImageFiles(rosPath);
  console.log(`Found ${imageFiles.length} image files`);
  
  // Calculate summary statistics
  const totalFileSize = htmlFiles.reduce((sum, file) => sum + file.fileSize, 0);
  const totalTokens = htmlFiles.reduce((sum, file) => sum + file.estimatedTokens, 0);
  
  const result: AnalysisResult = {
    totalFiles: htmlFilePaths.length,
    htmlFiles,
    imageFiles,
    attachmentDirs,
    summary: {
      totalHtmlFiles: htmlFiles.length,
      totalImages: imageFiles.length,
      totalAttachmentDirs: attachmentDirs.length,
      averageFileSize: htmlFiles.length > 0 ? Math.round(totalFileSize / htmlFiles.length) : 0,
      estimatedTotalTokens: totalTokens
    }
  };
  
  console.log('✅ Analysis complete!');
  console.log(`📊 Summary:
  - HTML Files: ${result.summary.totalHtmlFiles}
  - Image Files: ${result.summary.totalImages}  
  - Attachment Dirs: ${result.summary.totalAttachmentDirs}
  - Average File Size: ${(result.summary.averageFileSize / 1024).toFixed(1)} KB
  - Estimated Total Tokens: ${result.summary.estimatedTotalTokens.toLocaleString()}`);
  
  return result;
}

// CLI execution
if (require.main === module) {
  const rosPath = process.argv[2] || './ROS';
  
  analyzeHtmlContent(rosPath)
    .then(result => {
      console.log('\n💾 Saving analysis results...');
      const outputPath = './html-analysis-results.json';
      return import('fs/promises').then(fs => 
        fs.writeFile(outputPath, JSON.stringify(result, null, 2))
      ).then(() => {
        console.log(`✅ Results saved to ${outputPath}`);
      });
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
} 