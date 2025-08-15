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
      const timestamp = new Date().toISOString();
      console.log(`[Preferences ${timestamp}] Setting up preferences realtime subscription for session:`, sessionId);
      
      // Check if channel already exists
      const existingChannel = supabase.getChannels().find(ch => ch.topic === `preferences-${sessionId}`);
      console.log(`[Preferences ${timestamp}] Existing channel state:`, existingChannel?.state);
      
      // Log all channels
      console.log(`[Preferences ${timestamp}] All channels before creating new one:`, 
        supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
      );

      const channel = supabase
      .channel(`preferences-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'workout_preferences',
          filter: `training_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[TV useRealtimePreferences] Raw payload received:', payload);
          console.log('[TV useRealtimePreferences] Event type:', payload.eventType);
          console.log('[TV useRealtimePreferences] Table:', payload.table);
          console.log('[TV useRealtimePreferences] New data:', payload.new);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const preference = payload.new as any;
            console.log('[TV useRealtimePreferences] Processing preference:', preference);
            
            // Transform database format to our expected format
            const update: PreferenceUpdateEvent = {
              userId: preference.user_id,
              preferences: {
                intensity: preference.intensity,
                muscleTargets: preference.muscle_targets,
                muscleLessens: preference.muscle_lessens,
                sessionGoal: preference.workout_type?.includes('targeted') ? 'targeted' : 'full-body',
                includeFinisher: preference.workout_type?.includes('with_finisher') ?? true
              },
              isReady: false // This would need to come from user_training_session table
            };
            
            console.log('[TV useRealtimePreferences] Transformed update:', update);
            onPreferenceUpdateRef.current(update);
          }
        }
      )
      .subscribe((status) => {
        const timestamp = new Date().toISOString();
        if (status !== 'CLOSED') {
          console.log(`[Preferences ${timestamp}] Subscription status changed:`, status);
        }
        console.log(`[Preferences ${timestamp}] Channel state after subscribe:`, channel.state);
        console.log(`[Preferences ${timestamp}] All channels after subscribe:`, 
          supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
        );
        
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' && onErrorRef.current) {
          onErrorRef.current(new Error('Failed to connect to preference updates'));
        }
      });

      channelRef.current = channel;
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timeoutId);
      const timestamp = new Date().toISOString();
      console.log(`[Preferences ${timestamp}] Cleaning up preferences realtime subscription`);
      
      if (channelRef.current) {
        console.log(`[Preferences ${timestamp}] Channel state before cleanup:`, channelRef.current.state);
        console.log(`[Preferences ${timestamp}] All channels before removal:`, 
          supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
        );
        
        // Try unsubscribe first, then remove
        channelRef.current.unsubscribe();
        
        // Small delay before removal
        setTimeout(() => {
          supabase.removeChannel(channelRef.current!);
          
          console.log(`[Preferences ${timestamp}] All channels after removal:`, 
            supabase.getChannels().map(ch => ({ topic: ch.topic, state: ch.state }))
          );
        }, 50);
        
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]); // Only re-subscribe when sessionId changes

  return { isConnected };
}