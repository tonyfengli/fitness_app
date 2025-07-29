import { useEffect, useRef, useState } from 'react';

export interface PreferenceUpdateEvent {
  userId: string;
  sessionId: string;
  preferences: {
    muscleTargets?: string[];
    muscleLessens?: string[];
    notes?: string;
    confirmedExercises?: Array<{ name: string; confirmed: boolean }>;
  };
  updatedAt: string;
}

interface UsePreferenceStreamOptions {
  sessionId: string;
  onPreferenceUpdate: (event: PreferenceUpdateEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function usePreferenceStream({
  sessionId,
  onPreferenceUpdate,
  onConnect,
  onDisconnect,
  onError,
}: UsePreferenceStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    const connect = () => {
      try {
        console.log('[PreferenceStream] Connecting to SSE for session:', sessionId);
        
        const eventSource = new EventSource(`/api/sse/preferences?sessionId=${sessionId}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[PreferenceStream] Connected');
          setIsConnected(true);
          setIsReconnecting(false);
          reconnectAttemptsRef.current = 0;
          onConnect?.();
        };

        eventSource.addEventListener('preference-update', (event) => {
          try {
            const data = JSON.parse(event.data) as PreferenceUpdateEvent;
            console.log('[PreferenceStream] Preference update received:', data);
            onPreferenceUpdate(data);
          } catch (error) {
            console.error('[PreferenceStream] Failed to parse preference update:', error);
            onError?.(new Error('Failed to parse preference update'));
          }
        });

        eventSource.onerror = (error) => {
          console.error('[PreferenceStream] Connection error:', error);
          setIsConnected(false);
          onDisconnect?.();

          // Attempt to reconnect
          if (reconnectAttemptsRef.current < 5) {
            setIsReconnecting(true);
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            
            console.log(`[PreferenceStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/5)`);
            
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              eventSource.close();
              connect();
            }, delay);
          } else {
            console.error('[PreferenceStream] Max reconnection attempts reached');
            onError?.(new Error('Connection lost'));
          }
        };
      } catch (error) {
        console.error('[PreferenceStream] Failed to create EventSource:', error);
        onError?.(error as Error);
      }
    };

    connect();

    return () => {
      console.log('[PreferenceStream] Cleaning up connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [sessionId, onPreferenceUpdate, onConnect, onDisconnect, onError]);

  return { isConnected, isReconnecting };
}