import { useEffect, useState, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface TrainingSession {
  id: string;
  business_id: string;
  template_type: string;
  status: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
}

interface UseRealtimeNewSessionsOptions {
  businessId?: string; // Optional: filter by business
  supabase: SupabaseClient;
  onNewSession?: (session: TrainingSession) => void;
}

export function useRealtimeNewSessions({
  businessId,
  supabase,
  onNewSession,
}: UseRealtimeNewSessionsOptions) {
  const [latestSession, setLatestSession] = useState<TrainingSession | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(onNewSession);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onNewSession;
  }, [onNewSession]);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Delay subscription to prevent rapid re-subscriptions
    timeoutRef.current = setTimeout(() => {
      const channelName = businessId 
        ? `new-sessions-${businessId}` 
        : 'new-sessions-all';
      
      
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events to debug
            schema: 'public',
            table: 'training_session',
            // Only filter by businessId if provided
            ...(businessId && { filter: `business_id=eq.${businessId}` }),
          },
          (payload) => {
            
            if (payload.eventType === 'INSERT') {
              
              const newSession = payload.new as TrainingSession;
              setLatestSession(newSession);
              
              // Call callback if provided
              if (callbackRef.current) {
                callbackRef.current(newSession);
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[useRealtimeNewSessions] ❌ Channel error for ${channelName}`);
            setError(new Error('Failed to subscribe to new sessions'));
            setIsSubscribed(false);
          } else if (status === 'TIMED_OUT') {
            console.error(`[useRealtimeNewSessions] Subscription timed out for ${channelName}`);
            setError(new Error('Subscription timed out'));
            setIsSubscribed(false);
          } else if (status === 'CLOSED') {
            setIsSubscribed(false);
          }
        });

      channelRef.current = channel;
    }, 100);

    // Cleanup function
    return () => {
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      setIsSubscribed(false);
      setError(null);
    };
  }, [businessId, supabase]);

  return {
    latestSession,
    isSubscribed,
    error,
  };
}