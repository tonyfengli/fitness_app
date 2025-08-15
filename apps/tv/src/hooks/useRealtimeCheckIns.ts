import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
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
      const timestamp = new Date().toISOString();
      console.log(`[CheckIns ${timestamp}] Setting up realtime for session:`, sessionId);
      
      // Check if channel already exists
      const existingChannel = supabase.getChannels().find(ch => ch.topic === `session-${sessionId}`);
      console.log(`[CheckIns ${timestamp}] Existing channel state:`, existingChannel?.state);
    
      // Create a channel for this session (must match web app channel name)
      const channel = supabase
        .channel(`session-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT and UPDATE
            schema: 'public',
            table: 'user_training_session',
            filter: `training_session_id=eq.${sessionId}`,
          },
          async (payload) => {
            console.log('[TV] Realtime event received:', payload);
            
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
          const timestamp = new Date().toISOString();
          console.log(`[CheckIns ${timestamp}] Subscription status changed:`, status);
          console.log(`[CheckIns ${timestamp}] Channel state after subscribe:`, channel.state);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            const errorMsg = 'Failed to connect to realtime updates';
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
      const timestamp = new Date().toISOString();
      console.log(`[CheckIns ${timestamp}] Cleaning up realtime subscription`);
      
      if (channelRef.current) {
        console.log(`[CheckIns ${timestamp}] Channel state before cleanup:`, channelRef.current.state);
        
        // Log all channels before removal
        console.log(`[CheckIns ${timestamp}] All channels before removal:`, 
          supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
        );
        
        // Try unsubscribe first, then remove
        channelRef.current.unsubscribe();
        
        // Small delay before removal
        setTimeout(() => {
          supabase.removeChannel(channelRef.current!);
          
          // Log all channels after removal
          console.log(`[CheckIns ${timestamp}] All channels after removal:`, 
            supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
          );
        }, 50);
        
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