// Terminal session management types

export interface TerminalSession {
  id: string;
  device_id: string;
  user_id?: string;
  session_name?: string;
  status: 'active' | 'disconnected' | 'closed';
  authentication_method: 'password' | 'key';
  start_time: string;
  end_time?: string;
  last_activity: string;
  total_duration: number;
  command_count: number;
  bytes_transmitted: number;
  client_info?: string;
  // Additional fields from joins
  device_name?: string;
  ip_address?: string;
}

export interface SessionLog {
  id: number;
  session_id: string;
  log_type: 'command' | 'output' | 'system' | 'error';
  content: string;
  timestamp: string;
  sequence_number: number;
  is_input: boolean;
  command_duration?: number;
}

export interface SessionBookmark {
  id: number;
  session_id: string;
  log_id: number;
  bookmark_name: string;
  description?: string;
  tags: string[];
  created_at: string;
  // Additional fields from joins
  log_content?: string;
  log_timestamp?: string;
}

export interface SessionExport {
  id: number;
  session_id: string;
  export_name: string;
  export_format: 'json' | 'txt' | 'html' | 'csv';
  export_data: string;
  export_settings?: string;
  file_size: number;
  created_at: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  ip_address: string;
  username: string;
  port: number;
  use_ssl: boolean;
  status: string;
  terminalAvailable: boolean;
  authMethod: 'password' | 'key';
  sshKeysConfigured: boolean;
}

export interface TerminalConnectionInfo {
  deviceId: string;
  sshAvailable: boolean;
  authMethod: 'password' | 'key';
  message: string;
  timestamp: string;
}

export interface TerminalStatus {
  status: string;
  webSocketClients: number;
  activeSessions: number;
  webSocketPort: string;
  timestamp: string;
}

// Component props interfaces
export interface TerminalSessionManagerProps {
  deviceId: string;
  deviceName: string;
  onSessionSelect?: (session: TerminalSession) => void;
}

export interface SessionHistoryViewerProps {
  sessionId: string;
  showFilters?: boolean;
  allowBookmarks?: boolean;
  allowExport?: boolean;
}

export interface SessionBookmarkManagerProps {
  sessionId: string;
  onBookmarkCreated?: (bookmark: SessionBookmark) => void;
}

export interface SessionExportManagerProps {
  sessionId: string;
  sessionName?: string;
  onExportComplete?: (exportInfo: SessionExport) => void;
}

// API response types
export interface SessionsResponse {
  sessions: TerminalSession[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  timestamp: string;
}

export interface SessionLogsResponse {
  sessionId: string;
  logs: SessionLog[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  timestamp: string;
}

export interface SessionBookmarksResponse {
  sessionId: string;
  bookmarks: SessionBookmark[];
  timestamp: string;
}

export interface CreateBookmarkRequest {
  bookmarkName: string;
  description?: string;
  logId?: number;
  tags?: string[];
}

export interface ExportSessionRequest {
  format: 'json' | 'txt' | 'html' | 'csv';
  name?: string;
  includeOutput?: boolean;
}

// Terminal WebSocket message types
export interface TerminalWebSocketMessage {
  type: 'terminal-connect' | 'terminal-data' | 'terminal-resize' | 'terminal-disconnect' | 'terminal-bookmark' | 'terminal-export';
  deviceId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  sessionId?: string;
  bookmarkName?: string;
  exportFormat?: string;
}

// Terminal session options
export interface TerminalSessionOptions {
  deviceId: string;
  sessionName?: string;
  reconnectOnClose?: boolean;
  maxReconnectAttempts?: number;
  logHistory?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  onCommandExecuted?: (command: string) => void;
} 