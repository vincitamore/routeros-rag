#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../processed_content.json');
const BACKUP_FILE = path.resolve(__dirname, '../processed_content_backup.json');
const OUTPUT_FILE = INPUT_FILE; // Overwrite the original file

console.log('🧹 RouterOS Content Cleanup Script');
console.log('=====================================');

async function cleanupContent() {
    try {
        // Check if file exists
        if (!fs.existsSync(INPUT_FILE)) {
            console.error(`❌ Error: ${INPUT_FILE} not found`);
            process.exit(1);
        }

        // Get original file size
        const originalStats = fs.statSync(INPUT_FILE);
        const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);
        console.log(`📄 Original file size: ${originalSizeMB} MB`);

        // Create backup first
        console.log('💾 Creating backup...');
        fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
        console.log(`✅ Backup created: processed_content_backup.json`);

        // Read and parse the JSON file
        console.log('📖 Reading processed_content.json...');
        const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
        
        console.log('🔄 Parsing JSON...');
        const processedContent = JSON.parse(fileContent);

        // Count objects and track what we're removing
        const totalObjects = Object.keys(processedContent).length;
        let objectsWithContentRaw = 0;
        let objectsWithContentProcessed = 0;
        let chunksRemoved = 0;

        console.log(`📊 Found ${totalObjects} total objects`);
        console.log('🧹 Cleaning up objects...');

        // Clean up each object
        Object.keys(processedContent).forEach((key, index) => {
            const obj = processedContent[key];
            
            // Remove content_raw if it exists
            if (obj.hasOwnProperty('content_raw')) {
                delete obj.content_raw;
                objectsWithContentRaw++;
            }
            
            // Remove content_processed if it exists
            if (obj.hasOwnProperty('content_processed')) {
                delete obj.content_processed;
                objectsWithContentProcessed++;
            }
            
            // Also clean up chunks if they exist and have these fields
            if (obj.chunks && Array.isArray(obj.chunks)) {
                obj.chunks.forEach(chunk => {
                    if (chunk.hasOwnProperty('content_raw')) {
                        delete chunk.content_raw;
                        chunksRemoved++;
                    }
                    if (chunk.hasOwnProperty('content_processed')) {
                        delete chunk.content_processed;
                        chunksRemoved++;
                    }
                });
            }

            // Progress indicator
            if ((index + 1) % 100 === 0) {
                process.stdout.write(`\r   Progress: ${index + 1}/${totalObjects} objects processed`);
            }
        });

        console.log(`\n✅ Cleanup complete!`);
        console.log(`   - Removed content_raw from ${objectsWithContentRaw} objects`);
        console.log(`   - Removed content_processed from ${objectsWithContentProcessed} objects`);
        console.log(`   - Removed ${chunksRemoved} chunk content fields`);

        // Write the cleaned content back to file
        console.log('💾 Writing cleaned content to file...');
        const cleanedJson = JSON.stringify(processedContent, null, 2);
        fs.writeFileSync(OUTPUT_FILE, cleanedJson, 'utf-8');

        // Get new file size
        const newStats = fs.statSync(OUTPUT_FILE);
        const newSizeMB = (newStats.size / (1024 * 1024)).toFixed(2);
        const reduction = ((originalStats.size - newStats.size) / originalStats.size * 100).toFixed(1);

        console.log('📈 Size reduction summary:');
        console.log(`   - Original size: ${originalSizeMB} MB`);
        console.log(`   - New size: ${newSizeMB} MB`);
        console.log(`   - Reduction: ${reduction}% (${(originalSizeMB - newSizeMB).toFixed(2)} MB saved)`);

        if (newStats.size < 100 * 1024 * 1024) { // Less than 100MB
            console.log('🎉 File is now under GitHub\'s 100MB limit!');
        } else {
            console.log('⚠️  File is still over 100MB - you may need Git LFS or further cleanup');
        }

        console.log('\n✅ Cleanup script completed successfully!');
        console.log(`💾 Backup saved as: processed_content_backup.json`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    }
}

// Run the cleanup
cleanupContent(); 