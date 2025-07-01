import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ParsedTerminalSession } from '../../lib/terminal-parser';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'json' | 'txt' | 'html' | 'csv') => Promise<void>;
  sessionId: string;
  terminalElement?: HTMLElement | null;
  deviceName: string;
  parsedSession?: ParsedTerminalSession | null;
}

type ExportFormat = 'json' | 'txt' | 'html' | 'csv' | 'pdf' | 'png';

const formatDescriptions = {
  json: 'Machine-readable JSON format with full session metadata',
  txt: 'Plain text format with commands and output',
  html: 'HTML format preserving colors and formatting',
  csv: 'Comma-separated values for data analysis',
  pdf: 'High-quality PDF with terminal styling and ANSI color preservation',
  png: 'PNG image of the terminal session with syntax highlighting preserved'
};

const formatIcons = {
  json: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  ),
  txt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="12" y1="9" x2="8" y2="9"/>
    </svg>
  ),
  html: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16,18 18,18 18,6 16,6"/>
      <polyline points="8,6 6,6 6,18 8,18"/>
      <line x1="12" y1="15" x2="12" y2="9"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  csv: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="9" y1="9" x2="9" y2="15"/>
      <line x1="15" y1="9" x2="15" y2="15"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
  ),
  pdf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <circle cx="10" cy="12" r="2"/>
      <path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-.296-.648A3 3 0 0 0 16 14a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 1.408-.352 2.41 2.41 0 0 0 .648-.296L20 17z"/>
    </svg>
  ),
  png: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21,15 16,10 5,21"/>
    </svg>
  )
};

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  sessionId,
  terminalElement,
  deviceName,
  parsedSession
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [exportTheme, setExportTheme] = useState<'dark' | 'light'>('dark');
  const dialogRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      if (selectedFormat === 'pdf') {
        await handlePDFExport();
      } else if (selectedFormat === 'png') {
        await handlePNGExport();
      } else {
        await onExport(selectedFormat as 'json' | 'txt' | 'html' | 'csv');
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const createVirtualTerminalElement = (theme: 'dark' | 'light' = 'dark'): HTMLElement => {
    const container = document.createElement('div');
    
    // Theme-based styles
    const isDark = theme === 'dark';
    const backgroundColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#1a1a1a';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)';
    const headerBackground = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.03)';
    const headerBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Professional shadow effects that work with html2canvas
    const shadowEffect = isDark 
      ? `0 8px 25px 0 rgba(0, 0, 0, 0.4), 0 4px 10px 0 rgba(0, 0, 0, 0.3)`
      : `0 8px 25px 0 rgba(0, 0, 0, 0.12), 0 4px 10px 0 rgba(0, 0, 0, 0.08)`;

    container.style.cssText = `
      width: 1200px;
      min-height: 800px;
      background: ${backgroundColor};
      color: ${textColor};
      font-family: "JetBrains Mono", "Courier New", monospace;
      font-size: 14px;
      line-height: 1.4;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid ${borderColor};
      box-shadow: ${shadowEffect};
    `;

    // Terminal header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid ${headerBorder};
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${headerBackground};
      border-radius: 8px 8px 0 0;
      margin: -20px -20px 16px -20px;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; gap: 8px;';
    ['#ff5f56', '#ffbd2e', '#27ca3f'].forEach(color => {
      const dot = document.createElement('div');
      dot.style.cssText = `width: 12px; height: 12px; border-radius: 50%; background: ${color};`;
      headerLeft.appendChild(dot);
    });

    const headerTitle = document.createElement('span');
    headerTitle.textContent = `Terminal Session — ${deviceName}`;
    headerTitle.style.cssText = `color: ${isDark ? '#8b949e' : '#6b7280'}; font-size: 14px; font-weight: 500;`;

    const headerRight = document.createElement('span');
    headerRight.textContent = new Date().toLocaleString();
    headerRight.style.cssText = `color: ${isDark ? '#6b7280' : '#9ca3af'}; font-size: 12px;`;

    header.appendChild(headerLeft);
    header.appendChild(headerTitle);
    header.appendChild(headerRight);
    container.appendChild(header);

    // Session content
    if (parsedSession) {
      parsedSession.frames.forEach((frame, index) => {
        const frameDiv = document.createElement('div');
        frameDiv.style.marginBottom = '2px';

        // Timestamp for commands
        if (frame.commandContext?.isCommand) {
          const timestamp = document.createElement('div');
          timestamp.textContent = `[${new Date(frame.timestamp).toLocaleTimeString()}]`;
          timestamp.style.cssText = `font-size: 11px; color: ${isDark ? '#666' : '#888'}; margin-bottom: 4px; font-style: italic;`;
          frameDiv.appendChild(timestamp);
        }

        // Frame content with improved color scheme
        const content = document.createElement('div');
        content.style.cssText = `
          white-space: pre;
          overflow-x: auto;
          font-family: "JetBrains Mono", "Courier New", monospace;
          font-size: 14px;
          line-height: 1.2;
        `;
        
        // Apply content with improved color scheme
        let processedContent = frame.highlightedContent || frame.cleanContent;
        
        // Replace problematic colors with better alternatives for both themes
        if (isDark) {
          // Dark theme color improvements
          processedContent = processedContent
            .replace(/color:\s*#[fF][fF][aA][5][0-9a-fA-F][0-9a-fA-F]/g, 'color: #22d3ee') // Replace yellow with cyan
            .replace(/color:\s*#[fF][fF][8][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/g, 'color: #a78bfa') // Replace orange with purple
            .replace(/color:\s*yellow/gi, 'color: #22d3ee')
            .replace(/color:\s*orange/gi, 'color: #a78bfa')
            .replace(/color:\s*#ffff[0-9a-fA-F][0-9a-fA-F]/gi, 'color: #22d3ee') // Generic yellow variants
            .replace(/color:\s*#ff[a-fA-F0-9][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/gi, 'color: #f472b6'); // Generic orange/red variants to pink
        } else {
          // Light theme color improvements
          processedContent = processedContent
            .replace(/color:\s*#[fF][fF][aA][5][0-9a-fA-F][0-9a-fA-F]/g, 'color: #0891b2') // Replace yellow with dark cyan
            .replace(/color:\s*#[fF][fF][8][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/g, 'color: #7c3aed') // Replace orange with dark purple
            .replace(/color:\s*yellow/gi, 'color: #0891b2')
            .replace(/color:\s*orange/gi, 'color: #7c3aed')
            .replace(/color:\s*#ffff[0-9a-fA-F][0-9a-fA-F]/gi, 'color: #0891b2') // Generic yellow variants
            .replace(/color:\s*#ff[a-fA-F0-9][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/gi, 'color: #dc2626') // Generic orange/red variants to red
            .replace(/color:\s*#[a-fA-F0-9]{6}/g, (match) => {
              // Make sure all light colors are dark enough for light background
              const color = match.replace('color: ', '');
              const r = parseInt(color.substr(1, 2), 16);
              const g = parseInt(color.substr(3, 2), 16);
              const b = parseInt(color.substr(5, 2), 16);
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              if (brightness > 180) {
                // Too bright for light background, darken it
                return `color: #${Math.floor(r * 0.4).toString(16).padStart(2, '0')}${Math.floor(g * 0.4).toString(16).padStart(2, '0')}${Math.floor(b * 0.4).toString(16).padStart(2, '0')}`;
              }
              return match;
            });
        }
        
        content.innerHTML = processedContent;
        frameDiv.appendChild(content);

        // Command indicator
        if (frame.commandContext?.isCommand && frame.commandContext.command) {
          const cmdIndicator = document.createElement('div');
          cmdIndicator.textContent = `↑ Command: ${frame.commandContext.command}`;
          cmdIndicator.style.cssText = `font-size: 11px; color: ${isDark ? '#608b4e' : '#16a34a'}; margin-top: 2px; font-style: italic;`;
          frameDiv.appendChild(cmdIndicator);
        }

        container.appendChild(frameDiv);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.textContent = 'No session data available for export';
      placeholder.style.cssText = `color: ${isDark ? '#8b949e' : '#9ca3af'}; text-align: center; padding: 40px; font-style: italic;`;
      container.appendChild(placeholder);
    }

    return container;
  };

  const handlePNGExport = async () => {
    let elementToCapture = terminalElement;
    
    // If no terminal element, create virtual one from parsed session
    if (!elementToCapture && parsedSession) {
      elementToCapture = createVirtualTerminalElement(exportTheme);
      document.body.appendChild(elementToCapture);
    }

    if (!elementToCapture) {
      throw new Error('No terminal content available for PNG export');
    }

    try {
      const canvas = await html2canvas(elementToCapture, {
        backgroundColor: exportTheme === 'dark' ? '#1a1a1a' : '#ffffff',
        scale: 2, // High DPI for better quality
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${deviceName}_terminal_${new Date().toISOString().slice(0, 10)}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } finally {
      // Clean up virtual element if we created one
      if (!terminalElement && elementToCapture?.parentNode) {
        elementToCapture.parentNode.removeChild(elementToCapture);
      }
    }
  };

  const handlePDFExport = async () => {
    let elementToCapture = terminalElement;
    
    // If no terminal element, create virtual one from parsed session
    if (!elementToCapture && parsedSession) {
      elementToCapture = createVirtualTerminalElement(exportTheme);
      document.body.appendChild(elementToCapture);
    }

    if (!elementToCapture) {
      throw new Error('No terminal content available for PDF export');
    }

    try {
      const canvas = await html2canvas(elementToCapture, {
        backgroundColor: exportTheme === 'dark' ? '#1a1a1a' : '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Calculate dimensions to fit the page
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;

      // Add the terminal image (no extra header needed - it's already in the image)
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      pdf.save(`${deviceName}_terminal_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      // Clean up virtual element if we created one
      if (!terminalElement && elementToCapture?.parentNode) {
        elementToCapture.parentNode.removeChild(elementToCapture);
      }
    }
  };

  return (
    <div 
      className="export-dialog-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div 
        ref={dialogRef}
        className="export-dialog"
        style={{
          backgroundColor: 'rgba(var(--background-rgb), 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(var(--border-rgb), 0.8)',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'rgb(var(--foreground-rgb))',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em'
          }}>
            Export Terminal Session
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'rgb(var(--secondary-rgb))',
            margin: 0,
            lineHeight: '1.5'
          }}>
            Choose your preferred export format for the terminal session
          </p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
          }}>
            {(Object.keys(formatDescriptions) as ExportFormat[]).map((format) => (
              <div
                key={format}
                onClick={() => setSelectedFormat(format)}
                style={{
                  padding: '16px',
                  backgroundColor: selectedFormat === format 
                    ? 'rgba(var(--primary-rgb), 0.2)' 
                    : 'rgba(var(--border-rgb), 0.2)',
                  border: selectedFormat === format 
                    ? '1px solid rgba(var(--primary-rgb), 0.5)' 
                    : '1px solid rgba(var(--border-rgb), 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)'
                }}
                onMouseEnter={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFormat !== format) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.3)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                    {formatIcons[format]}
                  </div>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'rgb(var(--foreground-rgb))',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {format}
                  </span>
                  {(format === 'pdf' || format === 'png') && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '10px',
                      fontWeight: '500',
                      color: 'rgb(var(--success-rgb))',
                      backgroundColor: 'rgba(var(--success-rgb), 0.2)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      NEW
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: '13px',
                  color: 'rgb(var(--secondary-rgb))',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {formatDescriptions[format]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Theme Toggle - Only show for visual exports (PNG/PDF) */}
        {(selectedFormat === 'png' || selectedFormat === 'pdf') && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'rgb(var(--foreground-rgb))',
              display: 'block',
              marginBottom: '8px'
            }}>
              Export Theme
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              padding: '4px',
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(var(--border-rgb), 0.2)'
            }}>
              <button
                type="button"
                onClick={() => setExportTheme('dark')}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  backgroundColor: exportTheme === 'dark' 
                    ? 'rgb(var(--foreground-rgb))' 
                    : 'transparent',
                  color: exportTheme === 'dark' 
                    ? 'rgb(var(--background-rgb))' 
                    : 'rgb(var(--foreground-rgb))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 0 0 0 21 12.79z"/>
                </svg>
                Dark Mode
              </button>
              <button
                type="button"
                onClick={() => setExportTheme('light')}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  backgroundColor: exportTheme === 'light' 
                    ? 'rgb(var(--foreground-rgb))' 
                    : 'transparent',
                  color: exportTheme === 'light' 
                    ? 'rgb(var(--background-rgb))' 
                    : 'rgb(var(--foreground-rgb))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                Light Mode
              </button>
            </div>
            <p style={{
              fontSize: '12px',
              color: 'rgb(var(--secondary-rgb))',
              margin: '6px 0 0 0',
              lineHeight: '1.4'
            }}>
              Light mode is recommended for printing. Both themes include 3D shadow effects.
            </p>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(var(--border-rgb), 0.6)',
              borderRadius: '8px',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              opacity: isExporting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgb(var(--success-rgb))',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              opacity: isExporting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isExporting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Exporting...
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {formatIcons[selectedFormat]}
                </div>
                Export {selectedFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}; 