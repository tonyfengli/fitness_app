"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface CheckInEvent {
  userId: string;
  name: string;
  checkedInAt: string;
}

export interface PreferenceUpdateEvent {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  };
}

interface UseCheckInStreamOptions {
  sessionId: string;
  onCheckIn?: (event: CheckInEvent) => void;
  onPreferenceUpdate?: (event: PreferenceUpdateEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useCheckInStream({
  sessionId,
  onCheckIn,
  onPreferenceUpdate,
  onConnect,
  onDisconnect,
  onError,
}: UseCheckInStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
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

      eventSource.addEventListener("client-checked-in", (event) => {
        const checkInData: CheckInEvent = JSON.parse(event.data);
        onCheckIn?.(checkInData);
      });

      eventSource.addEventListener("preference-updated", (event) => {
        const preferenceData: PreferenceUpdateEvent = JSON.parse(event.data);
        onPreferenceUpdate?.(preferenceData);
      });

      eventSource.onerror = (error) => {
        console.log('SSE error, closing connection');
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = undefined;
        }
        
        eventSource.close();
        setIsConnected(false);
        eventSourceRef.current = null;

        // Don't reconnect if component is unmounting
        if (reconnectTimeoutRef.current === undefined) {
          return;
        }

        // Implement exponential backoff for reconnection
        const attempt = reconnectAttemptsRef.current;
        if (attempt < 3) { // Reduced from 5 to 3 attempts
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          setIsReconnecting(true);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          const err = new Error("Failed to connect after 3 attempts");
          setError(err);
          onError?.(err);
        }
        
        onDisconnect?.();
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to connect");
      setError(error);
      onError?.(error);
    }
  }, [sessionId, onCheckIn, onPreferenceUpdate, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    // Clear all timeouts first to prevent new connections
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined; // Mark as unmounting
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Connect on mount and disconnect on unmount
  useEffect(() => {
    if (sessionId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
    // Only re-run if sessionId changes
  }, [sessionId]);

  return {
    isConnected,
    isReconnecting,
    error,
    reconnect: connect,
    disconnect,
  };
}