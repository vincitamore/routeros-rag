import { readFile } from 'fs/promises';
import { AnalysisResult, HtmlFileInfo } from './analyze-html-content';

interface TitleFrequency {
  [key: string]: number;
}

interface CategorySummary {
  category: string;
  fileCount: number;
  totalTokens: number;
  averageFileSize: number;
  sampleFiles: string[];
}

async function summarizeAnalysis(resultsPath: string = './html-analysis-results.json') {
  try {
    const content = await readFile(resultsPath, 'utf-8');
    const results: AnalysisResult = JSON.parse(content);
    
    console.log('📊 HTML Content Analysis Summary\n');
    console.log(`Total Files Analyzed: ${results.summary.totalHtmlFiles}`);
    console.log(`Total Estimated Tokens: ${results.summary.estimatedTotalTokens.toLocaleString()}`);
    console.log(`Average File Size: ${(results.summary.averageFileSize / 1024).toFixed(1)} KB`);
    console.log(`Total Images: ${results.summary.totalImages}`);
    console.log(`Total Attachment Directories: ${results.summary.totalAttachmentDirs}\n`);
    
    // Analyze titles for patterns
    console.log('🏷️ Title Analysis:');
    const titleKeywords: TitleFrequency = {};
    
    results.htmlFiles.forEach(file => {
      const words = file.title.toLowerCase().split(/[\s\-_]+/);
      words.forEach(word => {
        if (word.length > 3) {
          titleKeywords[word] = (titleKeywords[word] || 0) + 1;
        }
      });
    });
    
    const topKeywords = Object.entries(titleKeywords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);
    
    console.log('Top Keywords in Titles:');
    topKeywords.forEach(([word, count]) => {
      console.log(`  ${word}: ${count} files`);
    });
    
    // Analyze hierarchy patterns
    console.log('\n🗂️ Hierarchy Analysis:');
    const hierarchyPatterns: TitleFrequency = {};
    
    results.htmlFiles.forEach(file => {
      if (file.hierarchy.length > 0) {
        const pattern = file.hierarchy.join(' > ');
        hierarchyPatterns[pattern] = (hierarchyPatterns[pattern] || 0) + 1;
      }
    });
    
    const topHierarchies = Object.entries(hierarchyPatterns)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    console.log('Top Hierarchy Patterns:');
    topHierarchies.forEach(([pattern, count]) => {
      console.log(`  ${pattern} (${count} files)`);
    });
    
    // Find files with most tokens (largest content)
    console.log('\n📄 Largest Content Files:');
    const largestFiles = results.htmlFiles
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
      .slice(0, 10);
    
    largestFiles.forEach(file => {
      console.log(`  ${file.title} - ${file.estimatedTokens.toLocaleString()} tokens (${(file.fileSize / 1024).toFixed(1)} KB)`);
    });
    
    // Analyze files by category based on titles and hierarchy
    console.log('\n📁 Category Analysis:');
    const categories: { [key: string]: HtmlFileInfo[] } = {
      'Wireless': [],
      'Firewall': [],
      'Container': [],
      'Hardware': [],
      'Network': [],
      'Security': [],
      'Configuration': [],
      'Monitoring': [],
      'Other': []
    };
    
    results.htmlFiles.forEach(file => {
      const titleLower = file.title.toLowerCase();
      const hierarchyText = file.hierarchy.join(' ').toLowerCase();
      const searchText = `${titleLower} ${hierarchyText}`;
      
      if (searchText.includes('wireless') || searchText.includes('wifi') || searchText.includes('wlan')) {
        categories['Wireless'].push(file);
      } else if (searchText.includes('firewall') || searchText.includes('nat') || searchText.includes('filter')) {
        categories['Firewall'].push(file);
      } else if (searchText.includes('container') || searchText.includes('docker')) {
        categories['Container'].push(file);
      } else if (searchText.includes('hardware') || searchText.includes('routerboard') || searchText.includes('led') || searchText.includes('ports')) {
        categories['Hardware'].push(file);
      } else if (searchText.includes('network') || searchText.includes('routing') || searchText.includes('bridge') || searchText.includes('vlan') || searchText.includes('interface')) {
        categories['Network'].push(file);
      } else if (searchText.includes('security') || searchText.includes('certificate') || searchText.includes('encryption') || searchText.includes('vpn')) {
        categories['Security'].push(file);
      } else if (searchText.includes('config') || searchText.includes('setup') || searchText.includes('install')) {
        categories['Configuration'].push(file);
      } else if (searchText.includes('monitor') || searchText.includes('log') || searchText.includes('graph') || searchText.includes('health') || searchText.includes('snmp')) {
        categories['Monitoring'].push(file);
      } else {
        categories['Other'].push(file);
      }
    });
    
    Object.entries(categories).forEach(([category, files]) => {
      if (files.length > 0) {
        const totalTokens = files.reduce((sum, f) => sum + f.estimatedTokens, 0);
        const avgSize = files.reduce((sum, f) => sum + f.fileSize, 0) / files.length;
        
        console.log(`  ${category}: ${files.length} files, ${totalTokens.toLocaleString()} tokens, avg ${(avgSize / 1024).toFixed(1)} KB`);
        
        // Show top 3 files in each category
        const topFiles = files
          .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
          .slice(0, 3);
        
        topFiles.forEach(file => {
          console.log(`    - ${file.title} (${file.estimatedTokens.toLocaleString()} tokens)`);
        });
      }
    });
    
    // Analyze files with attachments
    console.log('\n📎 Files with Attachments:');
    const filesWithAttachments = results.htmlFiles.filter(f => f.attachments.length > 0);
    console.log(`Files with attachments: ${filesWithAttachments.length}`);
    
    const topAttachmentFiles = filesWithAttachments
      .sort((a, b) => b.attachments.length - a.attachments.length)
      .slice(0, 5);
    
    topAttachmentFiles.forEach(file => {
      console.log(`  ${file.title} - ${file.attachments.length} attachments`);
    });
    
    // Analyze numbered vs named files
    console.log('\n🔢 File Naming Analysis:');
    const numberedFiles = results.htmlFiles.filter(f => /^\d+\.html$/.test(f.fileName));
    const namedFiles = results.htmlFiles.filter(f => !/^\d+\.html$/.test(f.fileName));
    
    console.log(`Numbered files (e.g., 123456.html): ${numberedFiles.length}`);
    console.log(`Named files (e.g., Container_84901929.html): ${namedFiles.length}`);
    
    if (numberedFiles.length > 0) {
      console.log('\nSample numbered files:');
      numberedFiles.slice(0, 5).forEach(file => {
        console.log(`  ${file.fileName} -> "${file.title}"`);
      });
    }
    
  } catch (error) {
    console.error('Error reading analysis results:', error);
  }
}

// CLI execution
if (require.main === module) {
  const resultsPath = process.argv[2] || './html-analysis-results.json';
  
  summarizeAnalysis(resultsPath)
    .catch(error => {
      console.error('❌ Summary failed:', error);
      process.exit(1);
    });
} 