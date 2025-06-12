# RouterOS RAG Knowledge Base

A comprehensive RAG (Retrieval-Augmented Generation) system for RouterOS documentation with web interface and MCP server integration for Cursor IDE.

## Architecture

This project is a monorepo containing three main packages:

- **`packages/api`** - Backend API server with RAG functionality
- **`packages/web`** - Next.js frontend for browsing docs and chat interface  
- **`packages/mcp-server`** - MCP server for Cursor IDE integration (not yet implemented)
- **`packages/api/src/scripts/`** - Data ingestion and utility scripts

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) package manager
- [Docker](https://www.docker.com/) and Docker Compose

### API Keys Required

- **Gemini API Key**: Used for generating document embeddings
  - Get from: https://aistudio.google.com/app/apikey
  - Used by: ingestion script and API server for semantic search
- **XAI API Key**: Used for LLM responses  
  - Get from: https://console.x.ai/
  - Used by: API server for answering questions with Grok

### Installation

1. Clone the repository:
```bash
git clone https://github.com/NCUamoyer/routeros-rag.git
cd routeros-rag
```

2. Install dependencies:
```bash
pnpm install
```

3. Start ChromaDB (vector database):
```bash
docker-compose up -d
```

4. Set up environment variables:
```bash
# Copy the example environment file and edit with your API keys
cp env.example.txt .env

# Edit the .env file and add your actual API keys:
# - GEMINI_API_KEY: Get from https://aistudio.google.com/app/apikey
# - XAI_API_KEY: Get from https://console.x.ai/
```

5. Start the development servers:
```bash
# Start the API server
pnpm --filter api dev

# In another terminal, start the web interface
pnpm --filter web dev
```

## Package Details

### API Server (`packages/api`)

The backend server provides:
- RAG-powered document search and question answering
- Vector similarity search using ChromaDB
- AI responses using Grok 3 Mini Fast LLM (via XAI)
- Document embeddings using Gemini Embedding Model
- RESTful API endpoints

**Key endpoints:**
- `POST /api/query` - Submit questions and get AI-powered answers with source references

**Key dependencies:**
- Gemini API for generating document embeddings
- XAI (Grok) for natural language responses
- ChromaDB for vector storage and similarity search

### Web Interface (`packages/web`)

A modern Next.js application featuring:
- Dark-mode first design
- Recursive documentation navigation
- Real-time chat interface with streaming responses
- Responsive design for mobile and desktop

### MCP Server (`packages/mcp-server`)

Model Context Protocol server for Cursor IDE integration (planned):
- `queryRouterOSDocs` tool for querying documentation
- Seamless integration with Cursor's AI assistant

## Data

The project includes:
- **`processed_content.json`** - Pre-processed RouterOS documentation (154MB)
  - Contains both markdown and HTML content for 1000+ documentation sections
  - Includes metadata like titles, hierarchy, tags, and file paths
- **ChromaDB collections** - Vector embeddings for semantic search
  - Embeddings generated using Gemini Embedding Model (gemini-embedding-exp-03-07)
  - Chunked content optimized for retrieval (30,000 chars per chunk with 1,500 char overlap)
- **Document outline** - Hierarchical navigation structure for the web interface

## Development

### Running the ingestion script

The ingestion script processes the `processed_content.json` file and loads it into ChromaDB with embeddings:

```bash
# Run the ingestion script (requires GEMINI_API_KEY in .env)
pnpm --filter api run ingest
```

**What the ingestion script does:**
- Reads `processed_content.json` (154MB of RouterOS documentation)
- Splits content into 30,000 character chunks with 1,500 character overlap
- Generates embeddings using Gemini API (gemini-embedding-exp-03-07 model)
- Stores documents, metadata, and embeddings in ChromaDB
- Supports resumable ingestion with automatic state management
- Processes both HTML and markdown content types

### Available Scripts

```bash
# Install all dependencies
pnpm install

# Start all services in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Docker

The project includes a `docker-compose.yml` for running ChromaDB:

```bash
# Start ChromaDB
docker-compose up -d

# Stop ChromaDB
docker-compose down
```

## Usage

### Web Interface

1. Start the API server: `pnpm --filter api dev` (runs on port 3001)
2. Start the web interface: `pnpm --filter web dev` (runs on port 3000)
3. Navigate to `http://localhost:3000`
4. Browse documentation using the sidebar navigation
5. Use the chat interface to ask questions about RouterOS
   - Powered by RAG system with semantic search
   - Returns answers with source references

### API Usage

The API server exposes a REST endpoint for direct integration:

```bash
# Query the RAG system directly
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I configure VLAN on RouterOS?"}'
```

### Cursor Integration (Planned)

The MCP server package is planned for future development to enable:
1. Configure the MCP server in your Cursor settings
2. Use the `queryRouterOSDocs` tool in your conversations  
3. Get context-aware answers about RouterOS features

## Current Status

Based on the development plan, the following phases are complete:

- **Phase 1**: Data ingestion and vector store setup ✓
- **Phase 2**: RAG API implementation ✓
- **Phase 3**: Web frontend development (in progress)
- **Phase 4**: Final integration and deployment (pending)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]

## Links

- [Development Plan](./Misc/DEVELOPMENT_PLAN.md)
- [GitHub Repository](https://github.com/NCUamoyer/routeros-rag) 