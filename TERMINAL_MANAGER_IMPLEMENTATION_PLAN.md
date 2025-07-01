# Terminal Manager Implementation Plan

## Overview
This document outlines the step-by-step implementation of a unified Terminal Manager system that replaces the current modal-based terminal approach with a persistent, session-based terminal management system.

## Current Issues to Address

### 1. Tab Completion Command Building
- **Problem**: Tab completion fragments are being logged separately instead of building complete commands
- **Impact**: History shows partial commands like `ip` instead of complete commands like `ip firewall filter print`

### 2. Duplicate Session Creation
- **Problem**: Multiple sessions being created for the same device connection
- **Impact**: Blank sessions, deletion dependencies, confusing UX

### 3. Session Management Dependencies
- **Problem**: Cannot delete certain sessions until others are deleted first
- **Impact**: Poor user experience, data inconsistency

## New Architecture: Unified Terminal Manager

### Core Concept
Replace individual terminal modals with a centralized Terminal Manager that:
- Manages persistent terminal sessions across all pages
- Provides session history and management in one place
- Allows users to start/stop/resume terminal sessions
- Maintains session state when navigating between pages

## Implementation Steps

### Phase 1: Backend Session Management Fixes ✅ **COMPLETED**

#### Step 1.1: Fix Session Creation Logic ✅ **COMPLETED**
**File**: `packages/network-portal/server/lib/websocket-server.ts`

**Implemented**:
- ✅ Added session deduplication logic to check for existing active sessions
- ✅ Resume existing sessions instead of creating duplicates
- ✅ Auto-close multiple duplicate sessions during connection
- ✅ Added session info messaging to client
- ✅ Enhanced logging for session resume/creation tracking

**Key Changes**:
```typescript
// Check for existing active sessions for this device
const existingActiveSessions = this.db.prepare(`
  SELECT id, session_name, start_time 
  FROM terminal_sessions 
  WHERE device_id = ? AND status = 'active'
  ORDER BY last_activity DESC
`).all(deviceId);

if (existingActiveSessions.length > 0) {
  // Resume the most recent active session instead of creating a new one
  sessionId = existingActiveSessions[0].id;
  isResumedSession = true;
  // Update last activity and close duplicates
}
```

#### Step 1.2: Enhanced Command Building Logic ✅ **COMPLETED**
**File**: `packages/network-portal/server/lib/ssh-proxy.ts`

**Implemented**:
- ✅ Created `CommandBuilder` class for intelligent tab completion handling
- ✅ Enhanced command tracking with duration measurement
- ✅ Improved tab completion detection and buffering
- ✅ Updated `TerminalSession` interface to include CommandBuilder
- ✅ Modified processUserInput to use new command building logic
- ✅ Added command duration tracking to database logs

**Key Features**:
```typescript
class CommandBuilder {
  processInput(data: string): { isComplete: boolean; command?: string; duration?: number } {
    // Detect tab completion sequences without fragmenting commands
    // Build complete commands from user input
    // Track command duration from start to completion
    // Return complete commands only when Enter is pressed
  }
}
```

#### Step 1.3: Session Cleanup and Deduplication ✅ **COMPLETED**
**Files**: 
- `packages/network-portal/server/routes/terminal.ts`
- `packages/network-portal/src/app/api/terminal/sessions/cleanup/route.ts`

**Implemented**:
- ✅ Added comprehensive cleanup endpoint with transaction support
- ✅ Duplicate session detection and auto-closure
- ✅ Orphaned data cleanup (logs, bookmarks, exports)
- ✅ Configurable cleanup with dry-run support
- ✅ Device-specific and time-based cleanup options
- ✅ Next.js API proxy route with authentication forwarding

**Endpoint Features**:
```typescript
POST /api/terminal/sessions/cleanup
{
  deviceId?: string,        // Optional: clean specific device
  olderThanHours?: number,  // Default: 24 hours
  dryRun?: boolean         // Default: false
}
```

**Cleanup Operations**:
- Duplicate active session detection and closure
- Old session removal (configurable age)
- Orphaned logs, bookmarks, and exports cleanup
- Transaction-based operations for data consistency

### Phase 2: Frontend Terminal Manager Component

#### Step 2.1: Create Unified Terminal Manager
**File**: `packages/network-portal/src/components/terminal/UnifiedTerminalManager.tsx`

**Features**:
- Session list with status indicators
- Active terminal interface
- Session history viewer
- Session management controls
- Device selection dropdown
- Persistent session state

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Terminal Manager                                    [X] │
├─────────────────────────────────────────────────────────┤
│ Device: [Sub_903 ▼]  Sessions: [2 Active] [5 Total]   │
├─────────────────┬───────────────────────────────────────┤
│ Sessions        │ Active Terminal                       │
│ ├ Sub_903 (●)   │ [ncutech@MCU_Sub903_VPNbridge] >     │
│ ├ Sub_904 (○)   │                                       │
│ └ Sub_905 (○)   │                                       │
│                 │                                       │
│ [New Session]   │                                       │
│ [History]       │                                       │
│ [Export All]    │                                       │
└─────────────────┴───────────────────────────────────────┘
```

#### Step 2.2: Session State Management ✅ **COMPLETED**
**File**: `packages/network-portal/src/hooks/use-terminal-manager.ts`

**Implemented**:
- ✅ Global session state management with persistence
- ✅ Session persistence across page navigation using localStorage
- ✅ WebSocket connection management with automatic reconnection
- ✅ Session lifecycle management (create, resume, close, select)
- ✅ Session operations (cleanup, export)
- ✅ Connection management for terminal display
- ✅ Error handling and state management

### Phase 3: Page Integration

#### Step 3.1: Replace Device Page Modals ✅ **COMPLETED**
**File**: `packages/network-portal/src/app/devices/page.tsx`

**Implemented**:
- ✅ Replaced individual "Terminal" and "Session History" buttons with single "Terminal Manager" button
- ✅ Updated both desktop table view and mobile card view
- ✅ Replaced TerminalSessionManager modal with UnifiedTerminalManager modal
- ✅ Removed old Terminal modal component
- ✅ Updated state management to use showTerminalManager instead of separate session states
- ✅ Unified button styling with consistent color scheme (indigo theme)
- ✅ Modal opens the new Unified Terminal Manager with all device sessions

#### Step 3.2: Update Configuration Page
**File**: `packages/network-portal/src/app/(dashboard)/configuration/[id]/page.tsx`

**Changes**:
- Replace terminal tab content with Terminal Manager
- Remove tab-specific terminal component
- Integrate Terminal Manager directly

### Phase 4: Enhanced Features

#### Step 4.1: Session Persistence
**Implementation**:
- Store active session IDs in localStorage
- Reconnect to active sessions on page load
- Maintain session state during navigation

#### Step 4.2: Multi-Device Support
**Features**:
- Switch between device sessions in one interface
- Concurrent session management
- Device-specific session history

#### Step 4.3: Advanced Session Management
**Features**:
- Session bookmarking
- Session sharing/export
- Session templates
- Automated session cleanup

## Technical Implementation Details

### Database Schema Updates

#### Add Session Status Tracking
```sql
ALTER TABLE terminal_sessions ADD COLUMN last_activity DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE terminal_sessions ADD COLUMN connection_id TEXT;
CREATE INDEX idx_terminal_sessions_status_device ON terminal_sessions(status, device_id);
```

### WebSocket Connection Management

#### Connection Pooling
```typescript
class TerminalConnectionPool {
  private connections: Map<string, SSHConnection> = new Map();
  
  getOrCreateConnection(deviceId: string, sessionId: string): SSHConnection {
    // Implement connection reuse logic
  }
  
  closeConnection(sessionId: string): void {
    // Cleanup and close connection
  }
}
```

### Session State Synchronization

#### Real-time Updates
```typescript
// WebSocket events for session state changes
interface SessionStateEvent {
  type: 'session_created' | 'session_ended' | 'session_updated';
  sessionId: string;
  deviceId: string;
  status: SessionStatus;
}
```

## Testing Strategy

### Unit Tests
- Session creation/deduplication logic
- Command building and parsing
- WebSocket connection management

### Integration Tests
- End-to-end session lifecycle
- Multi-device session management
- Page navigation with active sessions

### User Acceptance Tests
- Terminal Manager workflow
- Session persistence across navigation
- Command history accuracy

## Migration Plan

### Phase 1: Backend Fixes (Week 1)
1. Implement session deduplication
2. Fix command building logic
3. Add cleanup endpoints
4. Database schema updates

### Phase 2: Frontend Development (Week 2)
1. Create UnifiedTerminalManager component
2. Implement session state management
3. Build terminal interface
4. Add session management features

### Phase 3: Integration (Week 3)
1. Replace existing terminal modals
2. Update page components
3. Implement session persistence
4. Add multi-device support

### Phase 4: Testing & Polish (Week 4)
1. Comprehensive testing
2. Performance optimization
3. User experience improvements
4. Documentation updates

## Success Metrics

### Technical Metrics
- Zero duplicate sessions created
- 100% command completion accuracy in history
- < 500ms session switching time
- 99.9% session persistence across navigation

### User Experience Metrics
- Single click access to terminal management
- Persistent sessions across page navigation
- Complete command history capture
- Intuitive session management interface

## Risk Mitigation

### Potential Issues
1. **WebSocket connection limits**: Implement connection pooling
2. **Session state conflicts**: Add conflict resolution logic
3. **Performance with many sessions**: Implement pagination and cleanup
4. **Browser refresh handling**: Store critical state in localStorage

### Rollback Plan
- Keep existing terminal components as fallback
- Feature flag for new Terminal Manager
- Gradual rollout with monitoring
- Quick revert capability if issues arise

## Future Enhancements

### Advanced Features
- Terminal session recording/playback
- Collaborative terminal sessions
- Terminal automation/scripting
- Integration with configuration management
- Terminal session analytics

### Performance Optimizations
- Virtual scrolling for large histories
- Command output compression
- Selective session loading
- Background session maintenance

## Conclusion

This implementation plan provides a comprehensive approach to creating a unified Terminal Manager that addresses current issues while providing a superior user experience. The phased approach ensures minimal disruption while delivering significant improvements in functionality and usability. 