# Winbox Streaming Implementation Guide

This document provides step-by-step instructions for implementing the "Open in Winbox" feature using Node.js RDP streaming. This solution allows users to stream Winbox directly to a modal in the browser without requiring client-side setup.

## Architecture Overview

The solution uses a Node.js RDP client to connect to a Windows VM running Winbox, then streams the desktop to the browser via WebSocket and HTML5 Canvas.

```
Browser Modal → WebSocket → Node.js RDP Service → Windows VM → Winbox → RouterOS Device
```

## Prerequisites

- Windows Server/VM with RDP enabled
- Winbox installed on the Windows VM
- Node.js RDP streaming service
- WebSocket server integration

---

## Step 1: Windows VM Setup

### 1.1 Create Windows VM
- Deploy Windows Server 2019/2022 or Windows 11
- Minimum specs: 2 CPU, 4GB RAM, 50GB storage
- Enable RDP access in Windows settings
- Install Winbox on the VM

### 1.2 Configure RDP Access
```powershell
# Enable RDP via PowerShell
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -name "fDenyTSConnections" -value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
```

### 1.3 Create Dedicated User
- Create a dedicated user account for RDP connections
- Add to "Remote Desktop Users" group
- Set strong password and configure auto-login if needed

---

## Step 2: Install Node.js Dependencies

### 2.1 Add RDP and Canvas Dependencies
```bash
cd packages/network-portal
pnpm add node-rdpjs canvas ws sharp
pnpm add -D @types/ws
```

### 2.2 Update package.json Scripts
```json
{
  "scripts": {
    "dev:winbox": "tsx watch server/services/winbox-service.ts",
    "build:winbox": "tsc server/services/winbox-service.ts --outDir dist"
  }
}
```

---

## Step 3: Create Winbox RDP Service

### 3.1 Create RDP Service
Create `packages/network-portal/server/services/winbox-service.ts`:

```typescript
import { createCanvas, Canvas } from 'canvas';
import { WebSocketServer, WebSocket } from 'ws';
import { RDPClient } from 'node-rdpjs';
import { EventEmitter } from 'events';

interface WinboxSession {
  id: string;
  deviceIp: string;
  rdpClient: RDPClient;
  canvas: Canvas;
  websocket: WebSocket;
  active: boolean;
}

class WinboxStreamingService extends EventEmitter {
  private sessions: Map<string, WinboxSession> = new Map();
  private wsServer: WebSocketServer;
  
  constructor(port: number = 3005) {
    super();
    this.wsServer = new WebSocketServer({ port });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');
      const deviceIp = url.searchParams.get('deviceIp');

      if (!sessionId || !deviceIp) {
        ws.close(1008, 'Missing sessionId or deviceIp');
        return;
      }

      this.handleNewConnection(ws, sessionId, deviceIp);
    });
  }

  private async handleNewConnection(ws: WebSocket, sessionId: string, deviceIp: string) {
    try {
      const session = await this.createWinboxSession(sessionId, deviceIp, ws);
      this.sessions.set(sessionId, session);

      ws.on('close', () => {
        this.closeSession(sessionId);
      });

      ws.on('message', (data) => {
        this.handleClientMessage(sessionId, data);
      });

    } catch (error) {
      console.error('Failed to create Winbox session:', error);
      ws.close(1011, 'Failed to initialize session');
    }
  }

  private async createWinboxSession(
    sessionId: string, 
    deviceIp: string, 
    ws: WebSocket
  ): Promise<WinboxSession> {
    const canvas = createCanvas(1024, 768);
    const ctx = canvas.getContext('2d');

    // Initialize RDP client
    const rdpClient = new RDPClient({
      host: process.env.WINBOX_VM_HOST || 'localhost',
      port: parseInt(process.env.WINBOX_VM_PORT || '3389'),
      username: process.env.WINBOX_VM_USER || 'winbox',
      password: process.env.WINBOX_VM_PASSWORD || '',
      screen: { width: 1024, height: 768 }
    });

    // Set up RDP event handlers
    rdpClient.on('bitmap', (bitmap) => {
      this.handleBitmapUpdate(sessionId, bitmap, ctx);
    });

    rdpClient.on('connect', () => {
      console.log(`RDP connected for session ${sessionId}`);
      this.launchWinbox(sessionId, deviceIp);
    });

    rdpClient.on('error', (error) => {
      console.error(`RDP error for session ${sessionId}:`, error);
      ws.close(1011, 'RDP connection failed');
    });

    // Connect to RDP
    await rdpClient.connect();

    return {
      id: sessionId,
      deviceIp,
      rdpClient,
      canvas,
      websocket: ws,
      active: true
    };
  }

  private handleBitmapUpdate(sessionId: string, bitmap: any, ctx: any) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return;

    // Draw bitmap to canvas
    const imageData = ctx.createImageData(bitmap.width, bitmap.height);
    imageData.data.set(bitmap.data);
    ctx.putImageData(imageData, bitmap.x, bitmap.y);

    // Send canvas data to client
    const dataUrl = session.canvas.toDataURL('image/jpeg', 0.8);
    session.websocket.send(JSON.stringify({
      type: 'frame',
      data: dataUrl
    }));
  }

  private async launchWinbox(sessionId: string, deviceIp: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Send keyboard commands to launch Winbox with the device IP
    const commands = [
      { type: 'key', key: 'cmd', action: 'down' },
      { type: 'key', key: 'r', action: 'press' },
      { type: 'key', key: 'cmd', action: 'up' },
      { type: 'delay', ms: 500 },
      { type: 'type', text: `C:\\winbox\\winbox.exe ${deviceIp}` },
      { type: 'key', key: 'return', action: 'press' }
    ];

    for (const command of commands) {
      await this.executeCommand(sessionId, command);
    }
  }

  private async executeCommand(sessionId: string, command: any) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (command.type) {
      case 'key':
        session.rdpClient.sendKeyEvent(command.key, command.action === 'down');
        break;
      case 'type':
        for (const char of command.text) {
          session.rdpClient.sendKeyEvent(char, true);
          session.rdpClient.sendKeyEvent(char, false);
        }
        break;
      case 'delay':
        await new Promise(resolve => setTimeout(resolve, command.ms));
        break;
    }
  }

  private handleClientMessage(sessionId: string, data: Buffer) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'mouse':
          session.rdpClient.sendMouseEvent(
            message.x, 
            message.y, 
            message.button, 
            message.pressed
          );
          break;
        case 'key':
          session.rdpClient.sendKeyEvent(message.key, message.pressed);
          break;
      }
    } catch (error) {
      console.error('Invalid client message:', error);
    }
  }

  private closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.active = false;
    session.rdpClient.disconnect();
    this.sessions.delete(sessionId);
    console.log(`Closed Winbox session ${sessionId}`);
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export default WinboxStreamingService;
```

### 3.2 Create Environment Configuration
Add to `packages/network-portal/.env`:

```env
# Winbox VM Configuration
WINBOX_VM_HOST=192.168.1.100
WINBOX_VM_PORT=3389
WINBOX_VM_USER=winbox
WINBOX_VM_PASSWORD=your_secure_password
WINBOX_SERVICE_PORT=3005
```

---

## Step 4: Create Winbox Modal Component

### 4.1 Create Winbox Modal Component
Create `packages/network-portal/src/components/ui/WinboxModal.tsx`:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface WinboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceIp: string;
  deviceName?: string;
}

export const WinboxModal: React.FC<WinboxModalProps> = ({
  isOpen,
  onClose,
  deviceIp,
  deviceName
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    if (!isOpen) return;

    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:3005?sessionId=${sessionId}&deviceIp=${deviceIp}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        console.log('Winbox WebSocket connected');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'frame') {
          drawFrame(message.data);
        }
      };

      ws.onerror = (error) => {
        console.error('Winbox WebSocket error:', error);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('closed');
        console.log('Winbox WebSocket closed');
      };
    };

    const drawFrame = (dataUrl: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen, deviceIp, sessionId]);

  const handleMouseEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!wsRef.current || connectionStatus !== 'connected') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));

    wsRef.current.send(JSON.stringify({
      type: 'mouse',
      x,
      y,
      button: event.button,
      pressed: event.type === 'mousedown'
    }));
  };

  const handleKeyEvent = (event: React.KeyboardEvent) => {
    if (!wsRef.current || connectionStatus !== 'connected') return;

    event.preventDefault();
    
    wsRef.current.send(JSON.stringify({
      type: 'key',
      key: event.key,
      pressed: event.type === 'keydown'
    }));
  };

  if (!isOpen) return null;

  return (
    <div 
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="card"
        style={{
          width: '90vw',
          maxWidth: '1200px',
          height: '90vh',
          maxHeight: '800px',
          backgroundColor: 'rgba(var(--background-rgb), 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(var(--border-rgb), 0.8)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))'
            }}>
              Winbox - {deviceName || deviceIp}
            </h3>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))'
            }}>
              Status: {connectionStatus}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgb(var(--secondary-rgb))',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Canvas Container */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: 'rgba(var(--border-rgb), 0.1)'
        }}>
          {connectionStatus === 'connecting' && (
            <div style={{
              textAlign: 'center',
              color: 'rgb(var(--secondary-rgb))'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(var(--primary-rgb), 0.3)',
                borderTop: '3px solid rgb(var(--primary-rgb))',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <p>Connecting to Winbox...</p>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div style={{
              textAlign: 'center',
              color: 'rgb(var(--error-rgb))'
            }}>
              <p>Failed to connect to Winbox service</p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgb(var(--error-rgb))',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                Retry
              </button>
            </div>
          )}

          {connectionStatus === 'connected' && (
            <canvas
              ref={canvasRef}
              width={1024}
              height={768}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: '8px',
                cursor: 'crosshair'
              }}
              onMouseDown={handleMouseEvent}
              onMouseUp={handleMouseEvent}
              onMouseMove={handleMouseEvent}
              onKeyDown={handleKeyEvent}
              onKeyUp={handleKeyEvent}
              tabIndex={0}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
```

---

## Step 5: Create Winbox Button Component

### 5.1 Create Winbox Button
Create `packages/network-portal/src/components/ui/WinboxButton.tsx`:

```typescript
import React from 'react';
import { Monitor } from 'lucide-react';

interface WinboxButtonProps {
  deviceIp: string;
  deviceName?: string;
  onClick: () => void;
  disabled?: boolean;
}

export const WinboxButton: React.FC<WinboxButtonProps> = ({
  deviceIp,
  deviceName,
  onClick,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
        border: '1px solid rgba(var(--primary-rgb), 0.3)',
        borderRadius: '6px',
        color: 'rgb(var(--primary-rgb))',
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease-in-out',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
          e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
          e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
        }
      }}
      title={`Open ${deviceName || deviceIp} in Winbox`}
    >
      <Monitor size={16} />
      Winbox
    </button>
  );
};
```

---

## Step 6: Integrate Winbox Service

### 6.1 Update Server Index
Update `packages/network-portal/server/index.ts`:

```typescript
import WinboxStreamingService from './services/winbox-service.js';

// ... existing imports and setup ...

// Initialize Winbox service
const winboxService = new WinboxStreamingService(
  parseInt(process.env.WINBOX_SERVICE_PORT || '3005')
);

console.log('Winbox streaming service started on port 3005');

// ... rest of server setup ...
```

### 6.2 Add to Package Scripts
Update `packages/network-portal/package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\" \"npm run dev:winbox\"",
    "dev:winbox": "tsx watch server/services/winbox-service.ts"
  }
}
```

---

## Step 7: Add Winbox Buttons to Pages

### 7.1 Update Devices Page
Add to the appropriate device listing component:

```typescript
import { WinboxButton } from '../components/ui/WinboxButton';
import { WinboxModal } from '../components/ui/WinboxModal';

export const DevicesPage = () => {
  const [winboxModal, setWinboxModal] = useState<{
    isOpen: boolean;
    deviceIp: string;
    deviceName?: string;
  }>({
    isOpen: false,
    deviceIp: '',
    deviceName: ''
  });

  const handleOpenWinbox = (deviceIp: string, deviceName?: string) => {
    setWinboxModal({
      isOpen: true,
      deviceIp,
      deviceName
    });
  };

  return (
    <div>
      {/* Existing device list */}
      {devices.map(device => (
        <div key={device.ip} className="device-item">
          {/* Existing device info */}
          <div className="device-actions">
            {/* Existing terminal button */}
            <WinboxButton
              deviceIp={device.ip}
              deviceName={device.name}
              onClick={() => handleOpenWinbox(device.ip, device.name)}
            />
          </div>
        </div>
      ))}

      <WinboxModal
        isOpen={winboxModal.isOpen}
        onClose={() => setWinboxModal(prev => ({ ...prev, isOpen: false }))}
        deviceIp={winboxModal.deviceIp}
        deviceName={winboxModal.deviceName}
      />
    </div>
  );
};
```

### 7.2 Update Configuration Page
Follow the same pattern for the configuration page:

```typescript
// Add similar integration to configuration page
// Place button next to terminal button in device controls
```

### 7.3 Update Monitoring Page
Follow the same pattern for the monitoring page:

```typescript
// Add similar integration to monitoring page
// Place button next to terminal button in device controls
```

---

## Step 8: Testing & Deployment

### 8.1 Local Testing
```bash
# Start all services
cd packages/network-portal
pnpm run dev

# Test Winbox connection
# 1. Navigate to devices page
# 2. Click Winbox button
# 3. Verify modal opens and connects
# 4. Test mouse/keyboard interaction
```

### 8.2 Production Deployment
```bash
# Build for production
pnpm run build

# Set production environment variables
export WINBOX_VM_HOST=production.vm.host
export WINBOX_VM_PORT=3389
export WINBOX_VM_USER=winbox
export WINBOX_VM_PASSWORD=secure_password

# Start production services
pnpm run start
```

---

## Security Considerations

1. **RDP Credentials**: Store RDP credentials securely in environment variables
2. **Network Isolation**: Isolate Winbox VM on secure network segment
3. **Session Management**: Implement session timeouts and cleanup
4. **Authentication**: Ensure only authenticated users can access Winbox
5. **SSL/TLS**: Use HTTPS for WebSocket connections in production

---

## Troubleshooting

### Common Issues
1. **WebSocket Connection Fails**: Check firewall settings and port 3005
2. **RDP Connection Fails**: Verify VM credentials and network connectivity
3. **Canvas Not Updating**: Check RDP bitmap event handling
4. **Mouse/Keyboard Not Working**: Verify event forwarding to RDP client

### Logs
```bash
# Check Winbox service logs
tail -f logs/winbox-service.log

# Check RDP connection logs
tail -f logs/rdp-client.log
```

---

## Performance Optimization

1. **Canvas Compression**: Adjust JPEG quality for bandwidth optimization
2. **Frame Rate Limiting**: Limit frame updates to prevent excessive bandwidth
3. **Session Pooling**: Reuse RDP connections for multiple sessions
4. **Resource Cleanup**: Implement proper cleanup for closed sessions

---

This implementation provides a seamless "Open in Winbox" experience that follows your UI design guidelines and integrates cleanly with your existing architecture. 