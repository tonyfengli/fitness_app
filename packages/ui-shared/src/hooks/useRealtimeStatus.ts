'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface StatusUpdate {
  userId: string;
  status: string;
  updatedAt: string;
}

export interface UseRealtimeStatusOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onStatusUpdate: (data: StatusUpdate) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeStatus({ 
  sessionId, 
  supabase,
  onStatusUpdate,
  onError 
}: UseRealtimeStatusOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate;
    onErrorRef.current = onError;
  }, [onStatusUpdate, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(() => {
      console.log('[useRealtimeStatus] Setting up realtime for session:', sessionId);
    
    // Create a channel for this session's status updates
    const channel = supabase
      .channel(`status-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Only listen to UPDATE events for status changes
          schema: 'public',
          table: 'user_training_session',
          filter: `training_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[useRealtimeStatus] Status update received:', payload.eventType);
          
          if (payload.eventType === 'UPDATE' && payload.new.user_id) {
            console.log('[useRealtimeStatus] Processing status update for user:', payload.new.user_id);
            
            onStatusUpdateRef.current({
              userId: payload.new.user_id,
              status: payload.new.status,
              updatedAt: payload.new.updated_at || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeStatus] Subscription status changed:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          const errorMsg = 'Failed to connect to status updates';
          setError(errorMsg);
          onErrorRef.current?.(new Error(errorMsg));
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = 'Connection timed out';
          setError(errorMsg);
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
      console.log('[useRealtimeStatus] Cleaning up subscription');
      if (channelRef.current) {
        // Unsubscribe first, then remove channel
        channelRef.current.unsubscribe();
        
        // Small delay before removal
        setTimeout(() => {
          supabase.removeChannel(channelRef.current!);
        }, 50);
        
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