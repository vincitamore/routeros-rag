'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import styles from './FullPageChat.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ChatStatus from './chat-status';
import { 
  SaveIcon, 
  TrashIcon, 
  CopyIcon, 
  RefreshIcon 
} from './icons';

export default function FullPageChat() {
  const { messages, input, handleInputChange, handleSubmit, setMessages, setInput, isLoading } = useChat({
    streamProtocol: 'text',
  });

  const clearChat = () => setMessages([]);
  
  const newChat = () => {
    setMessages([]);
    setInput(''); // Also clear the input field
  };
  
  const copyConversation = async () => {
    const conversationText = messages
      .map(m => `${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: ${m.content}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(conversationText);
    } catch (err) {
      console.error('Failed to copy conversation:', err);
    }
  };

  const saveChat = () => {
    const chatHistory = JSON.stringify(messages, null, 2);
    const blob = new Blob([chatHistory], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routeros-chat-history-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.actions}>
          <button 
            onClick={newChat} 
            className={styles.actionButton}
            title="New Conversation"
          >
            <RefreshIcon size={18} />
            <span>New</span>
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
          messages.map(m => {
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
                <li>"How do I configure a basic firewall?"</li>
                <li>"What's the difference between bridge and switch?"</li>
                <li>"How to set up VLAN tagging?"</li>
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