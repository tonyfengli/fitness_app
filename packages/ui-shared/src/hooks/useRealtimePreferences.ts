'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface PreferenceUpdate {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  };
  updatedAt: string;
}

export interface UseRealtimePreferencesOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onPreferenceUpdate: (data: PreferenceUpdate) => void;
  onError?: (error: Error) => void;
}

export function useRealtimePreferences({ 
  sessionId, 
  supabase,
  onPreferenceUpdate,
  onError 
}: UseRealtimePreferencesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      console.log('[useRealtimePreferences] Setting up realtime for session:', sessionId);
    
    // Create a channel for this session's preferences
    const channel = supabase
      .channel(`preferences-${sessionId}`, {
        config: {
          timeout: 30000, // Increase timeout to 30 seconds
          params: {
            eventsPerSecond: 10
          }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'workout_preferences',
          filter: `training_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[useRealtimePreferences] Event received:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const preferences = payload.new;
            
            if (preferences.user_id) {
              console.log('[useRealtimePreferences] Processing preference update for user:', preferences.user_id);
              
              onPreferenceUpdateRef.current({
                userId: preferences.user_id,
                preferences: {
                  intensity: preferences.intensity,
                  muscleTargets: preferences.muscle_targets,
                  muscleLessens: preferences.muscle_lessens,
                  includeExercises: preferences.include_exercises,
                  avoidExercises: preferences.avoid_exercises,
                  avoidJoints: preferences.avoid_joints,
                  sessionGoal: preferences.session_goal,
                },
                updatedAt: preferences.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimePreferences] Subscription status changed:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          const errorMsg = 'Failed to connect to preference updates';
          setError(errorMsg);
          onErrorRef.current?.(new Error(errorMsg));
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = 'Connection timed out - This may be due to network issues or firewall blocking WebSocket connections';
          setError(errorMsg);
          console.warn('[useRealtimePreferences] Connection timeout. Common causes: firewall, VPN, or Supabase Realtime not enabled');
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
      console.log('[useRealtimePreferences] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
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