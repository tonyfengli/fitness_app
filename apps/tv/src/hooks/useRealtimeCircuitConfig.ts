import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { CircuitConfig } from '@acme/db/types/circuit-config';

interface CircuitConfigUpdateEvent {
  sessionId: string;
  config: CircuitConfig;
  updatedAt: string;
}

interface UseRealtimeCircuitConfigOptions {
  sessionId: string;
  onConfigUpdate: (event: CircuitConfigUpdateEvent) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeCircuitConfig({
  sessionId,
  onConfigUpdate,
  onError
}: UseRealtimeCircuitConfigOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onConfigUpdateRef = useRef(onConfigUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onConfigUpdateRef.current = onConfigUpdate;
    onErrorRef.current = onError;
  }, [onConfigUpdate, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(() => {
      console.log('[TV] Setting up circuit config realtime subscription for session:', sessionId);

      const channel = supabase
      .channel(`circuit-config-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Only listen to UPDATE since we update templateConfig
          schema: 'public',
          table: 'training_session',
          filter: `id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[TV useRealtimeCircuitConfig] Raw payload received:', payload);
          console.log('[TV useRealtimeCircuitConfig] Event type:', payload.eventType);
          console.log('[TV useRealtimeCircuitConfig] Table:', payload.table);
          console.log('[TV useRealtimeCircuitConfig] New data:', payload.new);
          
          if (payload.eventType === 'UPDATE') {
            const session = payload.new as any;
            console.log('[TV useRealtimeCircuitConfig] Processing session:', session);
            
            // Check if this is a circuit session with valid config
            if (
              session.template_type === 'circuit' &&
              session.template_config &&
              typeof session.template_config === 'object' &&
              'type' in session.template_config &&
              session.template_config.type === 'circuit'
            ) {
              const update: CircuitConfigUpdateEvent = {
                sessionId: session.id,
                config: session.template_config as CircuitConfig,
                updatedAt: session.updated_at || new Date().toISOString(),
              };
              
              console.log('[TV useRealtimeCircuitConfig] Transformed update:', update);
              onConfigUpdateRef.current(update);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status !== 'CLOSED') {
          console.log('[TV] Circuit config subscription status changed:', status);
        }
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' && onErrorRef.current) {
          onErrorRef.current(new Error('Failed to connect to circuit config updates'));
        }
      });

      channelRef.current = channel;
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timeoutId);
      console.log('[TV] Cleaning up circuit config realtime subscription');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]); // Only re-subscribe when sessionId changes

  return { isConnected };
}