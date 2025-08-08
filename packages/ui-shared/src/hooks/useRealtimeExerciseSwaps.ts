'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface ExerciseSwapUpdate {
  id: string;
  sessionId: string;
  clientId: string;
  originalExerciseId: string;
  newExerciseId: string;
  swappedAt: string;
  reason?: string;
}

export interface UseRealtimeExerciseSwapsOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onSwapUpdate: (swap: ExerciseSwapUpdate) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeExerciseSwaps({ 
  sessionId, 
  supabase,
  onSwapUpdate,
  onError 
}: UseRealtimeExerciseSwapsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onSwapUpdateRef = useRef(onSwapUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onSwapUpdateRef.current = onSwapUpdate;
    onErrorRef.current = onError;
  }, [onSwapUpdate, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(() => {
      console.log('[useRealtimeExerciseSwaps] Setting up realtime for session:', sessionId);
    
    // Create a channel for exercise swaps
    const channel = supabase
      .channel(`exercise-swaps-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events for debugging
          schema: 'public',
          table: 'workout_exercise_swaps',
          filter: `training_session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('[useRealtimeExerciseSwaps] Event received:', {
            eventType: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            old: payload.old,
            new: payload.new,
            sessionId
          });
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const swap = payload.new;
            
            // Get exercise details
            const { data: exercises } = await supabase
              .from('exercises')
              .select('id, name')
              .in('id', [swap.original_exercise_id, swap.new_exercise_id]);
              
            const originalExercise = exercises?.find(e => e.id === swap.original_exercise_id);
            const newExercise = exercises?.find(e => e.id === swap.new_exercise_id);
            
            onSwapUpdateRef.current({
              id: swap.id,
              sessionId: swap.training_session_id,
              clientId: swap.client_id,
              originalExerciseId: swap.original_exercise_id,
              originalExerciseName: originalExercise?.name,
              newExerciseId: swap.new_exercise_id,
              newExerciseName: newExercise?.name,
              swappedAt: swap.swapped_at,
              reason: swap.swap_reason
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeExerciseSwaps] Subscription status changed:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          const errorMsg = 'Failed to connect to exercise swap updates';
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
      console.log('[useRealtimeExerciseSwaps] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, supabase]);

  return {
    isConnected,
    error,
  };
}