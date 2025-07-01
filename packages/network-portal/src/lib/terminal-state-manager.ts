/**
 * Terminal State Manager
 * 
 * Maintains a virtual terminal buffer and processes ANSI escape sequences.
 * Based on best practices from web terminal implementations.
 * 
 * References:
 * - https://medium.com/@buggygm/building-fast-web-terminal-fb7ec801348d
 * - Terminal emulation standards (VT100/VT220/xterm)
 */

export interface TerminalLine {
  content: string;
  styles: Array<{
    start: number;
    end: number;
    color?: string;
    background?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }>;
  dirty: boolean; // Marks if line needs re-rendering
}

export interface TerminalState {
  lines: TerminalLine[];
  cursorX: number;
  cursorY: number;
  width: number;
  height: number;
  currentStyle: {
    color?: string;
    background?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
  dirty: boolean; // Marks if any lines changed
  scrollTop: number;
}

export interface TerminalFrame {
  timestamp: number;
  type: 'command' | 'output' | 'prompt';
  content: string;
  lineNumber: number;
}

export class TerminalStateManager {
  private state: TerminalState;
  private commandBuffer: string = '';
  private lastFrameTime: number = 0;
  private frameBuffer: TerminalFrame[] = [];
  private isInCommand: boolean = false;
  private commandStartTime: number = 0;

  constructor(width: number = 80, height: number = 24) {
    this.state = {
      lines: Array(height).fill(null).map(() => ({
        content: '',
        styles: [],
        dirty: false
      })),
      cursorX: 0,
      cursorY: 0,
      width,
      height,
      currentStyle: {},
      dirty: false,
      scrollTop: 0
    };
  }

  /**
   * Process raw terminal data chunk
   */
  processChunk(data: string, isInput: boolean = false): TerminalFrame[] {
    const now = Date.now();
    
    if (isInput) {
      return this.processInputChunk(data, now);
    } else {
      return this.processOutputChunk(data, now);
    }
  }

  private processInputChunk(data: string, timestamp: number): TerminalFrame[] {
    // Track user input as commands
    this.commandBuffer += data;
    
    // Check if command is complete (contains enter)
    if (data.includes('\r') || data.includes('\n')) {
      const command = this.commandBuffer.trim();
      this.commandBuffer = '';
      
      if (command) {
        const frame: TerminalFrame = {
          timestamp,
          type: 'command',
          content: command,
          lineNumber: this.state.cursorY
        };
        
        return [frame];
      }
    }
    
    return [];
  }

  private processOutputChunk(data: string, timestamp: number): TerminalFrame[] {
    let i = 0;
    const frames: TerminalFrame[] = [];
    let currentContent = '';
    let significantChange = false;

    while (i < data.length) {
      const char = data[i];
      if (!char) {
        i++;
        continue;
      }
      
      if (char === '\x1b') {
        // ANSI escape sequence
        const sequence = this.parseAnsiSequence(data, i);
        if (sequence) {
          const handled = this.handleAnsiSequence(sequence.command, sequence.params);
          if (handled) {
            significantChange = true;
          }
          i = sequence.endIndex;
          continue;
        }
      }
      
      if (char === '\r') {
        // Carriage return - move cursor to beginning of line
        this.state.cursorX = 0;
        i++;
        continue;
      }
      
      if (char === '\n') {
        // Line feed - move to next line
        this.moveCursorToNextLine();
        significantChange = true;
        i++;
        continue;
      }
      
      if (char === '\b') {
        // Backspace
        if (this.state.cursorX > 0) {
          this.state.cursorX--;
          this.setCharAt(this.state.cursorX, this.state.cursorY, ' ');
          significantChange = true;
        }
        i++;
        continue;
      }
      
      // Regular character
      if (char >= ' ' || char === '\t') {
        this.setCharAt(this.state.cursorX, this.state.cursorY, char);
        this.state.cursorX++;
        currentContent += char;
        
        // Handle line wrap
        if (this.state.cursorX >= this.state.width) {
          this.moveCursorToNextLine();
          significantChange = true;
        }
      }
      
      i++;
    }

    // Only create frames for significant changes, not every character
    if (significantChange && currentContent.trim()) {
      // Check if this looks like a meaningful output (not just screen redraws)
      if (this.isSignificantOutput(currentContent)) {
        frames.push({
          timestamp,
          type: this.detectOutputType(currentContent),
          content: currentContent.trim(),
          lineNumber: this.state.cursorY
        });
      }
    }

    return frames;
  }

  private parseAnsiSequence(data: string, startIndex: number): { command: string; params: string[]; endIndex: number } | null {
    if (startIndex >= data.length - 1) return null;
    
    let i = startIndex + 1; // Skip the ESC character
    
    // Handle different ANSI sequence types
    if (data[i] === '[') {
      // CSI (Control Sequence Introducer) sequences
      i++; // Skip '['
      let paramString = '';
      
      while (i < data.length && data[i] >= '0' && data[i] <= '?') {
        paramString += data[i];
        i++;
      }
      
      if (i < data.length) {
        const command = data[i];
        if (command) {
          const params = paramString ? paramString.split(';') : [];
          return {
            command,
            params,
            endIndex: i + 1
          };
        }
      }
    }
    
    return null;
  }

  private handleAnsiSequence(command: string, params: string[]): boolean {
    switch (command) {
      case 'H': // Cursor position
      case 'f': // Cursor position (alternative)
        const row = params[0] ? parseInt(params[0]) - 1 : 0;
        const col = params[1] ? parseInt(params[1]) - 1 : 0;
        this.state.cursorY = Math.max(0, Math.min(row, this.state.height - 1));
        this.state.cursorX = Math.max(0, Math.min(col, this.state.width - 1));
        return true;
        
      case 'A': // Cursor up
        const up = params[0] ? parseInt(params[0]) : 1;
        this.state.cursorY = Math.max(0, this.state.cursorY - up);
        return true;
        
      case 'B': // Cursor down
        const down = params[0] ? parseInt(params[0]) : 1;
        this.state.cursorY = Math.min(this.state.height - 1, this.state.cursorY + down);
        return true;
        
      case 'C': // Cursor right
        const right = params[0] ? parseInt(params[0]) : 1;
        this.state.cursorX = Math.min(this.state.width - 1, this.state.cursorX + right);
        return true;
        
      case 'D': // Cursor left
        const left = params[0] ? parseInt(params[0]) : 1;
        this.state.cursorX = Math.max(0, this.state.cursorX - left);
        return true;
        
      case 'J': // Erase display
        const eraseType = params[0] ? parseInt(params[0]) : 0;
        this.eraseDisplay(eraseType);
        return true;
        
      case 'K': // Erase line
        const eraseLineType = params[0] ? parseInt(params[0]) : 0;
        this.eraseLine(eraseLineType);
        return true;
        
      case 'm': // Set graphics mode (colors, styles)
        this.handleGraphicsMode(params);
        return true;
        
      default:
        return false;
    }
  }

  private eraseDisplay(type: number): void {
    switch (type) {
      case 0: // Erase from cursor to end of screen
        this.eraseLine(0); // Current line from cursor
        for (let y = this.state.cursorY + 1; y < this.state.height; y++) {
          this.clearLine(y);
        }
        break;
        
      case 1: // Erase from beginning of screen to cursor
        for (let y = 0; y < this.state.cursorY; y++) {
          this.clearLine(y);
        }
        this.eraseLine(1); // Current line to cursor
        break;
        
      case 2: // Erase entire screen
        for (let y = 0; y < this.state.height; y++) {
          this.clearLine(y);
        }
        this.state.cursorX = 0;
        this.state.cursorY = 0;
        break;
    }
  }

  private eraseLine(type: number): void {
    if (this.state.cursorY < 0 || this.state.cursorY >= this.state.lines.length) return;
    
    const line = this.state.lines[this.state.cursorY];
    if (!line) return;
    
    switch (type) {
      case 0: // Erase from cursor to end of line
        line.content = line.content.substring(0, this.state.cursorX);
        break;
        
      case 1: // Erase from beginning of line to cursor
        const remaining = line.content.substring(this.state.cursorX);
        line.content = ' '.repeat(this.state.cursorX) + remaining;
        break;
        
      case 2: // Erase entire line
        line.content = '';
        break;
    }
    
    line.dirty = true;
    this.state.dirty = true;
  }

  private clearLine(y: number): void {
    if (y >= 0 && y < this.state.lines.length) {
      this.state.lines[y].content = '';
      this.state.lines[y].styles = [];
      this.state.lines[y].dirty = true;
      this.state.dirty = true;
    }
  }

  private handleGraphicsMode(params: string[]): void {
    if (params.length === 0) params = ['0'];
    
    for (const param of params) {
      const code = parseInt(param);
      
      switch (code) {
        case 0: // Reset
          this.state.currentStyle = {};
          break;
        case 1: // Bold
          this.state.currentStyle.bold = true;
          break;
        case 3: // Italic
          this.state.currentStyle.italic = true;
          break;
        case 4: // Underline
          this.state.currentStyle.underline = true;
          break;
        case 22: // Normal intensity
          this.state.currentStyle.bold = false;
          break;
        case 23: // Not italic
          this.state.currentStyle.italic = false;
          break;
        case 24: // Not underlined
          this.state.currentStyle.underline = false;
          break;
        default:
          if (code >= 30 && code <= 37) {
            // Foreground colors
            this.state.currentStyle.color = this.getAnsiColor(code - 30);
          } else if (code >= 40 && code <= 47) {
            // Background colors
            this.state.currentStyle.background = this.getAnsiColor(code - 40);
          }
          break;
      }
    }
  }

  private getAnsiColor(colorCode: number): string {
    const colors = [
      '#000000', // Black
      '#800000', // Red
      '#008000', // Green
      '#808000', // Yellow
      '#000080', // Blue
      '#800080', // Magenta
      '#008080', // Cyan
      '#c0c0c0'  // White
    ];
    
    return colors[colorCode] || '#ffffff';
  }

  private setCharAt(x: number, y: number, char: string): void {
    if (y < 0 || y >= this.state.height) return;
    
    const line = this.state.lines[y];
    if (!line) return;
    
    // Extend line if necessary
    while (line.content.length <= x) {
      line.content += ' ';
    }
    
    // Replace character
    line.content = line.content.substring(0, x) + char + line.content.substring(x + 1);
    line.dirty = true;
    this.state.dirty = true;
  }

  private moveCursorToNextLine(): void {
    this.state.cursorX = 0;
    this.state.cursorY++;
    
    // Handle scrolling
    if (this.state.cursorY >= this.state.height) {
      this.scrollUp();
      this.state.cursorY = this.state.height - 1;
    }
  }

  private scrollUp(): void {
    // Remove first line and add new empty line at bottom
    this.state.lines.shift();
    this.state.lines.push({
      content: '',
      styles: [],
      dirty: false
    });
    this.state.dirty = true;
  }

  private isSignificantOutput(content: string): boolean {
    // Filter out noise and repetitive screen redraws
    const trimmed = content.trim();
    
    // Skip empty content
    if (!trimmed) return false;
    
    // Skip single characters (likely part of screen redraw)
    if (trimmed.length === 1) return false;
    
    // Skip ASCII art patterns (MikroTik logo fragments)
    if (/^[M\sKTIORG]+$/.test(trimmed)) return false;
    
    // Skip pure whitespace patterns
    if (/^\s+$/.test(trimmed)) return false;
    
    // Accept command output, prompts, and meaningful text
    return true;
  }

  private detectOutputType(content: string): 'command' | 'output' | 'prompt' {
    if (content.includes('[admin@') && content.includes(']')) {
      return 'prompt';
    }
    
    if (content.includes(':') && (content.includes('MiB') || content.includes('MHz') || content.includes('version'))) {
      return 'output';
    }
    
    return 'output';
  }

  /**
   * Get current terminal state for rendering
   */
  getState(): TerminalState {
    return { ...this.state };
  }

  /**
   * Get lines that have changed since last render
   */
  getDirtyLines(): TerminalLine[] {
    return this.state.lines.filter(line => line.dirty);
  }

  /**
   * Mark all lines as clean (after rendering)
   */
  markClean(): void {
    this.state.lines.forEach(line => line.dirty = false);
    this.state.dirty = false;
  }

  /**
   * Get a clean text representation of the current terminal state
   */
  getCleanText(): string {
    return this.state.lines
      .map(line => line.content)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
      .trim();
  }
} 