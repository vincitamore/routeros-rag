export interface TerminalCell {
  char: string;
  fg: number;
  bg: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface TerminalFrame {
  timestamp: number;
  content: string;
  cursor: { x: number; y: number };
  type: 'output' | 'input' | 'prompt';
}

export class TerminalStateManager {
  private buffer: TerminalCell[][] = [];
  private cursor: { x: number; y: number };
  private savedCursor: { x: number; y: number };
  private currentAttributes: {
    fg: number;
    bg: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };
  private width: number;
  private height: number;
  private frames: TerminalFrame[];
  private lastFrameTime: number;
  private inputBuffer: string;
  private promptDetected: boolean;
  private logoFrameCaptured: boolean;

  constructor(width: number = 80, height: number = 24) {
    this.width = width;
    this.height = height;
    this.cursor = { x: 0, y: 0 };
    this.savedCursor = { x: 0, y: 0 };
    this.currentAttributes = {
      fg: 37, // white
      bg: 40, // black
      bold: false,
      italic: false,
      underline: false
    };
    this.frames = [];
    this.lastFrameTime = 0;
    this.inputBuffer = '';
    this.promptDetected = false;
    this.logoFrameCaptured = false;
    this.initializeBuffer();
  }

  private initializeBuffer(): void {
    this.buffer = [];
    for (let y = 0; y < this.height; y++) {
      this.buffer[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.buffer[y]![x] = {
          char: ' ',
          fg: 37,
          bg: 40,
          bold: false,
          italic: false,
          underline: false
        };
      }
    }
  }

  public processData(data: string, direction: 'input' | 'output', timestamp: number): void {
    if (direction === 'input') {
      this.processInput(data, timestamp);
    } else {
      this.processOutput(data, timestamp);
    }
  }

  private processInput(data: string, timestamp: number): void {
    // Track user input for command detection
    this.inputBuffer += data;
    
    // Detect command completion (Enter key)
    if (data.includes('\r') || data.includes('\n')) {
      if (this.inputBuffer.trim().length > 0) {
        this.captureFrame(timestamp, 'input');
      }
      this.inputBuffer = '';
    }
  }

  private processOutput(data: string, timestamp: number): void {
    let i = 0;
    let significantChange = false;

    while (i < data.length) {
      const char = data[i];
      if (!char) {
        i++;
        continue;
      }

      if (char === '\x1b' && i + 1 < data.length && data[i + 1] === '[') {
        // ANSI escape sequence
        const sequence = this.parseAnsiSequence(data, i);
        if (sequence) {
          this.processAnsiSequence(sequence);
          i += sequence.length;
          significantChange = true;
          continue;
        }
      }

      // Regular character
      if (char === '\r') {
        this.cursor.x = 0;
      } else if (char === '\n') {
        this.cursor.y++;
        this.cursor.x = 0;
        if (this.cursor.y >= this.height) {
          this.scrollUp();
          this.cursor.y = this.height - 1;
        }
        significantChange = true;
      } else if (char === '\b') {
        if (this.cursor.x > 0) {
          this.cursor.x--;
        }
      } else if (char === '\t') {
        this.cursor.x = Math.min(this.width - 1, ((this.cursor.x + 8) & ~7));
      } else if (char >= ' ' || char === '\x00') {
        // Printable character or null
        if (this.cursor.x < this.width && this.cursor.y < this.height && this.buffer[this.cursor.y]) {
          this.buffer[this.cursor.y]![this.cursor.x] = {
            char: char === '\x00' ? ' ' : char,
            fg: this.currentAttributes.fg,
            bg: this.currentAttributes.bg,
            bold: this.currentAttributes.bold,
            italic: this.currentAttributes.italic,
            underline: this.currentAttributes.underline
          };
          this.cursor.x++;
          if (this.cursor.x >= this.width) {
            this.cursor.x = 0;
            this.cursor.y++;
            if (this.cursor.y >= this.height) {
              this.scrollUp();
              this.cursor.y = this.height - 1;
            }
          }
          significantChange = true;
        }
      }

      i++;
    }

    // Only capture frames for truly significant changes, not every character
    const currentContent = this.getVisibleContent();
    const isPrompt = this.isPromptLine(currentContent);
    
    // Be much more selective about when to capture frames
    const shouldCapture = this.shouldCaptureFrame(currentContent, timestamp, isPrompt);
    
    if (shouldCapture) {
      this.promptDetected = isPrompt;
      this.captureFrame(timestamp, isPrompt ? 'prompt' : 'output');
    }
  }

  private parseAnsiSequence(data: string, start: number): { sequence: string; length: number } | null {
    if (start + 1 >= data.length || data[start] !== '\x1b' || data[start + 1] !== '[') {
      return null;
    }

    let i = start + 2;
    let sequence = '\x1b[';

    // Find the end of the sequence
    while (i < data.length) {
      const char = data[i];
      if (!char) {
        i++;
        continue;
      }
      sequence += char;
      
      // ANSI sequences end with a letter
      if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
        return { sequence, length: i - start + 1 };
      }
      
      i++;
      
      // Safety limit
      if (i - start > 20) {
        break;
      }
    }

    return null;
  }

  private processAnsiSequence(sequence: { sequence: string; length: number }): void {
    const seq = sequence.sequence;
    const params = seq.slice(2, -1).split(';').map(p => parseInt(p) || 0);
    const command = seq[seq.length - 1];

    switch (command) {
      case 'H': // Cursor position
      case 'f':
        this.cursor.y = Math.max(0, Math.min(this.height - 1, (params[0] || 1) - 1));
        this.cursor.x = Math.max(0, Math.min(this.width - 1, (params[1] || 1) - 1));
        break;
      
      case 'A': // Cursor up
        this.cursor.y = Math.max(0, this.cursor.y - (params[0] || 1));
        break;
      
      case 'B': // Cursor down
        this.cursor.y = Math.min(this.height - 1, this.cursor.y + (params[0] || 1));
        break;
      
      case 'C': // Cursor forward
        this.cursor.x = Math.min(this.width - 1, this.cursor.x + (params[0] || 1));
        break;
      
      case 'D': // Cursor backward
        this.cursor.x = Math.max(0, this.cursor.x - (params[0] || 1));
        break;
      
      case 'J': // Erase display
        if (params[0] === 2) {
          this.clearScreen();
        } else if (params[0] === 0) {
          this.clearFromCursor();
        } else if (params[0] === 1) {
          this.clearToCursor();
        }
        break;
      
      case 'K': // Erase line
        if (params[0] === 2) {
          this.clearLine(this.cursor.y);
        } else if (params[0] === 0) {
          this.clearLineFromCursor();
        } else if (params[0] === 1) {
          this.clearLineToCursor();
        }
        break;
      
      case 'm': // Set graphics mode
        this.processGraphicsMode(params);
        break;
      
      case 's': // Save cursor
        this.savedCursor = { ...this.cursor };
        break;
      
      case 'u': // Restore cursor
        this.cursor = { ...this.savedCursor };
        break;
    }
  }

  private processGraphicsMode(params: number[]): void {
    if (params.length === 0) {
      params = [0];
    }

    for (const param of params) {
      switch (param) {
        case 0: // Reset
          this.currentAttributes = {
            fg: 37,
            bg: 40,
            bold: false,
            italic: false,
            underline: false
          };
          break;
        case 1: // Bold
          this.currentAttributes.bold = true;
          break;
        case 3: // Italic
          this.currentAttributes.italic = true;
          break;
        case 4: // Underline
          this.currentAttributes.underline = true;
          break;
        case 22: // Normal intensity
          this.currentAttributes.bold = false;
          break;
        case 23: // Not italic
          this.currentAttributes.italic = false;
          break;
        case 24: // Not underlined
          this.currentAttributes.underline = false;
          break;
        default:
          if (param >= 30 && param <= 37) {
            this.currentAttributes.fg = param;
          } else if (param >= 40 && param <= 47) {
            this.currentAttributes.bg = param;
          }
          break;
      }
    }
  }

  private scrollUp(): void {
    for (let y = 0; y < this.height - 1; y++) {
      const nextRow = this.buffer[y + 1];
      if (nextRow) {
        this.buffer[y] = [...nextRow];
      }
    }
    // Clear last line
    const lastRow = this.buffer[this.height - 1];
    if (lastRow) {
      for (let x = 0; x < this.width; x++) {
        lastRow[x] = {
          char: ' ',
          fg: 37,
          bg: 40,
          bold: false,
          italic: false,
          underline: false
        };
      }
    }
  }

  private clearScreen(): void {
    this.initializeBuffer();
    this.cursor = { x: 0, y: 0 };
  }

  private clearFromCursor(): void {
    // Clear from cursor to end of screen
    for (let y = this.cursor.y; y < this.height; y++) {
      const row = this.buffer[y];
      if (row) {
        const startX = y === this.cursor.y ? this.cursor.x : 0;
        for (let x = startX; x < this.width; x++) {
          row[x] = {
            char: ' ',
            fg: 37,
            bg: 40,
            bold: false,
            italic: false,
            underline: false
          };
        }
      }
    }
  }

  private clearToCursor(): void {
    // Clear from start of screen to cursor
    for (let y = 0; y <= this.cursor.y; y++) {
      const row = this.buffer[y];
      if (row) {
        const endX = y === this.cursor.y ? this.cursor.x : this.width - 1;
        for (let x = 0; x <= endX; x++) {
          row[x] = {
            char: ' ',
            fg: 37,
            bg: 40,
            bold: false,
            italic: false,
            underline: false
          };
        }
      }
    }
  }

  private clearLine(y: number): void {
    if (y >= 0 && y < this.height) {
      const row = this.buffer[y];
      if (row) {
        for (let x = 0; x < this.width; x++) {
          row[x] = {
            char: ' ',
            fg: 37,
            bg: 40,
            bold: false,
            italic: false,
            underline: false
          };
        }
      }
    }
  }

  private clearLineFromCursor(): void {
    const row = this.buffer[this.cursor.y];
    if (row) {
      for (let x = this.cursor.x; x < this.width; x++) {
        row[x] = {
          char: ' ',
          fg: 37,
          bg: 40,
          bold: false,
          italic: false,
          underline: false
        };
      }
    }
  }

  private clearLineToCursor(): void {
    const row = this.buffer[this.cursor.y];
    if (row) {
      for (let x = 0; x <= this.cursor.x; x++) {
        row[x] = {
          char: ' ',
          fg: 37,
          bg: 40,
          bold: false,
          italic: false,
          underline: false
        };
      }
    }
  }

  private getVisibleContent(): string {
    return this.buffer
      .map(row => row.map(cell => cell.char).join('').trimEnd())
      .filter(line => line.length > 0)
      .join('\n');
  }

  private isPromptLine(content: string): boolean {
    const lines = content.split('\n');
    const lastLine = lines[lines.length - 1] || '';
    
    // RouterOS prompt patterns
    return /\[.*@.*\]\s*[/>]\s*$/.test(lastLine) ||
           /.*[>#$]\s*$/.test(lastLine) ||
           lastLine.includes('Login:') ||
           lastLine.includes('Password:');
  }

  private shouldCaptureFrame(currentContent: string, timestamp: number, isPrompt: boolean): boolean {
    // Special case: Capture one clean logo frame at the beginning
    if (!this.logoFrameCaptured && this.isCleanLogoFrame(currentContent)) {
      this.logoFrameCaptured = true;
      return true;
    }
    
    // Much more aggressive rate limiting - RouterOS redraws screen constantly
    const timeSinceLastFrame = timestamp - this.lastFrameTime;
    
    // Never capture frames closer than 2 seconds apart
    if (timeSinceLastFrame < 2000) {
      return false;
    }
    
    // Don't capture if content is mostly repetitive (like MikroTik logo redraws)
    if (this.isRepetitiveContent(currentContent)) {
      return false;
    }
    
    // Don't capture frames that are just screen redraws with logo
    if (this.isScreenRedrawWithLogo(currentContent)) {
      return false;
    }
    
    // Only capture meaningful command completions or substantial output
    if (isPrompt) {
      // Only capture prompts that show actual navigation changes
      return this.isSignificantPromptChange(currentContent);
    } else {
      // Only capture output that has substantial command results
      return this.isMeaningfulOutput(currentContent);
    }
  }

  private isMeaningfulOutput(content: string): boolean {
    // Filter out noise and repetitive screen redraws
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip if mostly empty
    if (lines.length === 0) return false;
    
    // Skip if it contains MikroTik logo (screen redraw)
    if (this.isScreenRedrawWithLogo(content)) {
      return false;
    }
    
    // Skip if it's mostly ASCII art (MikroTik logo)
    const asciiArtLines = lines.filter(line => /^[M\sKTIORG\-\(\)]+$/.test(line.trim()));
    if (asciiArtLines.length > lines.length * 0.5) {
      return false;
    }
    
    // Look for actual command output patterns - be more strict
    const commandOutputLines = lines.filter(line => {
      const trimmed = line.trim();
      return (
        (trimmed.includes(':') && !trimmed.includes('http')) || // Key-value pairs (not URLs)
        /^\s+\w+:/.test(trimmed) || // Indented key-value pairs
        /^\s*\d+\s+\w/.test(trimmed) || // Numbered lists with content
        (trimmed.includes('MiB') && trimmed.includes(':')) || // Memory info
        (trimmed.includes('MHz') && trimmed.includes(':')) || // CPU info
        /version:\s*\d/.test(trimmed) || // Version info
        /uptime:\s*\d/.test(trimmed) || // Uptime info
        (trimmed.includes('bad command name') && trimmed.length > 10) // Error messages
      );
    });
    
    // Must have at least 3 lines of actual output to be meaningful
    return commandOutputLines.length >= 3;
  }

  private isRepetitiveContent(content: string): boolean {
    // Check if content is mostly the same repeated patterns
    const lines = content.split('\n');
    const uniqueLines = new Set(lines.map(line => line.trim())).size;
    const totalLines = lines.filter(line => line.trim()).length;
    
    // If less than 30% unique lines, it's likely repetitive
    return totalLines > 5 && (uniqueLines / totalLines) < 0.3;
  }

  private isScreenRedrawWithLogo(content: string): boolean {
    // Check if content contains MikroTik logo (indicates screen redraw)
    const logoLines = content.split('\n').filter(line => 
      line.includes('MMM') || 
      line.includes('KKK') || 
      line.includes('MikroTik RouterOS') ||
      line.includes('Press F1 for help')
    );
    
    // If more than 3 logo lines, it's likely a screen redraw
    return logoLines.length > 3;
  }

  private isSignificantPromptChange(content: string): boolean {
    const lastFrame = this.frames[this.frames.length - 1];
    if (!lastFrame) return true; // First frame is always significant
    
    // Extract the actual prompt from both contents
    const currentPrompt = this.extractCurrentPrompt(content);
    const lastPrompt = this.extractCurrentPrompt(lastFrame.content);
    
    // Only capture if the prompt path actually changed
    return currentPrompt !== lastPrompt && currentPrompt.length > 0;
  }

  private extractCurrentPrompt(content: string): string {
    const lines = content.split('\n');
    
    // Find the last line that looks like a RouterOS prompt
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (line && /\[admin@[^\]]+\]\s*[/>]/.test(line)) {
        return line;
      }
    }
    
    return '';
  }

  private isCleanLogoFrame(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Must contain the MikroTik logo
    const hasLogo = lines.some(line => 
      line.includes('MikroTik RouterOS') || 
      (line.includes('MMM') && line.includes('KKK'))
    );
    
    if (!hasLogo) return false;
    
    // Must have a clean prompt at the end
    const hasPrompt = lines.some(line => 
      /\[admin@[^\]]+\]\s*>\s*$/.test(line.trim())
    );
    
    if (!hasPrompt) return false;
    
    // Must have "Press F1 for help"
    const hasHelp = lines.some(line => line.includes('Press F1 for help'));
    
    // Should be a complete, clean initial screen
    return hasHelp && lines.length > 5 && lines.length < 15;
  }

  private captureFrame(timestamp: number, type: 'input' | 'output' | 'prompt'): void {
    const content = this.getVisibleContent();
    
    // Don't capture empty frames
    if (content.trim().length === 0) {
      return;
    }
    
    const lastFrame = this.frames[this.frames.length - 1];
    
    // Don't capture exact duplicates
    if (lastFrame && lastFrame.content === content) {
      return;
    }
    
    // For RouterOS: Don't capture frames that are just screen redraws with minimal changes
    if (lastFrame && this.isMinorRedraw(lastFrame.content, content)) {
      return;
    }
    
    // Only capture significant changes
    if (this.isSignificantChange(lastFrame?.content || '', content, type)) {
      this.frames.push({
        timestamp,
        content,
        cursor: { ...this.cursor },
        type
      });
      
      this.lastFrameTime = timestamp;
    }
  }

  private isMinorRedraw(oldContent: string, newContent: string): boolean {
    // If the content is mostly the same with just cursor position changes
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // If same number of lines and most lines are identical
    if (oldLines.length === newLines.length) {
      let identicalLines = 0;
      for (let i = 0; i < oldLines.length; i++) {
        if (oldLines[i] === newLines[i]) {
          identicalLines++;
        }
      }
      
      // If 90% of lines are identical, it's likely just a cursor move or minor redraw
      if (identicalLines / oldLines.length > 0.9) {
        return true;
      }
    }
    
    return false;
  }

  private isSignificantChange(oldContent: string, newContent: string, type: 'input' | 'output' | 'prompt'): boolean {
    // Always capture the first frame
    if (!oldContent) {
      return true;
    }
    
    // For input: only capture when user actually types something substantial
    if (type === 'input') {
      // Look for actual command progression, not just cursor moves
      const oldPromptLine = this.getLastPromptLine(oldContent);
      const newPromptLine = this.getLastPromptLine(newContent);
      
      // Only capture if the command part actually changed significantly
      if (oldPromptLine && newPromptLine) {
        const oldCommand = this.extractCommand(oldPromptLine);
        const newCommand = this.extractCommand(newPromptLine);
        
        // Only capture if command changed by more than 1 character or completed
        return Math.abs(newCommand.length - oldCommand.length) > 1 || 
               newCommand.includes(' ') || 
               newCommand.includes('/');
      }
    }
    
    // For output: capture new output or command completion
    if (type === 'output') {
      // Check if this is new output (not just a redraw)
      const oldOutputLines = this.getOutputLines(oldContent);
      const newOutputLines = this.getOutputLines(newContent);
      
      // Capture if we have new output lines
      return newOutputLines.length > oldOutputLines.length ||
             this.hasNewNonPromptContent(oldContent, newContent);
    }
    
    // For prompts: capture when prompt actually changes (new directory, etc.)
    if (type === 'prompt') {
      const oldPrompt = this.getLastPromptLine(oldContent);
      const newPrompt = this.getLastPromptLine(newContent);
      return oldPrompt !== newPrompt;
    }
    
    return false;
  }

  private getLastPromptLine(content: string): string {
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (line && (line.includes('>') || line.includes('#') || line.includes('$'))) {
        return line;
      }
    }
    return '';
  }

  private extractCommand(promptLine: string): string {
    const match = promptLine.match(/[>#$]\s*(.*)$/);
    return match ? match[1]?.trim() || '' : '';
  }

  private getOutputLines(content: string): string[] {
    const lines = content.split('\n');
    const outputLines = [];
    
    for (const line of lines) {
      // Skip MikroTik logo lines
      if (line.includes('MMM') || line.includes('KKK') || line.includes('MikroTik')) {
        continue;
      }
      // Skip prompt lines
      if (line.includes('>') || line.includes('#') || line.includes('$')) {
        continue;
      }
      // Skip empty lines
      if (line.trim().length === 0) {
        continue;
      }
      outputLines.push(line);
    }
    
    return outputLines;
  }

  private hasNewNonPromptContent(oldContent: string, newContent: string): boolean {
    const oldNonPrompt = this.getOutputLines(oldContent).join('\n');
    const newNonPrompt = this.getOutputLines(newContent).join('\n');
    
    return newNonPrompt.length > oldNonPrompt.length && 
           newNonPrompt !== oldNonPrompt;
  }

  public getFrames(): TerminalFrame[] {
    return [...this.frames];
  }

  public getFramesSince(timestamp: number): TerminalFrame[] {
    return this.frames.filter(frame => frame.timestamp > timestamp);
  }

  public getLatestFrame(): TerminalFrame | null {
    return this.frames[this.frames.length - 1] || null;
  }

  public reset(): void {
    this.initializeBuffer();
    this.cursor = { x: 0, y: 0 };
    this.savedCursor = { x: 0, y: 0 };
    this.currentAttributes = {
      fg: 37,
      bg: 40,
      bold: false,
      italic: false,
      underline: false
    };
    this.frames = [];
    this.lastFrameTime = 0;
    this.inputBuffer = '';
    this.promptDetected = false;
  }
} 