'use client';

import { useState } from 'react';
import { useChatWithHistory, ChatMessage } from '@/hooks/use-chat-with-history';
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
  FolderOpenIcon,
  MinusIcon 
} from './icons';

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');

  const { messages, sendMessage, isLoading, clearMessages, saveConversation, loadConversation } = useChatWithHistory();

  const handleToggle = () => setIsOpen(!isOpen);
  const handleExpand = () => setIsExpanded(!isExpanded);
  const handleMinimize = () => setIsOpen(false);
  
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
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy conversation:', err);
    }
  };
  
  const saveChat = () => {
    saveConversation();
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.chatBox} ${isOpen ? styles.open : styles.closed} ${isExpanded ? styles.expanded : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerActions}>
            <div className={styles.leftActions}>
              <button 
                onClick={handleLoadConversation} 
                className={styles.actionButton}
                title="Load Conversation"
              >
                <FolderOpenIcon size={16} />
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