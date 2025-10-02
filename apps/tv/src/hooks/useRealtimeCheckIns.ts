import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { config } from '../config';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface CheckInData {
  userId: string;
  name: string;
  checkedInAt: string;
}

interface UseRealtimeCheckInsOptions {
  sessionId: string;
  onCheckIn: (data: CheckInData) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeCheckIns({ 
  sessionId, 
  onCheckIn,
  onError 
}: UseRealtimeCheckInsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onCheckInRef = useRef(onCheckIn);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onCheckInRef.current = onCheckIn;
    onErrorRef.current = onError;
  }, [onCheckIn, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(() => {
    
      // Create a channel for this session (must match web app channel name)
      const channel = supabase
        .channel(`session-${sessionId}`, {
          config: {
            // Add authorization header for Pro plan
            params: {
              apikey: config.supabaseAnonKey,
            },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT and UPDATE
            schema: 'public',
            table: 'user_training_session',
            filter: `training_session_id=eq.${sessionId}`,
          },
          async (payload) => {
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const checkIn = payload.new;
              
              // Only process if status is checked_in
              if (checkIn.status === 'checked_in' && checkIn.user_id) {
                // Fetch user details
                try {
                  const { data: userData } = await supabase
                    .from('user')
                    .select('name')
                    .eq('id', checkIn.user_id)
                    .single();
                  
                  onCheckInRef.current({
                    userId: checkIn.user_id,
                    name: userData?.name || 'Unknown',
                    checkedInAt: checkIn.checked_in_at || new Date().toISOString(),
                  });
                } catch (err) {
                  console.error('[TV] Error fetching user data:', err);
                  onCheckInRef.current({
                    userId: checkIn.user_id,
                    name: 'Unknown',
                    checkedInAt: checkIn.checked_in_at || new Date().toISOString(),
                  });
                }
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[useRealtimeCheckIns] ❌ Channel error for session-${sessionId}`);
            setIsConnected(false);
            const errorMsg = 'Failed to connect to realtime updates';
            setError(errorMsg);
            onErrorRef.current?.(new Error(errorMsg));
          } else if (status === 'TIMED_OUT') {
            console.error(`[useRealtimeCheckIns] ⏱️ Subscription timed out for session-${sessionId}`);
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
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]); // Only re-subscribe when sessionId changes

  return {
    isConnected,
    error,
  };
}