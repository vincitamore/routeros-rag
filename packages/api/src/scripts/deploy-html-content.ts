import { readFile, writeFile, copyFile, access } from 'fs/promises';
import { join } from 'path';

async function deployHtmlContent() {
  try {
    console.log('🚀 Starting HTML content deployment...');
    
    const originalPath = join(process.cwd(), 'processed_content.json');
    const enhancedPath = join(process.cwd(), 'processed_content_with_html.json');
    const backupPath = join(process.cwd(), `processed_content_backup_${Date.now()}.json`);
    
    // Step 1: Verify enhanced content exists and is valid
    console.log('📋 Verifying enhanced content...');
    try {
      await access(enhancedPath);
      const enhancedRaw = await readFile(enhancedPath, 'utf-8');
      const enhanced = JSON.parse(enhancedRaw);
      console.log(`✅ Enhanced content verified: ${Object.keys(enhanced).length} nodes`);
    } catch (error) {
      throw new Error(`Enhanced content validation failed: ${(error as Error).message}`);
    }
    
    // Step 2: Create backup of original
    console.log('💾 Creating backup of original content...');
    await copyFile(originalPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    
    // Step 3: Replace original with enhanced version
    console.log('🔄 Deploying enhanced content...');
    await copyFile(enhancedPath, originalPath);
    console.log('✅ Enhanced content deployed successfully!');
    
    // Step 4: Verify deployment
    console.log('🔍 Verifying deployment...');
    const deployedRaw = await readFile(originalPath, 'utf-8');
    const deployed = JSON.parse(deployedRaw);
    
    let htmlEnhancedCount = 0;
    let imagesCount = 0;
    let attachmentsCount = 0;
    
    for (const node of Object.values(deployed) as any[]) {
      if (node.html_file_path) htmlEnhancedCount++;
      if (node.images?.length > 0) imagesCount++;
      if (node.attachments?.length > 0) attachmentsCount++;
    }
    
    console.log('\n📊 Deployment Verification:');
    console.log(`   Total nodes: ${Object.keys(deployed).length}`);
    console.log(`   HTML-enhanced: ${htmlEnhancedCount}`);
    console.log(`   With images: ${imagesCount}`);
    console.log(`   With attachments: ${attachmentsCount}`);
    
    console.log('\n🎉 Deployment complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Restart your application server');
    console.log('   2. Test the enhanced content in your web app');
    console.log('   3. Verify image and attachment rendering');
    console.log(`   4. Backup location: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Deployment failed:', (error as Error).message);
    console.error('\n🔧 Recovery instructions:');
    console.error('   1. Check the backup file if deployment partially completed');
    console.error('   2. Restore from backup if needed');
    console.error('   3. Check file permissions and disk space');
    process.exit(1);
  }
}

async function rollbackDeployment(backupPath?: string) {
  try {
    if (!backupPath) {
      console.error('❌ Backup path required for rollback');
      process.exit(1);
    }
    
    console.log('🔄 Rolling back deployment...');
    
    const originalPath = join(process.cwd(), 'processed_content.json');
    await copyFile(backupPath, originalPath);
    
    console.log('✅ Rollback complete!');
    console.log('   Original content restored from backup');
    
  } catch (error) {
    console.error('❌ Rollback failed:', (error as Error).message);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];
const backupPath = process.argv[3];

if (command === 'deploy') {
  deployHtmlContent().catch(console.error);
} else if (command === 'rollback') {
  rollbackDeployment(backupPath).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  Deploy: npx ts-node deploy-html-content.ts deploy');
  console.log('  Rollback: npx ts-node deploy-html-content.ts rollback <backup-file>');
} 