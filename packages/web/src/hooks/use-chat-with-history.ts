import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SessionStats {
  messageCount: number;
  totalTokens: number;
  hasSummarizedContext: boolean;
  lastSummarizedIndex: number;
}

export interface ChatResponse {
  response: string;
  sources: Array<{
    title: string;
    url: string;
    originalKey: string;
    contentType: string;
  }>;
  sessionStats?: SessionStats;
}

export interface SavedChatSession {
  sessionId: string;
  messages: ChatMessage[];
  sessionStats: SessionStats | null;
  savedAt: string;
  version: string; // For future compatibility
}

const STORAGE_KEY = 'routeros-chat-session';

export function useChatWithHistory() {
  // Create sessionId - will be loaded from storage after hydration
  const [sessionId, setSessionId] = useState(() => uuidv4());
  
  // Start with empty messages to avoid hydration mismatch
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          
          // Load sessionId if available
          if (parsed.sessionId) {
            setSessionId(parsed.sessionId);
          }
          
          // Load messages if available
          if (parsed.messages && Array.isArray(parsed.messages)) {
            const messagesWithDates = parsed.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(messagesWithDates);
          }
        }
      } catch (error) {
        console.error('Error loading chat history from localStorage:', error);
      }
      setIsHydrated(true);
    };

    loadFromStorage();
  }, []);

  // Save to localStorage whenever messages change
  const saveToStorage = useCallback((updatedMessages: ChatMessage[]) => {
    if (typeof window !== 'undefined' && isHydrated) {
      try {
        const dataToStore = {
          sessionId,
          messages: updatedMessages,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
      } catch (error) {
        console.error('Error saving chat history to localStorage:', error);
      }
    }
  }, [sessionId, isHydrated]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    saveToStorage(updatedMessagesWithUser);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: [...messages, userMessage],
          query: content.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data: ChatResponse = await response.json();
      
      // Create assistant message with sources
      let assistantContent = data.response;
      
      // Add sources to the content if they exist
      if (data.sources && data.sources.length > 0) {
        assistantContent += '\n\n**📖 Related Documentation:**\n';
        const sourceTags = data.sources.map(source => 
          `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.title}</a>`
        ).join(' ');
        assistantContent += `\n${sourceTags}`;
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessagesWithUser, assistantMessage];
      setMessages(finalMessages);
      saveToStorage(finalMessages);

      // Log session stats for debugging
      if (data.sessionStats) {
        console.log('Session Stats:', data.sessionStats);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      
      const messagesWithError = [...updatedMessagesWithUser, errorMessage];
      setMessages(messagesWithError);
      saveToStorage(messagesWithError);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages, saveToStorage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    // Clear from localStorage as well
    if (typeof window !== 'undefined' && isHydrated) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isHydrated]);

  const getSessionStats = useCallback(async (): Promise<SessionStats | null> => {
    try {
      const response = await fetch(`/api/session/${sessionId}/stats`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching session stats:', error);
      return null;
    }
  }, [sessionId]);

  const clearSession = useCallback(async () => {
    try {
      await fetch(`/api/session/${sessionId}`, {
        method: 'DELETE',
      });
      clearMessages();
    } catch (error) {
      console.error('Error clearing session:', error);
      // Still clear local messages even if server call fails
      clearMessages();
    }
  }, [sessionId, clearMessages]);

  const saveConversation = useCallback(async (): Promise<void> => {
    try {
      const stats = await getSessionStats();
      const savedSession: SavedChatSession = {
        sessionId,
        messages,
        sessionStats: stats,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };

      const chatData = JSON.stringify(savedSession, null, 2);
      const blob = new Blob([chatData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routeros-chat-${sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error saving conversation:', error);
      setError('Failed to save conversation');
    }
  }, [sessionId, messages, getSessionStats]);

  const loadConversation = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const savedSession: SavedChatSession = JSON.parse(content);
          
          // Validate the saved session format
          if (!savedSession.sessionId || !Array.isArray(savedSession.messages)) {
            throw new Error('Invalid chat file format');
          }

          // Convert string timestamps back to Date objects
          const messagesWithDates = savedSession.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));

          // Clear current messages and load the saved ones
          setMessages(messagesWithDates);
          saveToStorage(messagesWithDates);
          setError(null);
          
          console.log('Loaded conversation:', {
            sessionId: savedSession.sessionId,
            messageCount: messagesWithDates.length,
            savedAt: savedSession.savedAt
          });

          resolve(true);
        } catch (error) {
          console.error('Error loading conversation:', error);
          setError('Failed to load conversation file');
          resolve(false);
        }
      };
      
      reader.onerror = () => {
        setError('Failed to read conversation file');
        resolve(false);
      };
      
      reader.readAsText(file);
    });
  }, [saveToStorage]);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearMessages,
    clearSession,
    sessionId,
    getSessionStats,
    saveConversation,
    loadConversation,
  };
} 