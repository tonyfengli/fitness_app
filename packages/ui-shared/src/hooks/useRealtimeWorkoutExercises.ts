'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface WorkoutExerciseUpdate {
  workoutId: string;
  exerciseId: string;
  exerciseName?: string;
  orderIndex: number;
  groupName?: string;
  isShared: boolean;
}

export interface UseRealtimeWorkoutExercisesOptions {
  sessionId: string;
  userId: string;
  supabase: SupabaseClient;
  onExercisesUpdate: (exercises: WorkoutExerciseUpdate[]) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeWorkoutExercises({ 
  sessionId, 
  userId,
  supabase,
  onExercisesUpdate,
  onError 
}: UseRealtimeWorkoutExercisesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Store callbacks in refs to avoid re-subscribing
  const onExercisesUpdateRef = useRef(onExercisesUpdate);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onExercisesUpdateRef.current = onExercisesUpdate;
    onErrorRef.current = onError;
  }, [onExercisesUpdate, onError]);

  useEffect(() => {
    if (!sessionId || !userId) return;

    // Small delay to avoid subscribing during rapid re-renders
    const timeoutId = setTimeout(async () => {
      console.log('[useRealtimeWorkoutExercises] Setting up realtime for session:', sessionId, 'user:', userId);
      
      // First, get the workout ID for this user and session
      const { data: workoutData, error: workoutError } = await supabase
        .from('workout')
        .select('id')
        .eq('training_session_id', sessionId)
        .eq('user_id', userId)
        .eq('status', 'draft')
        .single();
        
      if (workoutError || !workoutData) {
        console.log('[useRealtimeWorkoutExercises] No draft workout found yet, will listen for new workouts');
      }
      
      // Function to listen to workout exercises
      const listenToWorkoutExercises = (workoutId: string) => {
        console.log('[useRealtimeWorkoutExercises] Listening to exercises for workout:', workoutId);
        
        // Create a channel for workout exercises
        const exerciseChannel = supabase
          .channel(`workout-exercises-${workoutId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'workout_exercise',
              filter: `workout_id=eq.${workoutId}`,
            },
            async (payload) => {
              console.log('[useRealtimeWorkoutExercises] Exercise event:', payload.eventType);
              
              // Fetch all exercises for this workout with exercise details
              const { data: exercises, error } = await supabase
                .from('workout_exercise')
                .select(`
                  *,
                  exercise:exercises(name),
                  custom_exercise
                `)
                .eq('workout_id', workoutId)
                .order('order_index', { ascending: true });
                
              if (error) {
                console.error('[useRealtimeWorkoutExercises] Error fetching exercises:', error);
                onErrorRef.current?.(new Error('Failed to fetch workout exercises'));
                return;
              }
              
              // Transform and send the exercises
              const transformedExercises = exercises.map(we => ({
                workoutId: we.workout_id,
                exerciseId: we.exercise_id,
                exerciseName: we.custom_exercise?.customName || we.exercise?.name || 'Unknown Exercise',
                orderIndex: we.order_index,
                groupName: we.group_name,
                isShared: we.is_shared || false,
                customExercise: we.custom_exercise
              }));
              
              onExercisesUpdateRef.current(transformedExercises);
            }
          )
          .subscribe((status) => {
            console.log('[useRealtimeWorkoutExercises] Exercise subscription status:', status);
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
            }
          });
          
        // Store the exercise channel
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        channelRef.current = exerciseChannel;
      };
      
      // Listen for new workouts being created
      const workoutChannel = supabase
        .channel(`workout-${sessionId}-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'workout',
            filter: `training_session_id=eq.${sessionId}`,
          },
          async (payload) => {
            console.log('[useRealtimeWorkoutExercises] New workout created:', payload);
            
            if (payload.new.user_id === userId) {
              // A workout was created for this user, now listen for exercises
              listenToWorkoutExercises(payload.new.id);
            }
          }
        );
        
      // If we already have a workout, listen to its exercises
      if (workoutData?.id) {
        listenToWorkoutExercises(workoutData.id);
      }
      
      // Subscribe to the workout channel
      workoutChannel.subscribe((status) => {
        console.log('[useRealtimeWorkoutExercises] Workout subscription status:', status);
      });

    }, 100); // 100ms delay

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      console.log('[useRealtimeWorkoutExercises] Cleaning up subscriptions');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, userId, supabase]);

  return {
    isConnected,
    error,
  };
}