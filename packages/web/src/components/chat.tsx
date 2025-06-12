'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import styles from './Chat.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ChatStatus from './chat-status';
import { 
  SaveIcon, 
  TrashIcon, 
  ExpandIcon, 
  ShrinkIcon, 
  CopyIcon, 
  RefreshIcon,
  MinusIcon 
} from './icons';

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, setMessages, setInput, isLoading } = useChat({
    streamProtocol: 'text',
  });

  const handleToggle = () => setIsOpen(!isOpen);
  const handleExpand = () => setIsExpanded(!isExpanded);
  const handleMinimize = () => setIsOpen(false);
  
  const clearChat = () => setMessages([]);
  
  const newChat = () => {
    setMessages([]);
    setInput(''); // Also clear the input field
    // Reset to fresh state
  };
  
  const copyConversation = async () => {
    const conversationText = messages
      .map(m => `${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: ${m.content}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(conversationText);
      // You could add a toast notification here
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
      <div className={`${styles.chatBox} ${isOpen ? styles.open : styles.closed} ${isExpanded ? styles.expanded : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerActions}>
            <div className={styles.leftActions}>
              <button 
                onClick={newChat} 
                className={styles.actionButton}
                title="New Conversation"
              >
                <RefreshIcon size={16} />
              </button>
              <button 
                onClick={copyConversation} 
                className={styles.actionButton}
                title="Copy Conversation"
                disabled={messages.length === 0}
              >
                <CopyIcon size={16} />
              </button>
            </div>
            
            <div className={styles.centerActions}>
              <button 
                onClick={handleExpand} 
                className={styles.actionButton}
                title={isExpanded ? 'Shrink' : 'Expand'}
              >
                {isExpanded ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
              </button>
            </div>
            
            <div className={styles.rightActions}>
              <button 
                onClick={saveChat} 
                className={styles.actionButton}
                title="Save Chat"
                disabled={messages.length === 0}
              >
                <SaveIcon size={16} />
              </button>
              <button 
                onClick={clearChat} 
                className={styles.actionButton}
                title="Clear Chat"
                disabled={messages.length === 0}
              >
                <TrashIcon size={16} />
              </button>
              <button 
                onClick={handleMinimize} 
                className={styles.actionButton}
                title="Minimize"
              >
                <MinusIcon size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.messageList}>
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
                    <strong>{`${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: `}</strong>
                    <div className={styles.messageBubble}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{messageContent}</ReactMarkdown>
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
            <p className={styles.welcomeText}>How can I help you with RouterOS today?</p>
          )}
          
          <ChatStatus isLoading={isLoading} />
        </div>
        <div className={styles.formContainer}>
          <form onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about RouterOS..."
              className={styles.input}
              disabled={isLoading}
            />
          </form>
        </div>
      </div>
      
      {!isOpen && (
        <button onClick={handleToggle} className={styles.toggleButton}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
} 