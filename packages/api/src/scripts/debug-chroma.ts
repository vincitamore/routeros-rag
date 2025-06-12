import fetch from 'node-fetch';
import { ChromaClient } from 'chromadb';

console.log('🔍 ChromaDB Connection Debugging Script');
console.log('=====================================\n');

async function testRestAPI() {
    console.log('1. Testing REST API with fetch...');
    
    const urls = [
        'http://127.0.0.1:8000/api/v1/heartbeat',
        'http://localhost:8000/api/v1/heartbeat',
        'http://100.123.183.144:8000/api/v1/heartbeat'
    ];
    
    for (const url of urls) {
        try {
            console.log(`   Testing: ${url}`);
            const response = await fetch(url, { timeout: 5000 });
            const data = await response.json();
            console.log(`   ✅ Success: ${JSON.stringify(data)}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${(error as Error).message}`);
        }
    }
    console.log();
}

async function testChromaClientDeprecatedAPI() {
    console.log('2. Testing ChromaClient with deprecated "path" API...');
    
    const urls = [
        'http://127.0.0.1:8000',
        'http://localhost:8000',
        'http://100.123.183.144:8000'
    ];
    
    for (const url of urls) {
        try {
            console.log(`   Testing: ${url}`);
            const client = new ChromaClient({ path: url });
            const heartbeat = await client.heartbeat();
            console.log(`   ✅ Success: ${JSON.stringify(heartbeat)}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${(error as Error).message}`);
        }
    }
    console.log();
}

async function testChromaClientModernAPI() {
    console.log('3. Testing ChromaClient with modern host/port API...');
    
    const configs = [
        { host: '127.0.0.1', port: 8000 },
        { host: 'localhost', port: 8000 },
        { host: '100.123.183.144', port: 8000 }
    ];
    
    for (const config of configs) {
        try {
            console.log(`   Testing: ${config.host}:${config.port}`);
            const client = new ChromaClient({ 
                host: config.host, 
                port: config.port 
            });
            const heartbeat = await client.heartbeat();
            console.log(`   ✅ Success: ${JSON.stringify(heartbeat)}`);
        } catch (error) {
            console.log(`   ❌ Failed: ${(error as Error).message}`);
        }
    }
    console.log();
}

async function testCollectionOperations() {
    console.log('4. Testing collection operations...');
    
    try {
        // Use the approach that worked from previous tests
        const client = new ChromaClient({ host: '127.0.0.1', port: 8000 });
        
        console.log('   Testing heartbeat...');
        await client.heartbeat();
        console.log('   ✅ Heartbeat successful');
        
        console.log('   Testing list collections...');
        const collections = await client.listCollections();
        console.log(`   ✅ Found ${collections.length} collections`);
        
        console.log('   Testing create collection...');
        const testCollection = await client.createCollection({ 
            name: 'debug_test_collection' 
        });
        console.log('   ✅ Collection created successfully');
        
        console.log('   Testing delete collection...');
        await client.deleteCollection({ name: 'debug_test_collection' });
        console.log('   ✅ Collection deleted successfully');
        
    } catch (error) {
        console.log(`   ❌ Collection operations failed: ${(error as Error).message}`);
    }
    console.log();
}

async function main() {
    try {
        await testRestAPI();
        await testChromaClientDeprecatedAPI();
        await testChromaClientModernAPI();
        await testCollectionOperations();
        
        console.log('🎉 Debugging complete!');
    } catch (error) {
        console.error('💥 Debugging script failed:', error);
    }
}

main(); 