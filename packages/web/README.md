# RouterOS RAG Web Interface

A modern, responsive web interface for the RouterOS RAG Knowledge Base system. Built with Next.js 15, this application provides an intuitive way to browse RouterOS documentation and interact with AI-powered assistance for configuration and troubleshooting.

## Features

### Smart Documentation Search
- **AI-Powered Chat**: Ask questions in natural language and get precise answers from RouterOS documentation
- **Streaming Responses**: Real-time response streaming with source references
- **Context-Aware**: Leverages RAG (Retrieval-Augmented Generation) for accurate, sourced answers

### Interactive Documentation Browser
- **Hierarchical Navigation**: Browse the complete RouterOS documentation with collapsible sections
- **Dynamic Content Rendering**: Supports both HTML and Markdown content with proper formatting
- **Enhanced HTML Display**: Preserves original formatting, images, and attachments from RouterOS docs
- **Responsive Design**: Optimized for both desktop and mobile viewing

### **Conversational AI Chat System** 
- **Follow-up Questions**: Full conversation context for related questions
- **Intelligent Token Management**: Automatic summarization at 135k context limit with technical detail preservation
- **Persistent Sessions**: Chat history survives page navigation and browser restarts via localStorage
- **Enhanced Save/Load**: Export conversations with metadata + one-click JSON file loading (replaces "New" button)
- **Session Statistics**: Real-time token counting and conversation metrics
- **Chat Management**: Copy, clear, minimize, expand, and conversation persistence
- **Source References**: Automatic linking to relevant documentation sections with conversation context

### Modern UI/UX
- **Dark-First Design**: Sleek dark theme optimized for developers
- **Mobile-Responsive**: Adaptive layout that works on all devices
- **Smooth Animations**: Polished transitions and interactions
- **Accessibility**: Built with web accessibility standards in mind

## Architecture

```
Web Interface (Next.js 15)
├── Frontend Components
│   ├── Navigation (Hierarchical docs browser)
│   ├── Conversational Chat Interface (Full history + context)
│   ├── Documentation Viewer (HTML/Markdown renderer)
│   └── Layout Components (Headers, responsive design)
├── Chat History System
│   ├── useChatWithHistory Hook (Session management)
│   ├── LocalStorage Persistence (Survives restarts)
│   ├── Enhanced Save/Load (JSON export/import)
│   └── Token Management (Context compression)
├── API Routes
│   ├── /api/chat (Conversational streaming with history)
│   ├── /api/docs/[...slug] (Dynamic doc content)
│   ├── /api/outline (Navigation structure)
│   └── /api/assets (Static assets proxy)
└── Backend Integration
    └── RouterOS RAG API Server (port 3001)
```

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: CSS Modules with responsive design
- **UI Libraries**: 
  - `ai` - Streaming chat interface with React hooks
  - `react-markdown` - Markdown rendering with GitHub Flavored Markdown
  - `rehype-raw` - HTML support in markdown
  - `dompurify` - HTML sanitization for security
- **Development**: Turbopack for fast development builds

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm package manager
- RouterOS RAG API server running on port 3001

### Installation

1. **Install dependencies**:
```bash
cd packages/web
pnpm install
```

2. **Start the development server**:
```bash
pnpm dev
```

3. **Open in browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
# Development with Turbopack (faster builds)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Home page with features
│   ├── globals.css        # Global styles
│   ├── docs/              # Dynamic documentation routes
│   │   └── [...slug]/     # Catch-all route for docs
│   └── api/               # API routes
│       ├── chat/          # Chat streaming endpoint
│       ├── docs/          # Documentation content API
│       ├── outline/       # Navigation structure API
│       └── assets/        # Static assets proxy
├── components/            # React components
│   ├── navigation.tsx     # Hierarchical docs browser
│   ├── chat.tsx           # Collapsible chat interface
│   ├── full-page-chat.tsx # Full-screen chat for home page
│   ├── layout-client.tsx  # Client-side layout wrapper
│   ├── desktop-header.tsx # Desktop navigation header
│   ├── mobile-header.tsx  # Mobile navigation header
│   ├── chat-status.tsx    # Loading states for chat
│   └── icons.tsx          # SVG icon components
├── hooks/                 # Custom React hooks
│   └── use-chat-with-history.ts # Conversational chat with session management
├── utils/                 # Utility functions
│   └── html-processor.ts  # HTML sanitization and processing
└── styles/               # CSS Modules (co-located with components)
```

## Key Components

### Navigation Component
- Fetches documentation outline from `/document_outline.json`
- Renders collapsible hierarchical navigation
- Generates URL-friendly slugs for documentation pages
- Supports mobile-responsive sidebar

### Conversational Chat Interface 
- **Full Conversation History**: Follow-up questions with complete context
- **Smart Context Management**: Automatic token management with 135k limit
- **Session Persistence**: Chat history survives page navigation and browser restarts
- **Enhanced Save/Load**: Export conversations with metadata + one-click JSON loading
- **Token Awareness**: Real-time token counting and automatic summarization
- Integrates with conversational RAG API using custom `useChatWithHistory` hook
- Streams responses with conversation context from the RAG API server
- Separates main responses from source references with conversation awareness
- Includes advanced chat management (save/load, copy, clear, minimize, expand)

### Documentation Viewer
- Dynamic routing for documentation pages (`/docs/[...slug]`)
- Renders both HTML and Markdown content
- Processes and sanitizes HTML content for security
- Displays images, attachments, and metadata

### Layout System
- Responsive design with mobile-first approach
- Dark theme with CSS custom properties
- Smooth animations and transitions
- Accessible navigation patterns

## Integration with RAG System

The web interface communicates with the RouterOS RAG API server:

- **Conversational Chat**: `POST /api/chat` - Full conversation history with intelligent context management 
- **Token Management**: `POST /api/summarize-context` - Automatic context compression at token limits  
- **Session Management**: `GET/DELETE /api/session/:id` - Session statistics and cleanup 
- **Legacy Chat**: `POST /api/query` - Single-query responses (still supported)
- **Documentation Endpoint**: Fetches processed content by document slug
- **Assets Endpoint**: Proxies static assets (images, attachments)
- **Search Integration**: Uses semantic search via the backend RAG system with conversation context

## Development Notes

### Styling Approach
- CSS Modules for component-scoped styles
- CSS custom properties for theming
- Mobile-first responsive design
- Consistent spacing and typography scales

### Performance Optimizations
- Next.js 15 with Turbopack for fast development
- Streaming responses for better perceived performance
- Lazy loading of documentation content
- Optimized bundle splitting

### Security Features
- HTML sanitization with DOMPurify
- Secure API proxy for assets
- CSP-compatible inline styles
- XSS protection for user-generated content

## Deployment

The web interface can be deployed as a standard Next.js application:

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Contributing

When contributing to the web interface:

1. Follow the existing CSS Modules pattern for styling
2. Use TypeScript for all new components
3. Maintain responsive design principles
4. Test on both desktop and mobile viewports
5. Ensure accessibility standards are met

## Related Documentation

- [Main Project README](../../README.md)
- [API Server Documentation](../api/README.md)
- [MCP Server Documentation](../mcp-server/README.md)
