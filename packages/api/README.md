# RouterOS RAG API Server

The backend API server that powers the RouterOS RAG Knowledge Base system. Built with Fastify and TypeScript, this server provides RAG-powered document search, AI-generated responses, and comprehensive data ingestion capabilities for RouterOS documentation.

## Overview

This API server serves as the core backend for the RouterOS RAG system, providing:

- **RAG-Powered Queries**: Semantic search through RouterOS documentation with AI-generated responses
- **Context Retrieval**: Raw documentation context for MCP server integration
- **Data Ingestion Pipeline**: Complete workflow for processing and embedding RouterOS documentation
- **HTML Content Processing**: Advanced HTML analysis, mapping, and text extraction
- **Vector Database Management**: ChromaDB integration for similarity search

## Architecture

```
API Server (Fastify + TypeScript)
├── Core Server (index.ts)
│   ├── /api/query - AI-powered responses for web interface
│   └── /api/context - Raw context for MCP server
├── Data Processing Pipeline
│   ├── HTML Analysis & Mapping
│   ├── Content Extraction & Chunking
│   ├── Embedding Generation (Gemini)
│   └── Vector Database Ingestion (ChromaDB)
├── Utilities
│   ├── Content Mapping (HTML ↔ Outline)
│   └── Text Processing & Chunking
└── Testing & Debugging Tools
```

## Technology Stack

- **Framework**: Fastify (high-performance web server)
- **Language**: TypeScript with strict type checking
- **Vector Database**: ChromaDB for similarity search
- **Embedding Model**: Google Gemini (`gemini-embedding-exp-03-07`)
- **LLM**: XAI Grok 3 Mini Fast for response generation
- **Content Processing**: Custom HTML parsing and text extraction

## Prerequisites

- Node.js 18+
- pnpm package manager
- ChromaDB running on port 8000
- Required API keys (see Environment Setup)

## Environment Setup

Create a `.env` file in the project root with the following variables:

```bash
# Required: Gemini API for embeddings
GEMINI_API_KEY=your_gemini_api_key_here

# Required: XAI API for LLM responses  
XAI_API_KEY=your_xai_api_key_here

# Optional: Custom embedding endpoint (for alternative providers)
EMBEDDING_MODEL_ENDPOINT=http://your-custom-endpoint
```

### API Key Setup

1. **Gemini API Key**: 
   - Get from: https://aistudio.google.com/app/apikey
   - Used for: Document embeddings and similarity search

2. **XAI API Key**:
   - Get from: https://console.x.ai/
   - Used for: AI response generation with Grok 3 Mini Fast

## Installation

```bash
# Install dependencies
pnpm install

# Build TypeScript to JavaScript
pnpm build
```

## Quick Start

1. **Start ChromaDB** (from project root):
```bash
docker-compose up -d
```

2. **Ingest Documentation** (first time setup):
```bash
pnpm ingest
```

3. **Start Development Server**:
```bash
pnpm dev
```

4. **Test the API**:
```bash
pnpm test-query
```

## API Endpoints

### `POST /api/query`
**Purpose**: Full RAG pipeline for web interface
**Input**: `{ "query": "How do I configure VLANs?" }`
**Output**: AI-generated response with source references
**Use**: Web interface chat functionality

### `POST /api/context`  
**Purpose**: Raw documentation context for MCP integration
**Input**: `{ "query": "VLAN configuration" }`
**Output**: Relevant documentation sections without AI processing
**Use**: Cursor MCP server integration

## Scripts & Data Pipeline

### Core Data Processing

#### `pnpm ingest`
**Main ingestion script** - Processes and embeds documentation into ChromaDB
- Reads `processed_content.json` 
- Supports both HTML and Markdown content
- Chunks content (30,000 chars with 1,500 char overlap)
- Generates embeddings using Gemini API
- Stores in ChromaDB with metadata
- **Resumable**: Can continue from interruption point

#### `pnpm build && node dist/scripts/analyze-html-content.js`
**HTML content analysis** - Analyzes raw HTML files for processing
- Scans RouterOS HTML documentation
- Extracts titles, hierarchy, images, attachments
- Estimates token counts and file sizes
- Outputs `html-analysis-results.json`

### Content Enhancement Workflow

#### 1. HTML Analysis
```bash
pnpm build && node dist/scripts/analyze-html-content.js [ROS_PATH]
```

#### 2. Content Mapping  
```bash
pnpm build && node dist/scripts/content-mapper.js
```

#### 3. HTML Processing
```bash
pnpm build && node dist/scripts/process-html-content.js
```

#### 4. Content Deployment
```bash
pnpm build && node dist/scripts/deploy-html-content.js deploy
```

### Testing & Debugging

#### `pnpm test-query`
Test the RAG API endpoint with sample queries

#### `pnpm test-embedding`
Test embedding generation functionality

#### `pnpm debug-chroma`
Debug ChromaDB connection and operations

### Available Scripts

```bash
# Development
pnpm dev                 # Start development server with hot reload
pnpm build              # Build TypeScript to JavaScript

# Data Processing
pnpm ingest             # Main ingestion pipeline
pnpm debug-chroma       # Debug ChromaDB connectivity

# Testing
pnpm test-query         # Test RAG API endpoint
pnpm test-embedding     # Test embedding generation
```

## Project Structure

```
src/
├── index.ts                    # Main API server
├── scripts/                    # Data processing scripts
│   ├── ingest.ts              # Main ingestion pipeline
│   ├── analyze-html-content.ts # HTML file analysis
│   ├── process-html-content.ts # HTML content processing
│   ├── deploy-html-content.ts  # Content deployment
│   ├── validate-html-content.ts # Content validation
│   ├── debug-chroma.ts        # ChromaDB debugging
│   ├── debug-structure.ts     # Data structure debugging
│   ├── summarize-analysis.ts  # Analysis result summary
│   ├── test-query.ts          # API endpoint testing
│   └── test-embedding.ts      # Embedding testing
└── utils/                      # Utility functions
    ├── content-mapper.ts       # HTML ↔ outline mapping
    └── html-to-text.ts        # Text extraction & chunking
```

## Data Processing Pipeline

### 1. HTML Content Analysis
- Scans RouterOS HTML documentation files
- Extracts metadata (titles, hierarchy, images, attachments)
- Analyzes content structure and estimates token counts
- Categorizes content by topic areas

### 2. Content Mapping  
- Maps HTML files to outline structure using similarity algorithms
- Uses title matching, hierarchy analysis, and keyword detection
- Generates confidence scores for mapping quality
- Handles both numbered and named HTML files

### 3. HTML Processing
- Extracts clean text from HTML for embeddings
- Preserves formatting and structure where relevant
- Extracts images and attachment references
- Updates processed content with HTML enhancements

### 4. Chunking & Embedding
- Splits content into optimal chunks (30,000 chars with overlap)
- Generates embeddings using Gemini API
- Stores documents with comprehensive metadata
- Supports both HTML and Markdown content types

### 5. Vector Storage
- Stores embeddings in ChromaDB
- Includes rich metadata for filtering and source attribution
- Optimized for semantic similarity search
- Supports resumable ingestion for large datasets

## Data Formats

### Input Data
- **`processed_content.json`**: Main documentation structure
- **`ROS/` directory**: Raw HTML files, images, attachments
- **Document outline**: Hierarchical navigation structure

### Processed Content Structure
```typescript
interface ProcessedNode {
  title: string;
  level: number;
  parentKey: string;
  status: 'processed' | 'html_mapped' | 'pending' | 'error';
  
  // Legacy content
  content_raw: string;
  content_processed: string;
  
  // HTML enhancements
  html_file_path?: string;
  html_title?: string;
  html_text_content?: string;  // Used for embeddings
  images?: string[];
  attachments?: string[];
  
  tags: string[];
}
```

### Vector Database Schema
```typescript
interface DocumentMetadata {
  title: string;
  level: number;
  parentKey: string;
  tags: string;
  original_key: string;
  chunk_index: number;
  content_type: 'html' | 'markdown';
  has_html: boolean;
  html_file_path: string;
  images_count: number;
  attachments_count: number;
}
```

## Advanced Features

### Content Type Support
- **HTML Content**: Rich formatting, images, attachments preserved
- **Markdown Content**: Clean text processing
- **Hybrid Processing**: Prefers HTML when available, falls back to Markdown

### Smart Content Mapping
- **Similarity Algorithms**: Levenshtein distance, word overlap, substring matching
- **Hierarchy Matching**: Breadcrumb and path analysis
- **Keyword Detection**: RouterOS-specific terminology matching
- **Confidence Scoring**: Weighted combination of matching factors

### Resumable Ingestion
- **State Management**: Tracks processing progress
- **Error Recovery**: Continue from last successful batch
- **Batch Processing**: Configurable batch sizes for API rate limits

### URL Generation
- **Dynamic Routing**: Maps internal keys to web interface URLs
- **Slug Generation**: Clean, SEO-friendly documentation paths
- **Content-Aware**: Considers HTML vs Markdown availability

## Performance Considerations

### Chunking Strategy
- **Optimal Size**: 30,000 characters (~7,500 tokens)
- **Overlap**: 1,500 characters (5%) for context continuity
- **Smart Splitting**: Paragraph-aware, sentence-boundary fallback

### API Rate Limiting
- **Batch Processing**: 10 documents per batch default
- **Delays**: 100ms between batches to avoid overwhelming APIs
- **Error Handling**: Exponential backoff for failed requests

### Memory Management
- **Streaming**: Large files processed in chunks
- **State Cleanup**: Automatic cleanup of temporary files
- **Resource Monitoring**: Memory-efficient processing patterns

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   ```bash
   # Check if ChromaDB is running
   docker-compose ps
   
   # Start ChromaDB if needed
   docker-compose up -d
   ```

2. **API Key Errors**
   ```bash
   # Verify environment variables
   echo $GEMINI_API_KEY
   echo $XAI_API_KEY
   ```

3. **Embedding Generation Fails**
   ```bash
   # Test embedding endpoint
   pnpm test-embedding
   ```

4. **Ingestion Interrupted**
   ```bash
   # Resume from last checkpoint
   pnpm ingest
   ```

### Debug Tools

- **ChromaDB Status**: `pnpm debug-chroma`
- **Data Structure**: `node dist/scripts/debug-structure.js`
- **Content Analysis**: `node dist/scripts/summarize-analysis.js`
- **API Testing**: `pnpm test-query`

### Logs & Monitoring

The server uses Fastify's built-in logging:
- Request/response logging
- Error tracking with stack traces
- Performance metrics
- ChromaDB operation logs

## Development

### Adding New Scripts

1. Create script in `src/scripts/`
2. Add to `package.json` scripts section
3. Follow existing patterns for error handling
4. Include progress reporting for long operations

### Extending API Endpoints

1. Add route definition in `src/index.ts`
2. Include input validation schema
3. Add comprehensive error handling
4. Update this README with endpoint documentation

### Custom Embedding Providers

The system supports custom embedding endpoints via `EMBEDDING_MODEL_ENDPOINT`. Ensure your endpoint follows OpenAI-compatible format.

## Related Documentation

- [Main Project README](../../README.md)
- [Web Interface Documentation](../web/README.md)
- [MCP Server Documentation](../mcp-server/README.md)
- [Development Plan](../../Misc/DEVELOPMENT_PLAN.md)

## Contributing

1. Follow TypeScript strict mode requirements
2. Include comprehensive error handling
3. Add progress reporting for long-running operations
4. Update documentation for new features
5. Test with both HTML and Markdown content types 