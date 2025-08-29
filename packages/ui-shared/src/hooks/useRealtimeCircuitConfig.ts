'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { CircuitConfig } from '@acme/db';

export interface CircuitConfigUpdate {
  sessionId: string;
  config: CircuitConfig;
  updatedAt: string;
}

export interface UseRealtimeCircuitConfigOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onConfigUpdate: (data: CircuitConfigUpdate) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeCircuitConfig({ 
  sessionId, 
  supabase,
  onConfigUpdate,
  onError 
}: UseRealtimeCircuitConfigOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      console.log('[useRealtimeCircuitConfig] Setting up realtime for session:', sessionId);
    
    // Create a channel for this session's circuit config
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
          console.log('[useRealtimeCircuitConfig] Event received:', payload.eventType);
          
          if (payload.eventType === 'UPDATE') {
            const session = payload.new;
            
            // Check if this is a circuit session with valid config
            if (
              session.template_type === 'circuit' &&
              session.template_config &&
              typeof session.template_config === 'object' &&
              'type' in session.template_config &&
              session.template_config.type === 'circuit'
            ) {
              console.log('[useRealtimeCircuitConfig] Processing config update');
              
              onConfigUpdateRef.current({
                sessionId: session.id,
                config: session.template_config as CircuitConfig,
                updatedAt: session.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeCircuitConfig] Subscription status changed:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          const errorMsg = 'Failed to connect to circuit config updates';
          setError(errorMsg);
          onErrorRef.current?.(new Error(errorMsg));
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = 'Connection timed out - This may be due to network issues or firewall blocking WebSocket connections';
          setError(errorMsg);
          console.warn('[useRealtimeCircuitConfig] Connection timeout. Common causes: firewall, VPN, or Supabase Realtime not enabled');
          onErrorRef.current?.(new Error(errorMsg));
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });
    
    channelRef.current = channel;

    }, 100); // 100ms delay

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      console.log('[useRealtimeCircuitConfig] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, supabase]); // Re-subscribe when sessionId or supabase changes

  return {
    isConnected,
    error,
  };
}