import { TokenCounter, ChatMessage, TokenCountResult } from '../utils/token-counter';
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  totalTokens: number;
  lastSummarizedIndex: number; // Track what's been summarized
  summarizedContext?: string; // Store the summarized context
}

export interface ContextManagementResult {
  processedMessages: ChatMessage[];
  contextToSend: string;
  needsSummarization: boolean;
  tokenBreakdown: {
    systemTokens: number;
    historyTokens: number;
    documentationTokens: number;
    queryTokens: number;
    totalTokens: number;
  };
}

export class ChatHistoryManager {
  private static readonly MAX_TOKENS = 135000;
  private static readonly SUMMARIZATION_THRESHOLD = 120000; // 89% of max
  private static readonly PRESERVE_RECENT_MESSAGES = 10; // Always keep last 10 messages
  private sessions = new Map<string, ChatSession>();

  async manageChatHistory(
    sessionId: string, 
    messages: ChatMessage[],
    newRagContext: string[],
    systemPrompt: string,
    currentQuery: string
  ): Promise<ContextManagementResult> {
    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        messages: [],
        totalTokens: 0,
        lastSummarizedIndex: -1
      };
      this.sessions.set(sessionId, session);
    }

    // Update session with new messages
    session.messages = [...messages];

    // Count tokens for current context
    const tokenBreakdown = TokenCounter.countTotalContext(
      systemPrompt,
      session.messages,
      newRagContext,
      currentQuery
    );

    // Check if we need summarization
    const needsSummarization = tokenBreakdown.totalTokens > ChatHistoryManager.SUMMARIZATION_THRESHOLD;

    let processedMessages = session.messages;
    let contextToSend = '';

    if (needsSummarization && session.messages.length > ChatHistoryManager.PRESERVE_RECENT_MESSAGES) {
      // Summarize old context
      const recentMessages = session.messages.slice(-ChatHistoryManager.PRESERVE_RECENT_MESSAGES);
      const oldMessages = session.messages.slice(0, -ChatHistoryManager.PRESERVE_RECENT_MESSAGES);
      
      // Only summarize if we haven't already summarized these messages
      if (session.lastSummarizedIndex < oldMessages.length - 1) {
        const messagesToSummarize = oldMessages.slice(session.lastSummarizedIndex + 1);
        const ragContextsToSummarize = messagesToSummarize
          .map(m => m.ragContext)
          .filter(context => context !== undefined) as string[];

        const summarizedContext = await this.summarizeOldContext(
          messagesToSummarize,
          ragContextsToSummarize
        );

        // Update session with summarized context
        session.summarizedContext = session.summarizedContext 
          ? `${session.summarizedContext}\n\n${summarizedContext}`
          : summarizedContext;
        session.lastSummarizedIndex = oldMessages.length - 1;
      }

      // Build context with summary + recent messages
      const recentHistory = TokenCounter.countChatHistory(recentMessages);
      contextToSend = session.summarizedContext 
        ? `Previous conversation summary:\n${session.summarizedContext}\n\nRecent conversation:\n${recentHistory.content}`
        : recentHistory.content;

      processedMessages = recentMessages;
    } else {
      // Use full history if under threshold
      const fullHistory = TokenCounter.countChatHistory(session.messages);
      contextToSend = fullHistory.content;
      processedMessages = session.messages;
    }

    // Update session total tokens
    session.totalTokens = tokenBreakdown.totalTokens;

    return {
      processedMessages,
      contextToSend,
      needsSummarization,
      tokenBreakdown
    };
  }

  private async summarizeOldContext(
    messages: ChatMessage[],
    ragContexts: string[]
  ): Promise<string> {
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

    try {
      const { text } = await generateText({
        model: xai("grok-3-mini-fast"),
        system: systemPrompt,
        prompt: `Please summarize the following technical conversation and documentation context:\n\n${contextToSummarize}`,
      });

      return text;
    } catch (error) {
      console.error('Error during context summarization:', error);
      // Fallback: return truncated original content
      return `Summary unavailable. Recent conversation: ${messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}`;
    }
  }

  async storeInteraction(
    sessionId: string,
    query: string,
    response: string,
    ragContext: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update the last assistant message with RAG context
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.ragContext = ragContext;
    }
  }

  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // Get session statistics for debugging
  getSessionStats(sessionId: string): {
    messageCount: number;
    totalTokens: number;
    hasSummarizedContext: boolean;
    lastSummarizedIndex: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      messageCount: session.messages.length,
      totalTokens: session.totalTokens,
      hasSummarizedContext: !!session.summarizedContext,
      lastSummarizedIndex: session.lastSummarizedIndex
    };
  }
} 