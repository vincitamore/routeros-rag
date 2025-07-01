'use client';

import React from 'react';
import UnifiedTerminalManager from './UnifiedTerminalManager';
import { DeviceInfo } from '../../types/terminal';

interface TerminalManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices?: DeviceInfo[];
  deviceId?: string; // Optional device ID to pre-select when opened from device context
}

export function TerminalManagerModal({ 
  isOpen, 
  onClose, 
  devices, 
  deviceId 
}: TerminalManagerModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Close modal on Escape key
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-3)'
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminal-manager-title"
    >
      <div 
        style={{
          maxWidth: '98vw',
          maxHeight: '96vh',
          width: '1600px',
          height: '900px',
          minHeight: '800px',
          minWidth: '800px',
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(var(--border-rgb), 0.3)',
          borderRadius: 'var(--space-3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        <UnifiedTerminalManager
          onClose={onClose}
          devices={devices}
          deviceId={deviceId}
        />
      </div>
    </div>
  );
} 