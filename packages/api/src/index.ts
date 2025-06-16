import Fastify from 'fastify';
import { ChromaClient, EmbeddingFunction } from 'chromadb';
import { generateText, streamText } from 'ai';
import { xai } from '@ai-sdk/xai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import fetch, { RequestInit } from 'node-fetch';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ChatHistoryManager, ContextManagementResult } from './services/chat-history-manager';
import { ChatMessage } from './utils/token-counter';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const fastify = Fastify({ logger: true });

// --- ChromaDB and Embedding Setup ---
const CHROMA_URL = 'http://127.0.0.1:8000';
const COLLECTION_NAME = 'routeros_docs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable not found. Please set it in your .env file.");
    process.exit(1);
}
const EMBEDDING_MODEL = 'gemini-embedding-exp-03-07';
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

const httpAgent = new HttpAgent();
const httpsAgent = new HttpsAgent();
function agent(url: URL) {
    if (url.protocol === 'https:') {
        return httpsAgent;
    }
    return httpAgent;
}

/**
 * Generate an embedding for a single text query.
 */
async function generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(EMBEDDING_ENDPOINT, {
        agent,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: {
                parts: [{ text }],
            },
            taskType: 'RETRIEVAL_QUERY'
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Embedding API request failed with status ${response.status}: ${errorBody}`);
    }
    const data: any = await response.json();
    if (data.embedding && data.embedding.values) {
        return data.embedding.values;
    } else {
        throw new Error("Invalid embedding response format from Gemini API.");
    }
}

// --- API Route Definition ---

// Define the schema for the request body and response
const querySchema = {
    body: {
        type: 'object',
        required: ['query'],
        properties: {
            query: { type: 'string' }
        }
    },
    // We won't define a response schema here because we are streaming the response
};

// Helper function to create a URL-friendly slug from a title (matching navigation.tsx logic)
const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/, /g, '-') // Handle commas
    .replace(/ /g, '-') // Handle spaces
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/-+/g, '-'); // Collapse consecutive hyphens

// Helper function to map original_key to navigation URL, preferring HTML content
const mapKeyToUrl = (originalKey: string, processedContent: any, metadata: any = {}) => {
    // First, try to find the exact key in processed content
    if (processedContent[originalKey]) {
        const node = processedContent[originalKey];
        
        // Check if this document has HTML content available
        const hasHtml = metadata.has_html || node.status === 'html_mapped';
        const contentType = metadata.content_type || (hasHtml ? 'html' : 'markdown');
        
        // Build the path by traversing up the hierarchy
        const buildPath = (key: string, content: any): string[] => {
            const current = content[key];
            if (!current) return [];
            
            // Use original title for URL generation to maintain consistency with key structure
            const parts = [slugify(current.title)];
            
            if (current.parentKey && current.parentKey !== '') {
                const parentParts = buildPath(current.parentKey, content);
                return [...parentParts, ...parts];
            }
            return parts;
        };
        
        const pathParts = buildPath(originalKey, processedContent);
        if (pathParts.length > 0) {
            // Remove "routeros" from the beginning if it exists
            if (pathParts[0] === 'routeros') {
                pathParts.shift(); // Removes the first element
            }
            
            const url = `/docs/${pathParts.join('/')}`;
            
            // Log which content type we're linking to for debugging
            // Note: Using fastify.log here would require passing it as a parameter, so using console for now
            
            return url;
        }
    }
    
    return null;
};

// Define a context retrieval route for MCP (returns raw documentation context)
fastify.post('/api/context', { schema: querySchema }, async (request, reply) => {
    try {
        const { query } = request.body as { query: string };
        fastify.log.info(`Received context query: "${query}"`);

        // Load processed content for URL mapping
        const fs = await import('fs/promises');
        const path = await import('path');
        const processedContentPath = path.resolve(__dirname, '../../../processed_content.json');
        const processedContentRaw = await fs.readFile(processedContentPath, 'utf-8');
        const processedContent = JSON.parse(processedContentRaw);

        // 1. Get the collection ID first
        const collectionsResponse = await fetch(`${CHROMA_URL}/api/v1/collections`, { agent });
        if (!collectionsResponse.ok) {
            throw new Error('Failed to list collections from ChromaDB');
        }
        const collections = await collectionsResponse.json();
        const collection = collections.find((c: any) => c.name === COLLECTION_NAME);
        if (!collection) {
            throw new Error(`Collection '${COLLECTION_NAME}' not found.`);
        }
        const collectionId = collection.id;
        fastify.log.info(`Found collection '${COLLECTION_NAME}' with ID: ${collectionId}`);

        // 2. Generate embedding for the user's query
        const queryEmbedding = await generateEmbedding(query);

        // 3. Query ChromaDB for relevant documents via REST API
        fastify.log.info(`Querying database for relevant documents...`);
        const queryDbResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/query`, {
            agent,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_embeddings: [queryEmbedding],
                n_results: 8, // Slightly fewer results for context retrieval
                include: ["metadatas", "documents"]
            }),
        });

        if (!queryDbResponse.ok) {
            const errorText = await queryDbResponse.text();
            throw new Error(`ChromaDB query failed: ${errorText}`);
        }
        
        const queryResult = await queryDbResponse.json();
        fastify.log.info(`Retrieved ${queryResult.documents[0].length} documents from ChromaDB`);

        // Build context sections and collect source information
        const sources: Array<{title: string, url: string | null, originalKey: string, contentType: string}> = [];
        const contextSections = queryResult.documents[0].map((doc: string, i: number) => {
            const metadata = queryResult.metadatas[0][i] || {};
            const title = metadata.title || 'Unknown Section';
            const originalKey = metadata.original_key || '';
            const contentType = metadata.content_type || 'markdown';
            
            // Generate URL for this source, passing metadata for HTML awareness
            const url = mapKeyToUrl(originalKey, processedContent, metadata);
            
            // Add to sources if we haven't seen this original_key before
            if (!sources.find(s => s.originalKey === originalKey)) {
                sources.push({ title, url, originalKey, contentType });
            }
            
            return {
                title,
                content: doc,
                url,
                contentType
            };
        });

        // Return raw context for MCP clients
        reply.send({
            query,
            contexts: contextSections,
            sources: sources.filter(s => s.url !== null)
        });

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred' });
    }
});

// Define the main RAG query route
fastify.post('/api/query', { schema: querySchema }, async (request, reply) => {
    try {
        const { query } = request.body as { query: string };
        fastify.log.info(`Received query: "${query}"`);

        // Load processed content for URL mapping
        const fs = await import('fs/promises');
        const path = await import('path');
        const processedContentPath = path.resolve(__dirname, '../../../processed_content.json');
        const processedContentRaw = await fs.readFile(processedContentPath, 'utf-8');
        const processedContent = JSON.parse(processedContentRaw);

        // 1. Get the collection ID first
        const collectionsResponse = await fetch(`${CHROMA_URL}/api/v1/collections`, { agent });
        if (!collectionsResponse.ok) {
            throw new Error('Failed to list collections from ChromaDB');
        }
        const collections = await collectionsResponse.json();
        const collection = collections.find((c: any) => c.name === COLLECTION_NAME);
        if (!collection) {
            throw new Error(`Collection '${COLLECTION_NAME}' not found.`);
        }
        const collectionId = collection.id;
        fastify.log.info(`Found collection '${COLLECTION_NAME}' with ID: ${collectionId}`);


        // 2. Generate embedding for the user's query
        const queryEmbedding = await generateEmbedding(query);

        // 3. Query ChromaDB for relevant documents via REST API
        fastify.log.info(`Querying database for relevant documents...`);
        const queryDbResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/query`, {
            agent,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_embeddings: [queryEmbedding],
                n_results: 10,
                include: ["metadatas", "documents"]
            }),
        });

        if (!queryDbResponse.ok) {
            const errorText = await queryDbResponse.text();
            throw new Error(`ChromaDB query failed: ${errorText}`);
        }
        
        const queryResult = await queryDbResponse.json();

        fastify.log.info({ docs: queryResult.documents[0] }, "Retrieved documents from ChromaDB");
        
        // Log content types for debugging
        const contentTypeCounts = { html: 0, markdown: 0 };
        queryResult.metadatas[0].forEach((metadata: any) => {
            const contentType = metadata.content_type || 'markdown';
            if (contentType === 'html') {
                contentTypeCounts.html++;
            } else {
                contentTypeCounts.markdown++;
            }
        });
        fastify.log.info({ contentTypeCounts }, "Content types in query results");

        // Build context sections and collect source information
        const sources: Array<{title: string, url: string | null, originalKey: string, contentType: string}> = [];
        const contextSections = queryResult.documents[0].map((doc: string, i: number) => {
            const metadata = queryResult.metadatas[0][i] || {};
            const title = metadata.title || 'Unknown Section';
            const originalKey = metadata.original_key || '';
            const contentType = metadata.content_type || 'markdown';
            
            // Generate URL for this source, passing metadata for HTML awareness
            const url = mapKeyToUrl(originalKey, processedContent, metadata);
            
            // Add to sources if we haven't seen this original_key before
            if (!sources.find(s => s.originalKey === originalKey)) {
                sources.push({ title, url, originalKey, contentType });
            }
            
            return `---
From section: "${title}"

${doc}
---`;
        }).join('\n\n');

        // 4. Construct the prompt for the LLM
        const systemPrompt = `You are an expert on MikroTik RouterOS. You will be given a user's question and several relevant excerpts from the RouterOS documentation. 
Answer the user's question using only the provided information. Be concise and clear.
If the provided information does not contain the answer, state that you could not find an answer in the provided documentation.
Do not mention that you are an AI or that you were given context. Just answer the question directly.`;

        const finalPrompt = `${query}\n\nRelevant documentation sections:\n\n${contextSections}`;

        fastify.log.info({ prompt: finalPrompt }, "Constructed final prompt for LLM");

        // 5. Generate the response using generateText
        fastify.log.info(`Generating response with LLM...`);
        try {
            const { text } = await generateText({
                model: xai("grok-3-mini-fast"),
                system: systemPrompt,
                prompt: finalPrompt,
            });

            fastify.log.info({ llmResponse: text }, "Received response from LLM.");

            // Send the response back with sources
            reply.send({ 
                response: text,
                sources: sources.filter(s => s.url !== null) // Only include sources with valid URLs
            });

        } catch (e) {
            fastify.log.error(e, "Error during LLM text generation");
            throw e; // Re-throw to be caught by the outer try-catch
        }

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred' });
    }
});

// --- New Chat History Endpoint ---

// Initialize the chat history manager
const chatHistoryManager = new ChatHistoryManager();

// Define schema for chat requests
const chatSchema = {
    body: {
        type: 'object',
        required: ['sessionId', 'messages', 'query'],
        properties: {
            sessionId: { type: 'string' },
            messages: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'role', 'content', 'timestamp'],
                    properties: {
                        id: { type: 'string' },
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                        timestamp: { type: 'string' },
                        ragContext: { type: 'string' }
                    }
                }
            },
            query: { type: 'string' }
        }
    }
};

// Helper function to get RAG context (extracted from existing query endpoint)
async function getRagContext(query: string): Promise<{
    contextSections: string[];
    sources: Array<{title: string, url: string | null, originalKey: string, contentType: string}>
}> {
    // Load processed content for URL mapping
    const fs = await import('fs/promises');
    const path = await import('path');
    const processedContentPath = path.resolve(__dirname, '../../../processed_content.json');
    const processedContentRaw = await fs.readFile(processedContentPath, 'utf-8');
    const processedContent = JSON.parse(processedContentRaw);

    // 1. Get the collection ID
    const collectionsResponse = await fetch(`${CHROMA_URL}/api/v1/collections`, { agent });
    if (!collectionsResponse.ok) {
        throw new Error('Failed to list collections from ChromaDB');
    }
    const collections = await collectionsResponse.json();
    const collection = collections.find((c: any) => c.name === COLLECTION_NAME);
    if (!collection) {
        throw new Error(`Collection '${COLLECTION_NAME}' not found.`);
    }
    const collectionId = collection.id;

    // 2. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // 3. Query ChromaDB for relevant documents
    const queryDbResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/query`, {
        agent,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query_embeddings: [queryEmbedding],
            n_results: 10,
            include: ["metadatas", "documents"]
        }),
    });

    if (!queryDbResponse.ok) {
        const errorText = await queryDbResponse.text();
        throw new Error(`ChromaDB query failed: ${errorText}`);
    }
    
    const queryResult = await queryDbResponse.json();

    // Build context sections and collect source information
    const sources: Array<{title: string, url: string | null, originalKey: string, contentType: string}> = [];
    const contextSections = queryResult.documents[0].map((doc: string, i: number) => {
        const metadata = queryResult.metadatas[0][i] || {};
        const title = metadata.title || 'Unknown Section';
        const originalKey = metadata.original_key || '';
        const contentType = metadata.content_type || 'markdown';
        
        // Generate URL for this source
        const url = mapKeyToUrl(originalKey, processedContent, metadata);
        
        // Add to sources if we haven't seen this original_key before
        if (!sources.find(s => s.originalKey === originalKey)) {
            sources.push({ title, url, originalKey, contentType });
        }
        
        return `---
From section: "${title}"

${doc}
---`;
    });

    return { contextSections, sources };
}

// New chat endpoint with history support
fastify.post('/api/chat', { schema: chatSchema }, async (request, reply) => {
    try {
        const { sessionId, messages, query } = request.body as {
            sessionId: string;
            messages: ChatMessage[];
            query: string;
        };
        
        fastify.log.info(`Received chat request for session: ${sessionId}, query: "${query}"`);

        // 1. Get RAG context for current query
        const { contextSections, sources } = await getRagContext(query);
        
        // 2. Construct enhanced system prompt that includes conversation context
        const systemPrompt = `You are an expert on MikroTik RouterOS. You will be given:
1. A conversation history with the user (if any)
2. Relevant documentation excerpts for the current question

Answer the user's question using the provided information and conversation context.
Be concise and clear. Reference previous conversation when relevant to provide better continuity.
If the provided information does not contain the answer, state that you could not find an answer in the provided documentation.
Do not mention that you are an AI or that you were given context. Just answer the question directly.`;

        // 3. Manage chat history and context
        const managementResult: ContextManagementResult = await chatHistoryManager.manageChatHistory(
            sessionId,
            messages,
            contextSections,
            systemPrompt,
            query
        );

        fastify.log.info({
            sessionId,
            tokenBreakdown: managementResult.tokenBreakdown,
            needsSummarization: managementResult.needsSummarization
        }, "Token breakdown and summarization status");

        // 4. Construct comprehensive prompt
        const conversationContext = managementResult.contextToSend ? 
            `Conversation History:\n${managementResult.contextToSend}\n\n` : '';
        
        const finalPrompt = `${conversationContext}Current Question: ${query}

Relevant Documentation:
${contextSections.join('\n\n')}`;

        fastify.log.info({ 
            totalTokens: managementResult.tokenBreakdown.totalTokens,
            promptPreview: finalPrompt.length > 2000 ? finalPrompt.substring(0, 2000) + '...' : finalPrompt 
        }, "Constructed final prompt for LLM");

        // 5. Generate response
        const { text } = await generateText({
            model: xai("grok-3-mini-fast"),
            system: systemPrompt,
            prompt: finalPrompt,
        });

        fastify.log.info({ llmResponse: text }, "Received response from LLM");

        // 6. Store the complete interaction
        await chatHistoryManager.storeInteraction(
            sessionId, 
            query, 
            text, 
            contextSections.join('\n\n')
        );

        // 7. Send response with sources
        reply.send({
            response: text,
            sources: sources.filter(s => s.url !== null),
            sessionStats: chatHistoryManager.getSessionStats(sessionId)
        });

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred during chat processing' });
    }
});

// Summarization endpoint for manual context compression
fastify.post('/api/summarize-context', async (request, reply) => {
    try {
        const { messages, ragContexts } = request.body as {
            messages: ChatMessage[];
            ragContexts: string[];
        };
        
        fastify.log.info(`Received summarization request for ${messages.length} messages`);

        const systemPrompt = `You are tasked with summarizing a chat conversation and documentation context for a RouterOS technical assistant.

CRITICAL REQUIREMENTS:
1. PRESERVE ALL user questions and assistant answers in a condensed but complete form
2. PRESERVE ALL technical details, configuration examples, and specific RouterOS commands exactly
3. HEAVILY SUMMARIZE the documentation sections - extract only the key technical facts referenced in the conversation
4. Maintain chronological order of the conversation
5. Keep all product names, version numbers, command syntax, and specific technical terms exact
6. Focus on preserving the technical solutions and configurations discussed

The goal is to reduce token count while preserving all conversational context and technical accuracy.
Format as a flowing summary, not bullet points.`;

        const contextToSummarize = `Chat Messages:
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Referenced Documentation Context:
${ragContexts.join('\n---\n')}`;

        const { text } = await generateText({
            model: xai("grok-3-mini-fast"),
            system: systemPrompt,
            prompt: `Please summarize the following technical conversation and documentation context:\n\n${contextToSummarize}`,
        });

        reply.send({ 
            summary: text,
            originalTokenCount: contextToSummarize.length,
            summaryTokenCount: text.length
        });

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred during summarization' });
    }
});

// Session management endpoints
fastify.get('/api/session/:sessionId/stats', async (request, reply) => {
    try {
        const { sessionId } = request.params as { sessionId: string };
        const stats = chatHistoryManager.getSessionStats(sessionId);
        
        if (!stats) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }

        reply.send(stats);
    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred' });
    }
});

fastify.delete('/api/session/:sessionId', async (request, reply) => {
    try {
        const { sessionId } = request.params as { sessionId: string };
        chatHistoryManager.clearSession(sessionId);
        reply.send({ message: 'Session cleared successfully' });
    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'An internal error occurred' });
    }
});


// --- Server Start ---
const start = async () => {
    try {
        if (!process.env.XAI_API_KEY) {
            fastify.log.warn('XAI_API_KEY environment variable not found. The LLM will likely fail.');
        }
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        fastify.log.info(`API server listening on http://localhost:3001`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start(); 