import { readFile } from 'fs/promises';
import { HtmlFileInfo, AnalysisResult } from '../scripts/analyze-html-content';

export interface OutlineNode {
  title: string;
  level: number;
  parentKey: string;
  status: string;
  [key: string]: any;
}

export interface ContentMapping {
  htmlFile: HtmlFileInfo;
  outlineKey: string;
  outlineTitle: string;
  confidence: number;
  matchReasons: string[];
  suggested: boolean;
}

export interface MappingResult {
  mappings: ContentMapping[];
  unmappedHtml: HtmlFileInfo[];
  unmappedOutline: string[];
  statistics: {
    totalHtmlFiles: number;
    totalOutlineNodes: number;
    highConfidenceMappings: number;
    mediumConfidenceMappings: number;
    lowConfidenceMappings: number;
    unmappedHtmlCount: number;
    unmappedOutlineCount: number;
  };
}

/**
 * Calculate similarity between two strings using a combination of methods
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // After normalization (remove special chars, extra spaces)
  const normalize = (s: string) => s.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  
  if (n1 === n2) return 0.95;
  
  // Calculate Levenshtein distance based similarity
  const levenshteinSimilarity = 1 - (levenshteinDistance(n1, n2) / Math.max(n1.length, n2.length));
  
  // Calculate word overlap similarity
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  const wordOverlap = calculateWordOverlap(words1, words2);
  
  // Calculate substring similarity
  const substringSimilarity = calculateSubstringSimilarity(n1, n2);
  
  // Weighted combination
  return (levenshteinSimilarity * 0.4) + (wordOverlap * 0.4) + (substringSimilarity * 0.2);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate word overlap similarity
 */
function calculateWordOverlap(words1: string[], words2: string[]): number {
  const set1 = new Set(words1.filter(w => w.length > 2));
  const set2 = new Set(words2.filter(w => w.length > 2));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate substring similarity
 */
function calculateSubstringSimilarity(str1: string, str2: string): number {
  const shorter = str1.length < str2.length ? str1 : str2;
  const longer = str1.length >= str2.length ? str1 : str2;
  
  if (longer.includes(shorter)) return 0.8;
  
  // Find longest common substring
  let longestSubstring = 0;
  for (let i = 0; i < shorter.length; i++) {
    for (let j = i + 3; j <= shorter.length; j++) {
      const substring = shorter.substring(i, j);
      if (longer.includes(substring)) {
        longestSubstring = Math.max(longestSubstring, substring.length);
      }
    }
  }
  
  return longestSubstring / Math.max(str1.length, str2.length);
}

/**
 * Extract outline nodes from processed content recursively
 */
function extractOutlineNodes(obj: any, nodes: { [key: string]: OutlineNode } = {}, currentKey: string = ''): { [key: string]: OutlineNode } {
  if (typeof obj !== 'object' || obj === null) return nodes;
  
  // Check if this object is an outline node
  if (obj.title && typeof obj.level === 'number') {
    nodes[currentKey] = {
      title: obj.title,
      level: obj.level,
      parentKey: obj.parentKey || '',
      status: obj.status || '',
      ...obj
    };
  }
  
  // Recursively process all properties
  for (const [key, value] of Object.entries(obj)) {
    if (key !== 'title' && key !== 'level' && key !== 'parentKey' && 
        key !== 'status' && key !== 'content_raw' && key !== 'content_processed' && 
        key !== 'tags' && key !== 'error_message' && key !== 'chunks' && typeof value === 'object') {
      const childKey = currentKey ? `${currentKey}/${key}` : key;
      extractOutlineNodes(value, nodes, childKey);
    }
  }
  
  return nodes;
}

/**
 * Find potential matches for an HTML file
 */
function findMatches(htmlFile: HtmlFileInfo, outlineNodes: { [key: string]: OutlineNode }): ContentMapping[] {
  const matches: ContentMapping[] = [];
  
  for (const [outlineKey, outlineNode] of Object.entries(outlineNodes)) {
    const titleSimilarity = calculateSimilarity(htmlFile.title, outlineNode.title);
    const hierarchySimilarity = calculateHierarchySimilarity(htmlFile.hierarchy, outlineKey);
    
    // Calculate overall confidence
    let confidence = (titleSimilarity * 0.7) + (hierarchySimilarity * 0.3);
    
    const matchReasons: string[] = [];
    
    // Boost confidence for exact or near-exact title matches
    if (titleSimilarity > 0.9) {
      confidence = Math.min(confidence + 0.1, 1.0);
      matchReasons.push(`High title similarity (${(titleSimilarity * 100).toFixed(1)}%)`);
    } else if (titleSimilarity > 0.7) {
      matchReasons.push(`Good title similarity (${(titleSimilarity * 100).toFixed(1)}%)`);
    }
    
    // Boost confidence for hierarchy matches
    if (hierarchySimilarity > 0.5) {
      matchReasons.push(`Hierarchy match (${(hierarchySimilarity * 100).toFixed(1)}%)`);
    }
    
    // Check for keyword matches
    const keywordMatch = checkKeywordMatch(htmlFile, outlineNode);
    if (keywordMatch.score > 0) {
      confidence = Math.min(confidence + (keywordMatch.score * 0.1), 1.0);
      matchReasons.push(`Keyword match: ${keywordMatch.keywords.join(', ')}`);
    }
    
    // Only consider matches with reasonable confidence
    if (confidence > 0.3) {
      matches.push({
        htmlFile,
        outlineKey,
        outlineTitle: outlineNode.title,
        confidence,
        matchReasons,
        suggested: confidence > 0.7
      });
    }
  }
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate hierarchy similarity
 */
function calculateHierarchySimilarity(htmlHierarchy: string[], outlineKey: string): number {
  if (htmlHierarchy.length === 0) return 0;
  
  const outlineHierarchy = outlineKey.split('/');
  const htmlKeywords = htmlHierarchy.join(' ').toLowerCase();
  const outlineKeywords = outlineHierarchy.join(' ').toLowerCase();
  
  return calculateSimilarity(htmlKeywords, outlineKeywords);
}

/**
 * Check for keyword matches between HTML file and outline node
 */
function checkKeywordMatch(htmlFile: HtmlFileInfo, outlineNode: OutlineNode): { score: number; keywords: string[] } {
  const htmlText = `${htmlFile.title} ${htmlFile.hierarchy.join(' ')}`.toLowerCase();
  const outlineText = `${outlineNode.title}`.toLowerCase();
  
  const commonKeywords = [
    'wireless', 'wifi', 'firewall', 'container', 'routing', 'vpn', 'security',
    'bridge', 'vlan', 'dhcp', 'dns', 'nat', 'ipsec', 'ospf', 'bgp', 'rip',
    'hardware', 'interface', 'ethernet', 'monitor', 'log', 'graph', 'snmp',
    'certificate', 'hotspot', 'capsman', 'configuration', 'setup', 'install'
  ];
  
  const matchedKeywords: string[] = [];
  let score = 0;
  
  for (const keyword of commonKeywords) {
    if (htmlText.includes(keyword) && outlineText.includes(keyword)) {
      matchedKeywords.push(keyword);
      score += 1;
    }
  }
  
  return { score: score / commonKeywords.length, keywords: matchedKeywords };
}

/**
 * Main mapping function
 */
export async function mapHtmlToOutline(
  htmlAnalysisPath: string = './html-analysis-results.json',
  processedContentPath: string = './processed_content.json'
): Promise<MappingResult> {
  console.log('🗺️ Starting HTML to outline mapping...');
  
  // Load HTML analysis results
  console.log('📄 Loading HTML analysis results...');
  const htmlAnalysisContent = await readFile(htmlAnalysisPath, 'utf-8');
  const htmlAnalysis: AnalysisResult = JSON.parse(htmlAnalysisContent);
  
  // Load processed content outline
  console.log('📑 Loading outline structure...');
  const outlineContent = await readFile(processedContentPath, 'utf-8');
  const outlineData = JSON.parse(outlineContent);
  
  // Extract outline nodes
  console.log('🔍 Extracting outline nodes...');
  const outlineNodes = extractOutlineNodes(outlineData);
  console.log(`Found ${Object.keys(outlineNodes).length} outline nodes`);
  
  // Perform mapping
  console.log('🔗 Mapping HTML files to outline...');
  const allMappings: ContentMapping[] = [];
  const mappedHtmlFiles = new Set<string>();
  const mappedOutlineKeys = new Set<string>();
  
  for (let i = 0; i < htmlAnalysis.htmlFiles.length; i++) {
    const htmlFile = htmlAnalysis.htmlFiles[i];
    
    if (i % 50 === 0) {
      console.log(`Processing file ${i + 1}/${htmlAnalysis.htmlFiles.length}: ${htmlFile.title}`);
    }
    
    const matches = findMatches(htmlFile, outlineNodes);
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      allMappings.push(bestMatch);
      mappedHtmlFiles.add(htmlFile.filePath);
      mappedOutlineKeys.add(bestMatch.outlineKey);
    }
  }
  
  // Calculate statistics
  const unmappedHtml = htmlAnalysis.htmlFiles.filter(f => !mappedHtmlFiles.has(f.filePath));
  const unmappedOutline = Object.keys(outlineNodes).filter(k => !mappedOutlineKeys.has(k));
  
  const highConfidence = allMappings.filter(m => m.confidence >= 0.8).length;
  const mediumConfidence = allMappings.filter(m => m.confidence >= 0.5 && m.confidence < 0.8).length;
  const lowConfidence = allMappings.filter(m => m.confidence < 0.5).length;
  
  const result: MappingResult = {
    mappings: allMappings.sort((a, b) => b.confidence - a.confidence),
    unmappedHtml,
    unmappedOutline,
    statistics: {
      totalHtmlFiles: htmlAnalysis.htmlFiles.length,
      totalOutlineNodes: Object.keys(outlineNodes).length,
      highConfidenceMappings: highConfidence,
      mediumConfidenceMappings: mediumConfidence,
      lowConfidenceMappings: lowConfidence,
      unmappedHtmlCount: unmappedHtml.length,
      unmappedOutlineCount: unmappedOutline.length
    }
  };
  
  console.log('✅ Mapping complete!');
  console.log(`📊 Mapping Statistics:
  - Total HTML Files: ${result.statistics.totalHtmlFiles}
  - Total Outline Nodes: ${result.statistics.totalOutlineNodes}
  - High Confidence (≥80%): ${result.statistics.highConfidenceMappings}
  - Medium Confidence (50-79%): ${result.statistics.mediumConfidenceMappings}
  - Low Confidence (<50%): ${result.statistics.lowConfidenceMappings}
  - Unmapped HTML Files: ${result.statistics.unmappedHtmlCount}
  - Unmapped Outline Nodes: ${result.statistics.unmappedOutlineCount}`);
  
  return result;
}

// CLI execution
if (require.main === module) {
  const htmlAnalysisPath = process.argv[2] || './html-analysis-results.json';
  const processedContentPath = process.argv[3] || './processed_content.json';
  
  mapHtmlToOutline(htmlAnalysisPath, processedContentPath)
    .then(result => {
      console.log('\n💾 Saving mapping results...');
      const outputPath = './html-mapping-results.json';
      return import('fs/promises').then(fs => 
        fs.writeFile(outputPath, JSON.stringify(result, null, 2))
      ).then(() => {
        console.log(`✅ Results saved to ${outputPath}`);
        
        // Show top 10 high-confidence mappings
        console.log('\n🎯 Top High-Confidence Mappings:');
        result.mappings
          .filter(m => m.confidence >= 0.8)
          .slice(0, 10)
          .forEach(mapping => {
            console.log(`  ${mapping.confidence.toFixed(2)} - "${mapping.htmlFile.title}" → "${mapping.outlineTitle}"`);
            console.log(`    Reasons: ${mapping.matchReasons.join(', ')}`);
          });
      });
    })
    .catch(error => {
      console.error('❌ Mapping failed:', error);
      process.exit(1);
    });
} 