# RouterOS RAG Knowledge Base

A comprehensive RAG (Retrieval-Augmented Generation) system for RouterOS documentation with web interface and MCP server integration for Cursor IDE.

## Architecture

This project is a monorepo containing three main packages:

- **`packages/api`** - Backend API server with RAG functionality
- **`packages/web`** - Next.js frontend for browsing docs and chat interface  
- **`packages/mcp-server`** - MCP server for Cursor IDE integration
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

3. Set up environment variables:
```bash
# Copy the example environment file and edit with your API keys
cp env.example.txt .env

# Edit the .env file and add your actual API keys:
# - GEMINI_API_KEY: Get from https://aistudio.google.com/app/apikey
# - XAI_API_KEY: Get from https://console.x.ai/
```

4. Start ChromaDB and set up embeddings:
```bash
# Start ChromaDB
docker-compose up -d

# Set up pre-built embeddings (Linux/Mac)
./setup-embeddings.sh

# Or on Windows
setup-embeddings.bat
```

5. Start the development servers:
```bash
# Start the API server
pnpm --filter api dev

# In another terminal, start the web interface
pnpm --filter web dev
```

## Pre-Built Embeddings Included

This repository includes **pre-built vector embeddings** for the entire RouterOS documentation (326 document chunks, ~2KB compressed). This means:

- **No waiting for ingestion** - Ready to use immediately
- **Minimal storage overhead** - Only ~2KB additional repository size  
- **Easy setup** - One script restores all embeddings
- **Instant functionality** - Start querying right away

### Manual Ingestion (Optional)

If you prefer to generate fresh embeddings or the pre-built ones don't work:

```bash
# Delete existing embeddings and regenerate
pnpm --filter api run ingest
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
- `POST /api/context` - Retrieve raw documentation context for MCP integration

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

Model Context Protocol server for Cursor IDE integration:
- **Context Retrieval**: Provides RouterOS documentation context to Cursor's AI (not LLM responses)
- **Semantic Search**: Uses ChromaDB embeddings to find relevant documentation sections
- **`queryRouterOSDocs` tool**: Formats and returns documentation context for Cursor's built-in LLM
- **Important**: Unlike the web interface, the MCP server provides raw context, letting Cursor's AI generate the final response

## Data

The project includes:
- **`processed_content.json`** - Pre-processed RouterOS documentation (154MB)
  - Contains both markdown and HTML content for 1000+ documentation sections
  - Includes metadata like titles, hierarchy, tags, and file paths
- **`chroma-data.tar.gz`** - Pre-built vector embeddings (~2KB compressed)
  - 326 document chunks with vector embeddings
  - Generated using Gemini Embedding Model (gemini-embedding-exp-03-07)
  - Chunked content optimized for retrieval (30,000 chars per chunk with 1,500 char overlap)
- **Document outline** - Hierarchical navigation structure for the web interface

## Development

### First-Time Setup with Pre-Built Embeddings

The setup scripts automatically:
1. Start ChromaDB if not running
2. Extract pre-built embeddings from `chroma-data.tar.gz`
3. Restore embeddings to ChromaDB
4. Verify the setup

### Manual Embedding Generation

If you need to regenerate embeddings (e.g., after updating documentation):

```bash
# Run the ingestion script (requires GEMINI_API_KEY in .env)
pnpm --filter api run ingest
```

**What the ingestion script does:**
- Reads `processed_content.json` (RouterOS documentation htmls processed and organized with metadata)
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

# Set up embeddings (if needed)
./setup-embeddings.sh        # Linux/Mac
setup-embeddings.bat         # Windows
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

![RouterOS RAG Web Interface](./screenshots/Screenshot%202025-06-13%20082542.png)

1. Start ChromaDB and set up embeddings: `./setup-embeddings.sh`
2. Start the API server: `pnpm --filter api dev` (runs on port 3001)
3. Start the web interface: `pnpm --filter web dev` (runs on port 3000)
4. Navigate to `http://localhost:3000`
5. Browse documentation using the sidebar navigation
6. Use the chat interface to ask questions about RouterOS
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

### Cursor Integration

The MCP server enables Cursor IDE integration:

1. **Install and build the MCP server**:
```bash
cd packages/mcp-server
pnpm install
pnpm build
```

2. **Configure in Cursor**: Create `.cursor/mcp.json` in your project:
```json
{
  "mcpServers": {
    "routeros-docs": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

3. **Use in conversations**: Ask questions and include the tool name "queryRouterOSDocs" then Cursor will automatically access the documentation context:
```
How do I configure VLANs on RouterOS? queryRouterOSDocs
```

**Key Difference**: The MCP server provides documentation context to Cursor's AI, while the web interface generates complete responses using Grok 3.

## Current Status

Based on the development plan, the following phases are complete:

- **Phase 1**: Data ingestion and vector store setup ✓
- **Phase 2**: RAG API and MCP server implementation ✓
- **Phase 3**: Web frontend development ✓
- **Phase 4**: Final integration and deployment ✓

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Links

### Project Documentation
- [API Server Documentation](./packages/api/README.md)
- [Web Interface Documentation](./packages/web/README.md)
- [MCP Server Documentation](./packages/mcp-server/README.md)

### External Links
- [GitHub Repository](https://github.com/NCUamoyer/routeros-rag) 

## MIT License

Copyright (c) 2024 RouterOS RAG Knowledge Base

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### RouterOS Documentation

The RouterOS documentation content used in this project is the property of MikroTik and is used for educational and reference purposes. MikroTik provides their documentation freely accessible at https://help.mikrotik.com/. This project does not claim ownership of the RouterOS documentation content and all rights to the documentation remain with MikroTik.

This project is not affiliated with or endorsed by MikroTik.