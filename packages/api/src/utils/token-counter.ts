import { encoding_for_model } from 'tiktoken';

export interface TokenCountResult {
  tokenCount: number;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ragContext?: string; // Store the RAG context used for this response
}

export class TokenCounter {
  private static encoder = encoding_for_model('gpt-3.5-turbo'); // Similar tokenization to most models

  // Use proper tokenization for accurate token counting
  static countTokens(text: string): number {
    const tokens = this.encoder.encode(text);
    return tokens.length;
  }

  static countChatHistory(messages: ChatMessage[]): TokenCountResult {
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const tokenCount = this.countTokens(content);
    return { tokenCount, content };
  }

  static countDocumentationContext(contextSections: string[]): TokenCountResult {
    const content = contextSections.join('\n---\n');
    const tokenCount = this.countTokens(content);
    return { tokenCount, content };
  }

  static countSystemPrompt(systemPrompt: string): number {
    return this.countTokens(systemPrompt);
  }

  static countTotalContext(
    systemPrompt: string,
    chatHistory: ChatMessage[],
    documentationContext: string[],
    currentQuery: string
  ): {
    systemTokens: number;
    historyTokens: number;
    documentationTokens: number;
    queryTokens: number;
    totalTokens: number;
  } {
    const systemTokens = this.countSystemPrompt(systemPrompt);
    const historyResult = this.countChatHistory(chatHistory);
    const docResult = this.countDocumentationContext(documentationContext);
    const queryTokens = this.countTokens(currentQuery);
    
    const totalTokens = systemTokens + historyResult.tokenCount + docResult.tokenCount + queryTokens;

    return {
      systemTokens,
      historyTokens: historyResult.tokenCount,
      documentationTokens: docResult.tokenCount,
      queryTokens,
      totalTokens
    };
  }

  // Clean up encoder when shutting down
  static cleanup(): void {
    this.encoder.free();  
  }
} 