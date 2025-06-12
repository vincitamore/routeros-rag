export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1]?.content;

        if (!lastMessage) {
            return new Response("No message provided", { status: 400 });
        }

        const ragResponse = await fetch('http://localhost:3001/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: lastMessage })
        });

        if (!ragResponse.ok || !ragResponse.body) {
            const errorText = await ragResponse.text();
            console.error('RAG API error:', errorText);
            return new Response(`Error from RAG API: ${errorText}`, { status: ragResponse.status });
        }

        const ragJson = await ragResponse.json();
        const ragText = ragJson.response;
        const sources = ragJson.sources || [];

        // Create a combined response with the answer and sources
        let responseText = ragText;
        
        if (sources.length > 0) {
            responseText += '\n\n**📖 Related Documentation:**\n';
            const tags = sources.map((source: any) => {
                if (source.url) {
                    // Return a clean anchor tag; styling will be handled by CSS
                    return `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.title}</a>`;
                }
                // Fallback for any sources that might not have a URL
                return `<span>${source.title}</span>`;
            }).join(' '); // Use a space to separate the tags

            // Add a newline before the block of tags to ensure it's rendered in its own paragraph
            responseText += `\n${tags}`;
        }

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(responseText));
                controller.close();
            },
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error('Error in chat API:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
} 