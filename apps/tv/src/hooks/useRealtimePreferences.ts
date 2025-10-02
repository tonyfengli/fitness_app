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
    workoutType?: string | null;
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
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const preference = payload.new as any;
            
            // Transform database format to our expected format
            const update: PreferenceUpdateEvent = {
              userId: preference.user_id,
              preferences: {
                intensity: preference.intensity,
                muscleTargets: preference.muscle_targets,
                muscleLessens: preference.muscle_lessens,
                sessionGoal: preference.workout_type?.includes('targeted') ? 'targeted' : 'full-body',
                includeFinisher: preference.workout_type?.includes('with_finisher') ?? true,
                workoutType: preference.workout_type
              },
              isReady: false // This would need to come from user_training_session table
            };
            
            onPreferenceUpdateRef.current(update);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' && onErrorRef.current) {
          onErrorRef.current(new Error('Failed to connect to preference updates'));
        }
      });

      channelRef.current = channel;
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timeoutId);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId]); // Only re-subscribe when sessionId changes

  return { isConnected };
}