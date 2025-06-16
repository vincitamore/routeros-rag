export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { sessionId, messages, query } = await req.json();

        // Validate input
        if (!sessionId || !messages || !query) {
            return new Response("Missing required fields: sessionId, messages, or query", { status: 400 });
        }

        // Forward to the new chat endpoint instead of query
        const ragResponse = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, messages, query })
        });

        if (!ragResponse.ok || !ragResponse.body) {
            const errorText = await ragResponse.text();
            console.error('RAG API error:', errorText);
            return new Response(`Error from RAG API: ${errorText}`, { status: ragResponse.status });
        }

        const ragJson = await ragResponse.json();
        
        // The new API returns the complete response with sources already integrated
        return new Response(JSON.stringify(ragJson), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in chat API:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 