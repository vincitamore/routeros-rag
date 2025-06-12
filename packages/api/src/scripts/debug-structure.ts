import { readFile } from 'fs/promises';

/**
 * Debug script to understand the structure of processed_content.json
 */
async function debugStructure() {
  console.log('🔍 Debugging processed content structure...');
  
  const content = await readFile('./processed_content.json', 'utf-8');
  const data = JSON.parse(content);
  
  console.log('Root level keys:', Object.keys(data));
  console.log('\nRouterOS structure:');
  
  if (data.routeros) {
    console.log('RouterOS keys:', Object.keys(data.routeros));
    
    // Let's look at the first few levels
    const printStructure = (obj: any, prefix: string = '', level: number = 0) => {
      if (level > 3) return; // Limit depth
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          const nodeValue = value as any;
          if (nodeValue.title && nodeValue.level) {
            console.log(`${prefix}${key}: "${nodeValue.title}" (level ${nodeValue.level})`);
            
            // Check for nested content
            const nestedKeys = Object.keys(nodeValue).filter(k => 
              k !== 'title' && k !== 'level' && k !== 'parentKey' && 
              k !== 'status' && k !== 'content_raw' && k !== 'content_processed' && 
              k !== 'tags' && k !== 'error_message' && k !== 'chunks'
            );
            
            if (nestedKeys.length > 0) {
              for (const nestedKey of nestedKeys.slice(0, 3)) { // Show first 3
                const nestedValue = nodeValue[nestedKey];
                if (typeof nestedValue === 'object' && nestedValue !== null && nestedValue.title) {
                  console.log(`${prefix}  ${nestedKey}: "${nestedValue.title}" (level ${nestedValue.level})`);
                }
              }
              if (nestedKeys.length > 3) {
                console.log(`${prefix}  ... and ${nestedKeys.length - 3} more`);
              }
            }
          }
        }
      }
    };
    
    printStructure(data.routeros, '  ');
  }
  
  // Test key lookup
  console.log('\n🔍 Testing specific key lookup:');
  const testKey = 'routeros/firewall-and-quality-of-service/queues/queue-types/pfifobfifo';
  console.log(`Looking for: ${testKey}`);
  
  const findNode = (obj: any, targetKey: string, currentPath: string = ''): any => {
    if (typeof obj !== 'object' || obj === null) return null;
    
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}/${key}` : key;
      
      if (newPath === targetKey) {
        return value;
      }
      
      if (typeof value === 'object' && value !== null) {
        const found = findNode(value, targetKey, newPath);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  const foundNode = findNode(data, testKey);
  if (foundNode) {
    console.log('✅ Found node:', foundNode.title);
  } else {
    console.log('❌ Node not found');
    
    // Let's see what keys are available at each level
    const keyParts = testKey.split('/');
    let currentObj: any = data;
    let currentPath = '';
    
    for (const part of keyParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      console.log(`\nLooking for part: "${part}" at path: "${currentPath}"`);
      
      if (currentObj && typeof currentObj === 'object') {
        const availableKeys = Object.keys(currentObj);
        console.log(`Available keys: ${availableKeys.slice(0, 10).join(', ')}${availableKeys.length > 10 ? '...' : ''}`);
        
        if (currentObj[part]) {
          currentObj = currentObj[part];
          console.log(`✅ Found part: "${part}"`);
        } else {
          console.log(`❌ Part not found: "${part}"`);
          break;
        }
      }
    }
  }
}

if (require.main === module) {
  debugStructure().catch(console.error);
} 