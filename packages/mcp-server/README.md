# RouterOS MCP Server

Model Context Protocol (MCP) server that provides RouterOS documentation context to Cursor IDE's AI assistant.

## Overview

This MCP server enables Cursor's AI to access comprehensive RouterOS documentation through semantic search. Unlike the web interface which returns complete AI-generated responses, the MCP server provides **raw documentation context** to Cursor's built-in LLM, allowing it to generate responses while maintaining its conversational abilities.

## Key Features

- **Context Retrieval**: Provides relevant RouterOS documentation sections based on semantic similarity
- **Source References**: Includes links and metadata for documentation sources
- **Optimized for Cursor**: Formats context specifically for LLM consumption
- **No External LLM**: Relies on Cursor's built-in AI for response generation

## Architecture

```
User Query → Cursor AI → MCP Server → API Server (/api/context) → ChromaDB → Documentation Context → Cursor AI → Response
```

## Setup

### 1. Install Dependencies

```bash
cd packages/mcp-server
pnpm install
```

### 2. Environment Configuration

Rename `env.txt` to `.env` and configure:

```bash
# Copy and rename the environment template
cp env.txt .env
```

Edit `.env`:
```bash
# API Configuration - Base URL for the RouterOS RAG API server
API_BASE_URL=http://localhost:3001
```

### 3. Build the Server

```bash
pnpm build
```

## Cursor Configuration

### Global Configuration

Add to your global Cursor MCP settings (`~/.cursor/mcp_settings.json` or similar):

```json
{
  "mcpServers": {
    "routeros-docs": {
      "command": "node",
      "args": ["/path/to/routeros-rag/packages/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Project-Specific Configuration

Create `.cursor/mcp.json` in your project root:

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

## Usage

### Prerequisites

1. Start ChromaDB: `docker-compose up -d` (from project root)
2. Start the API server: `pnpm --filter api dev` (from project root)
3. Ensure data is ingested: `pnpm --filter api run ingest` (if not done already)

### In Cursor

Once configured, you can use the `queryRouterOSDocs` tool in your Cursor conversations:

```
@queryRouterOSDocs How do I configure VLANs on RouterOS?
```

Or simply ask questions about RouterOS and Cursor will automatically use the tool when relevant:

```
I need help setting up OSPF routing in RouterOS
```

## Tool Details

### `queryRouterOSDocs`

**Description**: Query the RouterOS documentation using RAG (Retrieval-Augmented Generation). Provides expert-level answers about RouterOS configuration, troubleshooting, and features.

**Parameters**:
- `query` (string, required): Your question about RouterOS

**Returns**: Formatted documentation context including:
- Relevant documentation sections
- Source references with URLs
- Content type indicators (HTML/Markdown)

## Development

### Running in Development Mode

```bash
pnpm dev
```

### Testing the Server

You can test the server directly with:

```bash
echo '{"method": "tools/list"}' | node dist/index.js
```

### Logs

The server outputs logs to stderr, so you can monitor its activity:

```bash
# Watch logs while using Cursor
tail -f ~/.cursor/logs/mcp.log
```

## Troubleshooting

### Common Issues

1. **Server not responding**: Ensure the API server is running on port 3001
2. **No context returned**: Check that ChromaDB is running and data is ingested
3. **Permission errors**: Ensure the MCP server has execute permissions
4. **API errors**: Check the API server logs for embedding/database issues

### Debugging

Enable verbose logging by setting environment variable:

```bash
DEBUG=1 node dist/index.js
```

## API Endpoints Used

- `POST /api/context`: Retrieves relevant documentation context (used by MCP server)
- `POST /api/query`: Generates complete AI responses (used by web interface)

## Related Documentation

- [Main Project README](../../README.md)
- [Development Plan](../../Misc/DEVELOPMENT_PLAN.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/) 