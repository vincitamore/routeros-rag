'use client';

import { useState } from 'react';
import { useChatWithHistory, ChatMessage } from '@/hooks/use-chat-with-history';
import styles from './FullPageChat.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ChatStatus from './chat-status';
import { 
  SaveIcon, 
  TrashIcon, 
  CopyIcon, 
  FolderOpenIcon 
} from './icons';

export default function FullPageChat() {
  const { messages, sendMessage, isLoading, clearMessages, saveConversation, loadConversation } = useChatWithHistory();
  const [input, setInput] = useState('');

  const clearChat = () => clearMessages();
  
  const handleLoadConversation = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const success = await loadConversation(file);
        if (success) {
          setInput(''); // Clear input field after successful load
        }
      }
    };
    input.click();
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const copyConversation = async () => {
    const conversationText = messages
      .map((m: ChatMessage) => `${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: ${m.content}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(conversationText);
    } catch (err) {
      console.error('Failed to copy conversation:', err);
    }
  };

  const saveChat = () => {
    saveConversation();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.actions}>
          <button 
            onClick={handleLoadConversation} 
            className={styles.actionButton}
            title="Load Conversation"
          >
            <FolderOpenIcon size={18} />
            <span>Load</span>
          </button>
          <button 
            onClick={copyConversation} 
            className={styles.actionButton}
            title="Copy Conversation"
            disabled={messages.length === 0}
          >
            <CopyIcon size={18} />
            <span>Copy</span>
          </button>
          <button 
            onClick={saveChat} 
            className={styles.actionButton}
            title="Save Chat"
            disabled={messages.length === 0}
          >
            <SaveIcon size={18} />
            <span>Save</span>
          </button>
          <button 
            onClick={clearChat} 
            className={styles.actionButton}
            title="Clear Chat"
            disabled={messages.length === 0}
          >
            <TrashIcon size={18} />
            <span>Clear</span>
          </button>
        </div>
      </div>
      
      <div className={styles.messageArea}>
        {messages.length > 0 ? (
          messages.map((m: ChatMessage) => {
            let messageContent = m.content;
            let sourcesContent = null;
            const separator = '\n\n**📖 Related Documentation:**\n';

            if (m.role === 'assistant' && m.content.includes(separator)) {
                const parts = m.content.split(separator);
                messageContent = parts[0];
                sourcesContent = `**📖 Related Documentation:**\n${parts[1]}`;
            }

            return (
                <div 
                  key={m.id} 
                  className={`${styles.message} ${m.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                >
                  <div className={styles.messageHeader}>
                    <strong>{m.role === 'user' ? 'You' : 'RouterOS Assistant'}</strong>
                  </div>
                  <div className={styles.messageContent}>
                    {m.role === 'user' ? (
                      messageContent
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{messageContent}</ReactMarkdown>
                    )}
                  </div>
                  {sourcesContent && (
                    <div className={styles.sourcesContainer}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{sourcesContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
            )
          })
        ) : (
          <div className={styles.welcomeMessage}>
            <h3>Welcome to RouterOS Assistant</h3>
            <p>I'm here to help with configuration, troubleshooting, and best practices. What can I help you with today?</p>
            <div className={styles.exampleQuestions}>
              <p><strong>Try asking:</strong></p>
              <ul>
                <li>&quot;How do I configure a basic firewall?&quot;</li>
                <li>&quot;What&apos;s the difference between bridge and switch?&quot;</li>
                <li>&quot;How to set up VLAN tagging?&quot;</li>
              </ul>
            </div>
          </div>
        )}
        
        <ChatStatus isLoading={isLoading} />
      </div>

      <div className={styles.inputArea}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about RouterOS configuration, features, or troubleshooting..."
            className={styles.input}
            disabled={isLoading}
          />
          <button type="submit" className={styles.sendButton} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
} 