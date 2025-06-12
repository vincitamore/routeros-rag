import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
import fetch, { RequestInit } from 'node-fetch';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { extractTextFromHtml, splitTextIntoChunks } from '../utils/html-to-text';

// --- Interfaces to match the structure of processed_content.json ---

interface ProcessedNode {
    title: string;
    level: number;
    parentKey: string;
    status: 'pending' | 'processing_chunks' | 'processed' | 'html_mapped' | 'skipped' | 'error';
    content_raw: string;
    content_processed: string;
    
    // HTML fields
    html_file_path?: string;
    html_title?: string;
    html_text_content?: string; // For embeddings
    images?: string[];
    attachments?: string[];
    
    tags: string[];
    error_message?: string;
    chunks?: Chunk[];
}

interface Chunk {
    status: 'pending' | 'processed' | 'error';
    content_raw: string;
    content_processed: string;
    tags: string[];
    error_message?: string;
}

interface ProcessedContent {
    [key: string]: ProcessedNode;
}

// --- Configuration ---
const INPUT_FILE = path.resolve(__dirname, '../../../../processed_content.json');
const STATE_FILE = path.resolve(__dirname, '../../../../ingestion_state.json');
const CHROMA_URL = 'http://127.0.0.1:8000';
const COLLECTION_NAME = 'routeros_docs';
const BATCH_SIZE = 10; // Number of documents to process and add at a time
const EMBEDDING_MODEL = 'gemini-embedding-exp-03-07';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not found. Please set it in your .env file.");
}
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const httpAgent = new HttpAgent();
const httpsAgent = new HttpsAgent();
function agent(url: URL) {
    if (url.protocol === 'https:') {
        return httpsAgent;
    }
    return httpAgent;
}

/**
 * Generate embeddings using the Gemini batch embedding API
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const requests = texts.map(text => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT'
    }));

    const response = await fetch(EMBEDDING_ENDPOINT, {
        agent,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();
    if (data.embeddings && Array.isArray(data.embeddings)) {
        return data.embeddings.map((e: any) => e.values);
    } else {
        throw new Error("Invalid embedding response format from Gemini API.");
    }
}

interface IngestionState {
    lastProcessedBatchIndex: number;
}

async function ingestData() {
    console.log("🚀 Starting data ingestion process...");
    console.log(`[INFO] Using Embedding endpoint: ${EMBEDDING_ENDPOINT}`);
    console.log(`[INFO] Using Embedding model: ${EMBEDDING_MODEL}`);
    
    // 1. --- Test ChromaDB connection ---
    console.log(`\n[1/5] Testing connection to ChromaDB at ${CHROMA_URL}...`);
    const heartbeatResponse = await fetch(`${CHROMA_URL}/api/v1/heartbeat`, { agent });
    if (!heartbeatResponse.ok) {
        throw new Error(`ChromaDB not available: ${heartbeatResponse.status}`);
    }
    console.log("[SUCCESS] ChromaDB is up and running!");

    // 2. --- Load and Prepare Data ---
    console.log(`\n[2/5] Reading and parsing data from ${INPUT_FILE}...`);
    const fileContent = await fs.readFile(INPUT_FILE, 'utf-8');
    const processedContent: ProcessedContent = JSON.parse(fileContent);

    const documents: { id: string; document: string; metadata: any }[] = [];
    const CHUNK_SIZE = 30000; // Aim for ~7500 tokens, well within 8192 limit
    const CHUNK_OVERLAP = 1500;  // 5% overlap

    // Filter for documents that are processed or have HTML content
    const rawDocs = Object.entries(processedContent)
        .filter(([, node]) => {
            // Include documents with HTML content or traditional processed content
            const hasHtmlContent = node.status === 'html_mapped' && node.html_text_content && node.html_text_content.trim().length > 0;
            const hasProcessedContent = node.status === 'processed' && node.content_processed.trim().length > 0;
            return hasHtmlContent || hasProcessedContent;
        });

    let htmlDocCount = 0;
    let markdownDocCount = 0;

    for (const [key, node] of rawDocs) {
        let textContent = '';
        let contentType = '';
        
        // Prefer HTML content over processed markdown
        if (node.status === 'html_mapped' && node.html_text_content && node.html_text_content.trim().length > 0) {
            textContent = node.html_text_content;
            contentType = 'html';
            htmlDocCount++;
        } else if (node.content_processed && node.content_processed.trim().length > 0) {
            textContent = node.content_processed;
            contentType = 'markdown';
            markdownDocCount++;
        } else {
            continue; // Skip if no content available
        }
        
        const chunks = splitTextIntoChunks(textContent, CHUNK_SIZE, CHUNK_OVERLAP);
        chunks.forEach((chunk, index) => {
            documents.push({
                id: `${key}_${index}`,
                document: chunk,
                metadata: {
                    title: node.html_title || node.title,
                    level: node.level,
                    parentKey: node.parentKey,
                    tags: node.tags.join(', '), // Chroma metadata values must be strings, numbers, or booleans
                    // Add original key and chunk index for reference
                    original_key: key,
                    chunk_index: index,
                    content_type: contentType,
                    // HTML-specific metadata
                    has_html: node.status === 'html_mapped',
                    html_file_path: node.html_file_path || '',
                    images_count: node.images?.length || 0,
                    attachments_count: node.attachments?.length || 0
                }
            });
        });
    }
    
    if (documents.length === 0) {
        console.log("No documents with status 'processed' or 'html_mapped' found. Exiting.");
        return;
    }
    
    console.log(`✅ Found ${rawDocs.length} documents to ingest:`);
    console.log(`   - HTML documents: ${htmlDocCount}`);
    console.log(`   - Markdown documents: ${markdownDocCount}`);
    console.log(`   - Total chunks: ${documents.length}`);

    // 3. --- Load State and Manage Collection ---
    let startingBatchIndex = 0;
    let collectionId = '';

    const stateExists = await fs.access(STATE_FILE).then(() => true).catch(() => false);

    if (stateExists) {
        try {
            const stateContent = await fs.readFile(STATE_FILE, 'utf-8');
            const state: IngestionState = JSON.parse(stateContent);
            if (state.lastProcessedBatchIndex !== undefined) {
                startingBatchIndex = state.lastProcessedBatchIndex + 1;
                console.log(`\n[3/5] Resuming ingestion from batch index ${startingBatchIndex}.`);
            }
        } catch (error) {
            console.warn(`[WARN] Could not read state file, starting from the beginning. Error: ${(error as Error).message}`);
            startingBatchIndex = 0;
        }
    }

    if (startingBatchIndex === 0) {
        console.log(`\n[3/5] Starting fresh ingestion, managing collection '${COLLECTION_NAME}'...`);
    // Delete existing collection
    try {
        const deleteResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}`, {
            agent,
            method: 'DELETE'
        });
        if (deleteResponse.ok) {
            console.log(`   - Collection '${COLLECTION_NAME}' deleted.`);
        }
    } catch (e) {
        console.log(`   - Collection '${COLLECTION_NAME}' did not exist, skipping deletion.`);
    }
    
    // Create new collection
    const createResponse = await fetch(`${CHROMA_URL}/api/v1/collections`, {
        agent,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: COLLECTION_NAME
        })
    });
    
    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create collection: ${createResponse.status} ${errorText}`);
    }
    const collectionData: any = await createResponse.json();
        collectionId = collectionData.id;
    console.log(`✅ Collection created successfully with ID: ${collectionId}.`);
    } else {
        // Get existing collection ID
        const getResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}`, { agent });
        if (!getResponse.ok) {
            throw new Error(`Failed to get collection: ${getResponse.status}`);
        }
        const collectionData: any = await getResponse.json();
        collectionId = collectionData.id;
        console.log(`\n[3/5] Using existing collection with ID: ${collectionId}.`);
    }

    // 4. --- Batch Process and Ingest ---
    console.log(`\n[4/5] Processing and ingesting documents in batches of ${BATCH_SIZE}...`);
    
    for (let i = startingBatchIndex * BATCH_SIZE; i < documents.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE);
        const batch = documents.slice(i, i + BATCH_SIZE);
        
        try {
            const totalDocs = documents.length;
            const currentDocNum = i + batch.length;
            process.stdout.write(`   - Generating embeddings for documents ${i + 1}-${currentDocNum}/${totalDocs}...\r`);

            // Generate embeddings for the batch
            const batchTexts = batch.map(doc => doc.document);
            const embeddings = await generateEmbeddings(batchTexts);
            
            // Add to ChromaDB via REST API
            const addResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/add`, {
                agent,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ids: batch.map(doc => doc.id),
                    documents: batch.map(doc => doc.document),
                    metadatas: batch.map(doc => doc.metadata),
                    embeddings: embeddings
                })
            });
            
            if (!addResponse.ok) {
                const errorText = await addResponse.text();
                throw new Error(`Failed to add batch: ${addResponse.status} ${errorText}`);
            }
            
            // Save state after successful batch ingestion
            const newState: IngestionState = { lastProcessedBatchIndex: batchIndex };
            await fs.writeFile(STATE_FILE, JSON.stringify(newState, null, 2));

            // A newline is needed after the progress indicator to properly print the batch completion message
            process.stdout.write(`\n   - Ingested batch ${batchIndex + 1}/${Math.ceil(documents.length / BATCH_SIZE)} (documents ${i + 1}-${i + batch.length})\n`);
        } catch (error) {
            console.error(`\n❌ Error processing batch ${batchIndex + 1}:`, (error as Error).message);
            console.log("   Stopping ingestion. Run the script again to resume from this point.");
            throw error;
        }

        // Add small delay between batches to avoid overwhelming the API
        await delay(100);
    }

    // 5. --- Verify ingestion ---
    console.log(`\n[5/5] Verifying ingestion...`);
    const countResponse = await fetch(`${CHROMA_URL}/api/v1/collections/${collectionId}/count`, { agent });
    if (!countResponse.ok) {
        throw new Error(`Failed to get collection count: ${countResponse.status}`);
    }
    const countData: any = await countResponse.json();
    console.log(`✅ Total documents in collection: ${countData}`);

    // Delete the state file upon successful completion
    try {
        await fs.unlink(STATE_FILE);
        console.log("🧹 Cleaned up ingestion state file.");
    } catch (e) {
        // It's okay if the file doesn't exist
    }

    console.log("\n🎉 Ingestion Complete!");
    console.log("   All documents have been successfully embedded and stored in ChromaDB.");
    console.log(`   Collection '${COLLECTION_NAME}' contains ${countData} document chunks.`);
}

// --- Main execution ---
if (require.main === module) {
    ingestData().catch(error => {
        console.error("❌ Ingestion failed:", error);
        process.exit(1);
    });
} 