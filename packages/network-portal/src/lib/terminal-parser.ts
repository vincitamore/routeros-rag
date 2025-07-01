/**
 * Enhanced Terminal Data Parser
 * 
 * Parses raw terminal data logs and converts them to a clean, modern display format
 * using native ANSI escape code conversion for perfect syntax highlighting.
 * Maintains RouterOS command intelligence for enhanced features.
 */

import { AnsiUp } from 'ansi_up';

export interface TerminalFrame {
  timestamp: number;
  type: 'input' | 'output';
  content: string;
  cleanContent: string;
  highlightedContent: string; // Content with ANSI-to-HTML conversion
  commandContext?: {
    isCommand: boolean;
    command?: string;
    isTabCompletion?: boolean;
    isPrompt?: boolean;
    routerOSContext?: {
      isRouterOSCommand: boolean;
      commandCategory?: string;
      commandName?: string;
      parameters?: string[];
    };
  };
}

export interface ParsedTerminalSession {
  frames: TerminalFrame[];
  totalDuration: number;
  commandCount: number;
  routerOSCommandCount: number;
}

/**
 * RouterOS command categories and commands for intelligent detection
 */
const ROUTEROS_COMMANDS: Record<string, string[]> = {
  // System commands
  system: ['resource', 'identity', 'clock', 'license', 'package', 'backup', 'reset-configuration', 'reboot', 'shutdown'],
  
  // Interface commands
  interface: ['print', 'monitor', 'set', 'add', 'remove', 'enable', 'disable', 'comment'],
  
  // IP commands
  ip: ['address', 'route', 'dns', 'dhcp-server', 'dhcp-client', 'firewall', 'service', 'arp', 'neighbor'],
  
  // Routing commands
  routing: ['ospf', 'bgp', 'rip', 'static', 'table'],
  
  // User management
  user: ['print', 'add', 'remove', 'set', 'active', 'group'],
  
  // Tools
  tool: ['ping', 'traceroute', 'bandwidth-test', 'speed-test', 'netwatch', 'sniffer', 'profile'],
  
  // Firewall
  firewall: ['filter', 'nat', 'mangle', 'raw', 'address-list', 'service-port'],
  
  // File operations
  file: ['print', 'remove', 'copy', 'move'],
  
  // Import/Export
  export: [],
  import: [],
  
  // Queue
  queue: ['simple', 'tree', 'type'],
  
  // Bridge
  bridge: ['print', 'add', 'remove', 'set', 'port'],
  
  // VLAN
  vlan: ['print', 'add', 'remove', 'set'],
  
  // Wireless
  wireless: ['print', 'scan', 'connect', 'disconnect', 'security-profiles'],
  
  // PPP
  ppp: ['secret', 'profile', 'active', 'interface'],
  
  // Certificate
  certificate: ['print', 'add', 'remove', 'import', 'export'],
  
  // Logs
  log: ['print', 'info', 'warning', 'error', 'critical']
};

export class TerminalDataParser {
  private static ansiConverter = new AnsiUp();
  
  static {
    // Configure ANSI converter for terminal-like appearance
    this.ansiConverter.use_classes = false; // Use inline styles for better compatibility
    this.ansiConverter.escape_html = true;  // Always escape HTML for security
  }

  /**
   * Parse raw terminal log data into structured frames with ANSI conversion
   */
  static parseTerminalLogs(logs: any[]): ParsedTerminalSession {
    const frames: TerminalFrame[] = [];
    let commandCount = 0;
    let routerOSCommandCount = 0;
    let startTime: number | null = null;
    
    for (const log of logs.filter(l => l.raw_data)) {
      const timestamp = new Date(log.timestamp).getTime();
      if (startTime === null) startTime = timestamp;
      
      const relativeTime = timestamp - startTime;
      const isInput = log.is_input === 1;
      const rawContent = log.content;
      
      // Clean content for analysis while preserving ANSI codes for conversion
      const cleanContent = this.cleanForDisplay(rawContent);
      
      // Convert ANSI codes to HTML - this preserves the terminal's native syntax highlighting
      const highlightedContent = this.convertAnsiToHtml(rawContent, cleanContent, isInput);
      
      // Analyze command context with RouterOS intelligence
      const commandContext = this.analyzeCommandContext(rawContent, cleanContent, isInput);
      if (commandContext?.isCommand) {
        commandCount++;
        if (commandContext.routerOSContext?.isRouterOSCommand) {
          routerOSCommandCount++;
        }
      }
      
      frames.push({
        timestamp: relativeTime,
        type: isInput ? 'input' : 'output',
        content: rawContent,
        cleanContent,
        highlightedContent,
        commandContext
      });
    }
    
    const totalDuration = frames.length > 0 ? 
      Math.max(...frames.map(f => f.timestamp)) : 0;
    
    return {
      frames: this.groupFrames(frames),
      totalDuration,
      commandCount,
      routerOSCommandCount
    };
  }
  
  /**
   * Convert ANSI escape codes to HTML while preserving terminal syntax highlighting
   */
  private static convertAnsiToHtml(rawContent: string, cleanContent: string, isInput: boolean): string {
    if (!rawContent.trim()) return cleanContent;
    
    try {
      // First, try to convert ANSI codes to HTML
      const ansiConverted = this.ansiConverter.ansi_to_html(rawContent);
      
      // If ANSI conversion produced meaningful output, use it
      if (ansiConverted && ansiConverted !== cleanContent && ansiConverted.includes('<span')) {
        return ansiConverted;
      }
      
      // Fallback: Apply enhanced RouterOS highlighting to clean content
      return this.applyEnhancedRouterOSHighlighting(cleanContent, isInput);
      
    } catch (error) {
      console.warn('ANSI conversion failed, falling back to RouterOS highlighting:', error);
      return this.applyEnhancedRouterOSHighlighting(cleanContent, isInput);
    }
  }
  
  /**
   * Enhanced RouterOS syntax highlighting as fallback
   */
  private static applyEnhancedRouterOSHighlighting(content: string, isInput: boolean): string {
    if (!content.trim()) return content;
    
    let highlighted = this.escapeHtml(content);
    
    // Only apply highlighting if it looks like RouterOS content or is user input
    if (isInput || this.looksLikeRouterOSContent(content)) {
      // Apply highlighting in specific order to prevent conflicts
      
      // 1. RouterOS prompts (purple)
      highlighted = highlighted.replace(
        /(\[admin@[^\]]+\])/g,
        '<span style="color: #b266ff; font-weight: 600;">$1</span>'
      );
      
      // 2. IP addresses (red)
      highlighted = highlighted.replace(
        /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)\b/g,
        '<span style="color: #ff6666;">$1</span>'
      );
      
      // 3. MAC addresses (cyan)
      highlighted = highlighted.replace(
        /\b([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})\b/g,
        '<span style="color: #66ffff;">$1</span>'
      );
      
      // 4. Version numbers and specific patterns
      highlighted = highlighted.replace(
        /version:\s*(\d+\.\d+\.\d+)/g,
        'version: <span style="color: #ffff66;">$1</span>'
      );
      
      // 5. Memory/disk values
      highlighted = highlighted.replace(
        /(\d+\.?\d*)(MiB|GiB|KiB|MHz|GHz|MB|GB|KB)/g,
        '<span style="color: #ffff66;">$1</span><span style="color: #ff9966;">$2</span>'
      );
      
      // 6. RouterOS commands (comprehensive list)
      const allCommands = Object.values(ROUTEROS_COMMANDS).flat();
      const commandPattern = new RegExp(`\\b(${allCommands.join('|')})\\b(?![^<]*>)`, 'g');
      highlighted = highlighted.replace(commandPattern, '<span style="color: #66b3ff; font-weight: 500;">$1</span>');
      
      // 7. RouterOS main command categories
      const categories = Object.keys(ROUTEROS_COMMANDS);
      const categoryPattern = new RegExp(`\\b(${categories.join('|')})\\b(?![^<]*>)`, 'g');
      highlighted = highlighted.replace(categoryPattern, '<span style="color: #66b3ff; font-weight: 500;">$1</span>');
      
      // 8. Parameters (word=value, but not inside existing spans)
      highlighted = highlighted.replace(
        /(\w+)=(?![^<]*>)/g,
        '<span style="color: #ff9966;">$1</span>='
      );
      
      // 9. Flags and status indicators
      highlighted = highlighted.replace(
        /\b(enabled|disabled|active|inactive|running|stopped|up|down|connected|disconnected)\b/gi,
        '<span style="color: #66ff66;">$1</span>'
      );
      
      // 10. Error and warning keywords
      highlighted = highlighted.replace(
        /\b(error|fail|failed|warning|critical|timeout|invalid|denied)\b/gi,
        '<span style="color: #ff4444; font-weight: 600;">$1</span>'
      );
    }
    
    return highlighted;
  }

  /**
   * Clean terminal content for display while preserving important formatting
   * This version is less aggressive to preserve more ANSI codes for conversion
   */
  private static cleanForDisplay(content: string): string {
    let cleaned = content;
    
    // Remove only the most problematic ANSI sequences, preserve color codes
    
    // Remove cursor position reports and device status reports
    cleaned = cleaned.replace(/\x1b\[[\d;]*[RcH]/g, '');
    cleaned = cleaned.replace(/\x1b\[[0-9;?]*[nR]/g, '');
    cleaned = cleaned.replace(/\x1b\[[\d;]*[ABCD]/g, ''); // Cursor movement
    cleaned = cleaned.replace(/\x1b\[[\d;]*[JK]/g, ''); // Erase functions
    
    // Remove VT100/VT220/xterm specific sequences that don't affect display
    cleaned = cleaned.replace(/\x1b\[\?[\d;]*[lh]/g, '');
    cleaned = cleaned.replace(/\x1b\[\d*[~]/g, ''); // Function keys
    
    // Remove character set selection and keypad mode
    cleaned = cleaned.replace(/\x1b[\(\)][AB012]/g, '');
    cleaned = cleaned.replace(/\x1b[=>]/g, '');
    cleaned = cleaned.replace(/\x1b[78]/g, ''); // Save/restore cursor
    
    // Remove OSC sequences (window title, etc.)
    cleaned = cleaned.replace(/\x1b\][0-9;]*;[^\x07\x1b]*(\x07|\x1b\\)/g, '');
    
    // Remove device attributes
    cleaned = cleaned.replace(/\x1b\[[0-9;]+c/g, '');
    
    // Remove most control characters except newlines, tabs, and carriage returns
    // But preserve ESC sequences that might be color codes
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F-\x9F]/g, '');
    
    // Normalize line endings but preserve spacing for ASCII art
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Don't collapse spaces for ASCII art - preserve exact formatting
    // Only remove truly excessive newlines (more than 3)
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
    
    return cleaned.trim();
  }

  /**
   * Analyze command context with enhanced RouterOS intelligence
   */
  private static analyzeCommandContext(rawContent: string, cleanContent: string, isInput: boolean): TerminalFrame['commandContext'] {
    const trimmed = cleanContent.trim();
    
    if (isInput) {
      // Check if this is a completed command (ends with enter)
      const isCommand = rawContent.includes('\r') || rawContent.includes('\n');
      
      // Check if this contains tab completion
      const isTabCompletion = rawContent.includes('\t');
      
      let command: string | undefined;
      let routerOSContext: any = undefined;
      
      if (isCommand) {
        // Extract the actual command (everything before the newline)
        const lines = cleanContent.split('\n').filter(line => line.trim());
        command = lines[0]?.trim();
        
        // Filter out very short or empty commands
        if (command && command.length < 2) {
          command = undefined;
        }
        
        // Analyze RouterOS command context
        if (command) {
          routerOSContext = this.analyzeRouterOSCommand(command);
        }
      }
      
      return {
        isCommand: isCommand && !!command && command.length > 0,
        command,
        isTabCompletion,
        routerOSContext
      };
    } else {
      // Output analysis
      const isPrompt = this.isPrompt(trimmed);
      
      return {
        isCommand: false,
        isPrompt
      };
    }
  }

  /**
   * Analyze RouterOS command for intelligent categorization
   */
  private static analyzeRouterOSCommand(command: string): any {
    const parts = command.toLowerCase().split(/\s+/);
    if (parts.length === 0) return { isRouterOSCommand: false };
    
    const firstPart = parts[0];
    const secondPart = parts[1];
    
    // Check if it's a RouterOS command category
    if (firstPart && ROUTEROS_COMMANDS[firstPart]) {
      const category = firstPart;
      const availableCommands = ROUTEROS_COMMANDS[category];
      
      // Check if second part is a valid command in this category
      const commandName = secondPart || 'print'; // Default to 'print' if no subcommand
      const isValidCommand = !availableCommands || availableCommands.length === 0 || availableCommands.includes(commandName);
      
      // Extract parameters (everything after the command)
      const parameters = parts.slice(2);
      
      return {
        isRouterOSCommand: true,
        commandCategory: category,
        commandName: commandName,
        parameters: parameters
      };
    }
    
    // Check for standalone RouterOS commands
    const allCommands = Object.values(ROUTEROS_COMMANDS).flat();
    if (firstPart && allCommands.includes(firstPart)) {
      return {
        isRouterOSCommand: true,
        commandCategory: 'standalone',
        commandName: firstPart,
        parameters: parts.slice(1)
      };
    }
    
    // Special cases for common RouterOS patterns
    if (firstPart && (firstPart === 'export' || firstPart === 'import')) {
      return {
        isRouterOSCommand: true,
        commandCategory: firstPart,
        commandName: firstPart,
        parameters: parts.slice(1)
      };
    }
    
    return { isRouterOSCommand: false };
  }

  /**
   * Enhanced RouterOS content detection
   */
  private static looksLikeRouterOSContent(content: string): boolean {
    const routerOSIndicators = [
      /\[admin@\w+\]/,  // RouterOS prompt
      /^\s*\d+\s+\w+=/m,  // RouterOS list output
      /flags:/i,
      /RouterOS/i,
      /MikroTik/i,
      /version:\s*\d+\.\d+\.\d+/i,
      /uptime:/i,
      /build-time:/i,
      /factory-software:/i,
      /free-memory:/i,
      /total-memory:/i,
      /architecture-name:/i,
      /board-name:/i,
      /platform:/i
    ];
    
    return routerOSIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Escape HTML characters to prevent XSS
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  /**
   * Check if content is a command prompt
   */
  private static isPrompt(content: string): boolean {
    const promptPatterns = [
      /^\[.*\]\s*>\s*$/,  // RouterOS prompt [admin@device] >
      /^.*@.*:.*\$\s*$/,  // Linux prompt user@host:path$
      /^.*@.*:.*#\s*$/,   // Root prompt user@host:path#
      /^>\s*$/,           // Simple >
      /^#\s*$/,           // Simple #
      /^\$\s*$/           // Simple $
    ];
    
    return promptPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Group related frames together for better display
   */
  private static groupFrames(frames: TerminalFrame[]): TerminalFrame[] {
    if (frames.length === 0) return [];
    
    const grouped: TerminalFrame[] = [];
    let currentGroup: TerminalFrame | null = null;
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame) continue; // Safety check
      
      // Skip completely empty frames
      if (!frame.cleanContent.trim() && !frame.content.trim()) {
        continue;
      }
      
      // Determine if we should group this frame with the current group
      const shouldGroup = currentGroup && this.shouldGroupFrames(currentGroup, frame, frames, i);
      
      if (shouldGroup && currentGroup) {
        // Merge frames intelligently
        this.mergeFrames(currentGroup, frame);
      } else {
        // Start new group
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          timestamp: frame.timestamp,
          type: frame.type,
          content: frame.content,
          cleanContent: frame.cleanContent,
          highlightedContent: frame.highlightedContent,
          commandContext: frame.commandContext
        };
      }
    }
    
    if (currentGroup) {
      grouped.push(currentGroup);
    }
    
    // Post-process to clean up and merge logical sequences
    return this.postProcessFrames(grouped);
  }

  /**
   * Determine if two frames should be grouped together
   */
  private static shouldGroupFrames(current: TerminalFrame, next: TerminalFrame, allFrames: TerminalFrame[], nextIndex: number): boolean {
    // Don't group different types unless it's a very short sequence
    if (current.type !== next.type) {
      return false;
    }
    
    // Don't group if either is a complete command
    if (current.commandContext?.isCommand || next.commandContext?.isCommand) {
      return false;
    }
    
    // Don't group if either is a prompt
    if (current.commandContext?.isPrompt || next.commandContext?.isPrompt) {
      return false;
    }
    
    // Group consecutive output frames if they're close in time and similar content
    const timeDiff = next.timestamp - current.timestamp;
    if (timeDiff < 1000 && current.type === 'output' && next.type === 'output') {
      // Check if content looks like fragments of the same output
      return this.looksLikeFragments(current.cleanContent, next.cleanContent);
    }
    
    return false;
  }
  
  /**
   * Check if two pieces of content look like fragments that should be grouped
   */
  private static looksLikeFragments(content1: string, content2: string): boolean {
    // Very short fragments
    if (content1.length < 50 && content2.length < 50) {
      return true;
    }
    
    // Similar content patterns (same type of output)
    const patterns = [
      /^\s*\d+\s+\w+=/,  // RouterOS list items
      /^\s*flags:/,      // RouterOS flags
      /^\s*\w+:\s*\w+/,  // Key-value pairs
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(content1) && pattern.test(content2)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Merge two frames together
   */
  private static mergeFrames(target: TerminalFrame, source: TerminalFrame): void {
    // Merge content
    target.content += source.content;
    target.cleanContent += '\n' + source.cleanContent;
    target.highlightedContent += '\n' + source.highlightedContent;
    
    // Update timestamp to the later one
    target.timestamp = Math.max(target.timestamp, source.timestamp);
    
    // Merge command context if applicable
    if (source.commandContext?.isCommand && !target.commandContext?.isCommand) {
      target.commandContext = source.commandContext;
    }
  }
  
  /**
   * Post-process frames to clean up and optimize display
   */
  private static postProcessFrames(frames: TerminalFrame[]): TerminalFrame[] {
    return frames.filter(frame => {
      // Remove frames that are just noise
      return !this.isNoiseFrame(frame.cleanContent);
    });
  }
  
  /**
   * Check if a frame contains only noise (empty or meaningless content)
   */
  private static isNoiseFrame(content: string): boolean {
    const trimmed = content.trim();
    
    // Empty content
    if (!trimmed) return true;
    
    // Very short fragments that don't add value
    if (trimmed.length < 3) return true;
    
    // Pure whitespace or control characters
    if (/^[\s\x00-\x1F\x7F-\x9F]*$/.test(trimmed)) return true;
    
    return false;
  }
  
  /**
   * Format timestamp for display
   */
  static formatTimestamp(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `0:${String(seconds).padStart(2, '0')}`;
    }
  }
  
  /**
   * Get command summary from parsed session
   */
  static getCommandSummary(parsedSession: ParsedTerminalSession): Array<{
    command: string;
    timestamp: number;
    duration?: number;
    isRouterOSCommand?: boolean;
    category?: string;
  }> {
    const commands: Array<{
      command: string;
      timestamp: number;
      duration?: number;
      isRouterOSCommand?: boolean;
      category?: string;
    }> = [];
    
    for (let i = 0; i < parsedSession.frames.length; i++) {
      const frame = parsedSession.frames[i];
      if (frame && frame.commandContext?.isCommand && frame.commandContext.command) {
        const nextFrame = parsedSession.frames[i + 1];
        const duration = nextFrame ? nextFrame.timestamp - frame.timestamp : undefined;
        
        commands.push({
          command: frame.commandContext.command,
          timestamp: frame.timestamp,
          duration,
          isRouterOSCommand: frame.commandContext.routerOSContext?.isRouterOSCommand,
          category: frame.commandContext.routerOSContext?.commandCategory
        });
      }
    }
    
    return commands;
  }
} 