"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface MessageEvent {
  userId: string;
  userName?: string | null;
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: string;
}

interface UseMessageStreamOptions {
  sessionId?: string;
  onMessage?: (event: MessageEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export function useMessageStream({
  sessionId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  enabled = true,
}: UseMessageStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setError(null);
    setIsReconnecting(false);

    try {
      const eventSource = new EventSource(
        `/api/sse/check-ins?sessionId=${sessionId}`
      );

      // Set a timeout for initial connection
      connectionTimeoutRef.current = setTimeout(() => {
        console.log('SSE connection timeout, closing');
        eventSource.close();
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null;
          setIsConnected(false);
          setError(new Error('Connection timeout'));
        }
      }, 10000); // 10 second timeout

      eventSource.onopen = () => {
        // Clear the connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = undefined;
        }
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data);
        // Connection confirmed
      });

      eventSource.addEventListener("new-message", (event) => {
        const messageData: MessageEvent = JSON.parse(event.data);
        onMessage?.(messageData);
      });

      eventSource.addEventListener("heartbeat", () => {
        // Keep connection alive
      });

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        
        // Clear the connection timeout if it exists
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = undefined;
        }

        setIsConnected(false);
        eventSourceRef.current = null;
        
        // Firefox doesn't give useful error information, so we'll just note the disconnection
        setError(new Error('Connection lost'));
        onDisconnect?.();
        onError?.(new Error('Connection lost'));

        // Implement exponential backoff for reconnection
        const attemptReconnect = () => {
          if (reconnectAttemptsRef.current < 5) {
            setIsReconnecting(true);
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (enabled) {
                connect();
              }
            }, delay);
          } else {
            setError(new Error('Max reconnection attempts reached'));
            onError?.(new Error('Max reconnection attempts reached'));
          }
        };

        attemptReconnect();
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error("Failed to create EventSource:", err);
      setError(err as Error);
      onError?.(err as Error);
    }
  }, [sessionId, onMessage, onConnect, onDisconnect, onError, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  useEffect(() => {
    if (enabled && sessionId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect, enabled]);

  return {
    isConnected,
    isReconnecting,
    error,
    reconnect: connect,
    disconnect,
  };
}