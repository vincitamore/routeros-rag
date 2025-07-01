import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  portal?: boolean; // Whether to render tooltip in a portal to avoid clipping
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 500,
  disabled = false,
  portal = true // Default to using portal to avoid clipping issues
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled || !content) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updateTooltipPosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updateTooltipPosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport bounds
    x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

    setTooltipPosition({ x, y });
  };

  useEffect(() => {
    if (isVisible) {
      updateTooltipPosition();
    }
  }, [isVisible]);

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) {
        hideTooltip();
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible]);

  const getArrowStyles = () => {
    const arrowSize = 6;
    const arrowStyles: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid'
    };

    switch (position) {
      case 'top':
        return {
          ...arrowStyles,
          bottom: -arrowSize,
          left: '50%',
          marginLeft: -arrowSize,
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: 'rgba(var(--background-rgb), 0.95) transparent transparent transparent'
        };
      case 'bottom':
        return {
          ...arrowStyles,
          top: -arrowSize,
          left: '50%',
          marginLeft: -arrowSize,
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent rgba(var(--background-rgb), 0.95) transparent'
        };
      case 'left':
        return {
          ...arrowStyles,
          right: -arrowSize,
          top: '50%',
          marginTop: -arrowSize,
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: 'transparent transparent transparent rgba(var(--background-rgb), 0.95)'
        };
      case 'right':
        return {
          ...arrowStyles,
          left: -arrowSize,
          top: '50%',
          marginTop: -arrowSize,
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: 'transparent rgba(var(--background-rgb), 0.95) transparent transparent'
        };
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>

      {isVisible && content && (() => {
        const tooltipContent = (
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              zIndex: 1050,
              pointerEvents: 'none',
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 0.15s ease-in-out'
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(var(--background-rgb), 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(var(--border-rgb), 0.6)',
                borderRadius: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                maxWidth: '250px',
                wordWrap: 'break-word',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                position: 'relative'
              }}
            >
              {content}
            </div>
          </div>
        );

        return portal ? createPortal(tooltipContent, document.body) : tooltipContent;
      })()}
    </>
  );
}; 