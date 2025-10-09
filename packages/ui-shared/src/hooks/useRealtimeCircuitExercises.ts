'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface CircuitExerciseUpdate {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  orderIndex: number;
  groupName: string;
  stationIndex: number | null;
  workoutId: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface UseRealtimeCircuitExercisesOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onExerciseUpdate: (update: CircuitExerciseUpdate) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeCircuitExercises({ 
  sessionId, 
  supabase,
  onExerciseUpdate,
  onError 
}: UseRealtimeCircuitExercisesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onExerciseUpdateRef = useRef(onExerciseUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onExerciseUpdateRef.current = onExerciseUpdate;
    onErrorRef.current = onError;
  }, [onExerciseUpdate, onError]);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(async () => {
      console.log('[useRealtimeCircuitExercises] Setting up realtime for session:', sessionId);
      
      // First, get all workout IDs for this session
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workout')
        .select('id')
        .eq('training_session_id', sessionId)
        .in('status', ['draft', 'ready']);
        
      if (workoutsError || !workoutsData || workoutsData.length === 0) {
        console.log('[useRealtimeCircuitExercises] No workouts found for session');
        return;
      }
      
      const workoutIds = workoutsData.map(w => w.id);
      console.log('[useRealtimeCircuitExercises] Found workouts:', workoutIds);
      
      // For circuit workouts, we only need to listen to one workout since they're all shared
      // Use the first workout ID
      const targetWorkoutId = workoutIds[0];
      console.log('[useRealtimeCircuitExercises] Listening to workout:', targetWorkoutId);
      
      // Create a channel for this session's circuit exercises
      const channel = supabase
        .channel(`circuit-exercises-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'workout_exercise',
            filter: `workout_id=eq.${targetWorkoutId}`,
          },
          async (payload) => {
            console.log('[useRealtimeCircuitExercises] Received event:', payload.eventType);
            console.log('[useRealtimeCircuitExercises] Event payload:', JSON.stringify(payload, null, 2));
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const exercise = payload.new;
              
              // Fetch exercise name if needed
              let exerciseName = 'Unknown Exercise';
              
              // Parse custom_exercise if it's a string
              let customExercise = exercise.custom_exercise;
              if (typeof customExercise === 'string' && customExercise) {
                try {
                  customExercise = JSON.parse(customExercise);
                } catch (e) {
                  customExercise = null;
                }
              }
              
              if (customExercise?.customName) {
                exerciseName = customExercise.customName;
              } else if (exercise.exercise_id) {
                const { data: exerciseData } = await supabase
                  .from('exercises')
                  .select('name')
                  .eq('id', exercise.exercise_id)
                  .single();
                  
                if (exerciseData) {
                  exerciseName = exerciseData.name;
                }
              }
              
              onExerciseUpdateRef.current({
                id: exercise.id,
                exerciseId: exercise.exercise_id,
                exerciseName,
                orderIndex: exercise.order_index,
                groupName: exercise.group_name || 'Round 1',
                stationIndex: exercise.station_index,
                workoutId: exercise.workout_id,
                eventType: payload.eventType,
              });
            } else if (payload.eventType === 'DELETE') {
              const exercise = payload.old;
              
              onExerciseUpdateRef.current({
                id: exercise.id,
                exerciseId: exercise.exercise_id,
                exerciseName: 'Deleted Exercise',
                orderIndex: exercise.order_index,
                groupName: exercise.group_name || 'Round 1',
                stationIndex: exercise.station_index,
                workoutId: exercise.workout_id,
                eventType: 'DELETE',
              });
            }
          }
        )
        .subscribe((status) => {
          console.log('[useRealtimeCircuitExercises] Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            const errorMsg = 'Failed to connect to circuit exercise updates';
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
      console.log('[useRealtimeCircuitExercises] Cleaning up subscription');
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