import fetch from 'node-fetch';

async function testQuery() {
    console.log('🧪 Testing RAG API endpoint with sources...');
    
    const query = 'How can I prioritize VoIP traffic using firewall mangle rules and queue trees?';
    
    try {
        const response = await fetch('http://localhost:3001/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        console.log('✅ API request successful! Response:\n');
        
        // Read and print the JSON response
        const jsonResponse = await response.json();
        
        console.log('📝 Response text:');
        console.log(jsonResponse.response);
        
        console.log('\n📖 Sources found:');
        if (jsonResponse.sources && jsonResponse.sources.length > 0) {
            jsonResponse.sources.forEach((source: any, index: number) => {
                console.log(`${index + 1}. Title: "${source.title}"`);
                console.log(`   URL: ${source.url || 'No URL generated'}`);
                console.log(`   Original Key: ${source.originalKey}`);
                console.log('');
            });
        } else {
            console.log('❌ No sources found in response');
        }
        
        console.log('\n🔍 Full response structure:');
        console.log(JSON.stringify(jsonResponse, null, 2));
        
        console.log('\n\n🎉 Test complete!');
        
    } catch (error) {
        console.error('💥 An error occurred while testing the query API:');
        console.error(error);
        process.exit(1);
    }
}

testQuery(); 