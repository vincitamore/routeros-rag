#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import fetch, { Response } from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Server configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

interface QueryResponse {
  answer: string;
  sources?: Array<{
    title: string;
    content: string;
    metadata?: any;
  }>;
}

class RouterOSMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'routeros-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // Handle list tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'queryRouterOSDocs',
            description: 'Query the RouterOS documentation using RAG (Retrieval-Augmented Generation). This tool provides relevant documentation context about RouterOS configuration, troubleshooting, and features by searching through comprehensive RouterOS documentation. Returns formatted context for the AI to use in generating responses. Semantic tags: routeros, mikrotik, networking, configuration, documentation, troubleshooting.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Your question about RouterOS. Examples: "How to configure VLANs?", "RouterOS firewall rules", "Bridge setup", "OSPF configuration"',
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      if (name === 'queryRouterOSDocs') {
        try {
          console.error('Tool called with args:', JSON.stringify(args));
          const { query } = args as { query: string };

          if (!query || typeof query !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Query parameter is required and must be a string'
            );
          }

          console.error('Processing query:', query);

          // Make request to the backend API for context retrieval (not LLM response)
          const response = await fetch(`${API_BASE_URL}/api/context`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });

          if (!response.ok) {
            throw new McpError(
              ErrorCode.InternalError,
              `API request failed: ${response.status} ${response.statusText}`
            );
          }

          const data = await response.json();
          
          // Format the context for Cursor's LLM
          let formattedContext = `# RouterOS Documentation Context\n\n`;
          formattedContext += `**Query:** ${data.query}\n\n`;
          formattedContext += `**Relevant Documentation Sections:**\n\n`;
          
          data.contexts.forEach((context: any, index: number) => {
            formattedContext += `## ${index + 1}. ${context.title}\n\n`;
            formattedContext += `${context.content}\n\n`;
            if (context.url) {
              formattedContext += `*Source: ${context.url}*\n\n`;
            }
            formattedContext += `---\n\n`;
          });
          
          // Add sources summary
          if (data.sources && data.sources.length > 0) {
            formattedContext += `## Sources\n\n`;
            data.sources.forEach((source: any, index: number) => {
              formattedContext += `${index + 1}. **${source.title}** (${source.contentType})`;
              if (source.url) {
                formattedContext += ` - ${source.url}`;
              }
              formattedContext += `\n`;
            });
          }

          return {
            content: [
              {
                type: 'text',
                text: formattedContext,
              },
            ],
            isError: false,
          };
        } catch (error: any) {
          if (error instanceof McpError) {
            throw error;
          }
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to query RouterOS documentation: ${errorMessage}`
          );
        }
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error: Error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async testApiConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'test connection' }),
      });
      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RouterOS MCP Server started');
    console.error(`API Base URL: ${API_BASE_URL}`);
    
    // Test API connectivity
    const apiConnected = await this.testApiConnection();
    console.error(`API connection test: ${apiConnected ? 'SUCCESS' : 'FAILED'}`);
  }
}

// Start the server
async function main() {
  const server = new RouterOSMCPServer();
  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
} 