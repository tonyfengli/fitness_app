import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PreferenceUpdateEvent {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    sessionGoal?: string | null;
    includeFinisher?: boolean | null;
  } | null;
  isReady: boolean;
}

interface UseRealtimePreferencesOptions {
  sessionId: string;
  onPreferenceUpdate: (event: PreferenceUpdateEvent) => void;
  onError?: (error: Error) => void;
}

export function useRealtimePreferences({
  sessionId,
  onPreferenceUpdate,
  onError
}: UseRealtimePreferencesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onPreferenceUpdateRef = useRef(onPreferenceUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onPreferenceUpdateRef.current = onPreferenceUpdate;
    onErrorRef.current = onError;
  }, [onPreferenceUpdate, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(() => {
      console.log('[TV] Setting up preferences realtime subscription for session:', sessionId);

      const channel = supabase
      .channel(`preferences:${sessionId}`)
      .on(
        'broadcast',
        { event: 'preference-update' },
        (payload) => {
          console.log('[TV] Received preference update:', payload);
          if (payload.payload) {
            onPreferenceUpdateRef.current(payload.payload as PreferenceUpdateEvent);
          }
        }
      )
      .subscribe((status) => {
        if (status !== 'CLOSED') {
          console.log('[TV] Preferences subscription status changed:', status);
        }
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' && onErrorRef.current) {
          onErrorRef.current(new Error('Failed to connect to preference updates'));
        }
      });

      channelRef.current = channel;
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timeoutId);
      console.log('[TV] Cleaning up preferences realtime subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]); // Only re-subscribe when sessionId changes

  return { isConnected };
}