/**
 * WebSocket Hook for Real-time Monitoring
 * 
 * Handles WebSocket connection to the monitoring server
 * for real-time device metrics and status updates.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WebSocketMessage, SystemMetrics, InterfaceMetrics } from '../types/monitoring';

interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
}

export function useWebSocket(config: WebSocketConfig) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const configRef = useRef(config);
  
  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const {
    url,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = config;

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempts: 0
        }));
        configRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setState(prev => ({ ...prev, lastMessage: message }));
          configRef.current.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
        wsRef.current = null;
        configRef.current.onDisconnect?.();

        // Attempt reconnection if not a clean close and under max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setState(prev => ({ ...prev, reconnectAttempts: reconnectAttemptsRef.current }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false
        }));
        configRef.current.onError?.(error);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isConnecting: false
      }));
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0
    }));
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((deviceId: string) => {
    return sendMessage({
      type: 'subscribe',
      deviceId,
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((deviceId: string) => {
    return sendMessage({
      type: 'unsubscribe',
      deviceId,
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);

  const ping = useCallback(() => {
    return sendMessage({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);

  // Connect only once on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []); // No dependencies to prevent reconnection loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    ping
  };
}

// Hook specifically for device monitoring
export function useDeviceMonitoring(deviceId: string) {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [interfaceMetrics, setInterfaceMetrics] = useState<InterfaceMetrics[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'metrics' && message.deviceId === deviceId) {
      const rawMetric = message.data;
      
      // Ensure timestamp is consistently formatted
      const timestamp = new Date(rawMetric.timestamp);
      
      const newMetric: SystemMetrics = {
        device_id: rawMetric.device_id,
        cpu_load: Number(rawMetric.cpu_load) || 0,
        free_memory: Number(rawMetric.free_memory) || 0,
        total_memory: Number(rawMetric.total_memory) || 0,
        free_hdd_space: Number(rawMetric.free_hdd_space) || 0,
        total_hdd_space: Number(rawMetric.total_hdd_space) || 0,
        uptime: rawMetric.uptime,
        temperature: rawMetric.temperature ? Number(rawMetric.temperature) : undefined,
        voltage: rawMetric.voltage ? Number(rawMetric.voltage) : undefined,
        timestamp: timestamp
      };
      
      setMetrics(prevMetrics => {
        const updatedMetrics = [...prevMetrics, newMetric];
        // Keep the last N metrics to prevent memory leaks
        return updatedMetrics.slice(-500); 
      });
      setLastUpdate(new Date());
    }

    if (message.type === 'interface-metrics-collected' && message.deviceId === deviceId) {
      const rawMetric = message.data;
      const timestamp = new Date(rawMetric.timestamp);
      
      const newInterfaceMetric: InterfaceMetrics = {
        ...rawMetric,
        timestamp: timestamp
      };

      setInterfaceMetrics(prevMetrics => {
        const updatedMetrics = [...prevMetrics, newInterfaceMetric];
        return updatedMetrics.slice(-500); // Keep last N metrics
      });
      setLastUpdate(new Date());
    }

    if (message.type === 'device-status' && message.deviceId === deviceId) {
      console.log('[useDeviceMonitoring] Received device status:', message.data);
      setIsSubscribed(message.data?.subscribed || false);
    }
  }, [deviceId]);

  const handleConnect = useCallback(() => {
    // Auto-subscribe to device when connected
    if (deviceId) {
      // subscribe is stable and doesn't need to be in the dependency array
      setTimeout(() => subscribe(deviceId), 100); 
    }
  }, [deviceId]);

  const wsConfig: WebSocketConfig = {
    url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3004',
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: () => setIsSubscribed(false)
  };

  const {
    isConnected,
    isConnecting,
    error,
    subscribe,
    unsubscribe
  } = useWebSocket(wsConfig);

  // Effect to handle subscribing and unsubscribing
  useEffect(() => {
    if (isConnected && deviceId) {
      subscribe(deviceId);
      // When the effect cleans up, unsubscribe.
      // This handles deviceId changes and component unmounts.
      return () => {
        unsubscribe(deviceId);
      };
    }
  }, [isConnected, deviceId, subscribe, unsubscribe]);

  // Effect to clear metrics when the device changes
  useEffect(() => {
    setMetrics([]);
    setInterfaceMetrics([]);
    setIsSubscribed(false);
  }, [deviceId]);

  return {
    connectionStatus: isConnecting ? 'connecting' : (isConnected ? 'connected' : 'disconnected'),
    isSubscribed,
    metrics,
    interfaceMetrics,
    lastUpdate,
    error
  };
} 