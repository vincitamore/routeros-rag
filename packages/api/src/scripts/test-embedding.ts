import fetch from 'node-fetch';

async function testEmbedding() {
    console.log('🧪 Testing new embedding endpoint...');

    const endpoint = 'http://100.123.183.144:1234/v1/embeddings';
    const payload = {
        model: 'text-embedding-qwen3-embedding-8b',
        input: 'Encode this text: The quick brown fox jumps over the lazy dog.',
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error(`API request failed with status ${response.status}`);
            console.error('Error details:', responseData);
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        console.log('✅ API request successful! Response:\n');
        
        // Log the full response to inspect it
        console.log(JSON.stringify(responseData, null, 2));

        if (responseData.data && responseData.data[0] && responseData.data[0].embedding) {
            console.log(`\nEmbedding received with ${responseData.data[0].embedding.length} dimensions.`);
        } else {
            console.log('\nWarning: The response does not appear to contain a valid embedding array.');
        }

    } catch (error) {
        console.error('💥 An error occurred while testing the embedding endpoint:');
        // We log the raw error object which might have more details (e.g., from node-fetch)
        console.error(error);
        process.exit(1);
    }
}

testEmbedding(); 