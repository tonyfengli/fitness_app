import { useState } from 'react';
import { useNavigation } from '../App';
import { useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';

export function useStartWorkout() {
  const navigation = useNavigation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  
  // Create mutation following TV app pattern
  const startWorkoutMutation = useMutation({
    ...api.trainingSession.startWorkout.mutationOptions(),
    onError: (error: any) => {
      console.error('[TV useStartWorkout] Mutation error:', error);
      setError(error.message || 'Failed to start workout');
    },
    onSuccess: (data) => {
      console.log('[TV useStartWorkout] Mutation succeeded with data:', data);
    }
  });
  
  const startWorkout = async (sessionId: string) => {
    setIsGenerating(true);
    setError(null);
    setLoadingMessage('Preparing workout...');
    
    try {
      console.log('[TV useStartWorkout] Starting workout for session:', sessionId);
      
      // Call the mutation - if already organized, this will return quickly
      const result = await startWorkoutMutation.mutateAsync({ sessionId });
      
      console.log('[TV useStartWorkout] Result:', {
        success: result.success,
        alreadyOrganized: result.alreadyOrganized,
        templateType: result.templateType,
        workoutsCount: result.workouts?.length,
        hasOrganization: !!result.workoutOrganization
      });
      
      // Log timing for already organized sessions
      if (result.alreadyOrganized) {
        console.log('[TV useStartWorkout] ✅ Workout was already organized - skipped Phase 2 LLM');
        setLoadingMessage('Loading workout...');
      } else {
        setLoadingMessage('Organizing workout rounds...');
      }
      
      // For non-standard templates or already organized sessions, go directly
      if (result.alreadyOrganized || (result.templateType && result.templateType !== 'standard')) {
        console.log('[TV useStartWorkout] Skipping Phase 2, navigating directly to WorkoutLive');
        console.log('[TV useStartWorkout] Already organized, passing existing data');
        // Keep loading screen visible during navigation
        setTimeout(() => {
          navigation.navigate('WorkoutLive', { 
            sessionId, 
            round: 1,
            // Pass the existing organization data for efficient loading
            organization: result.workoutOrganization,
            workouts: result.workouts,
            clients: result.clients
          });
          // Dismiss loading screen after navigation starts
          setTimeout(() => setIsGenerating(false), 100);
        }, 0);
      } else if (result.workoutOrganization) {
        // For standard templates with organization data
        console.log('[TV useStartWorkout] Phase 2 complete, navigating with organization data');
        console.log('[TV useStartWorkout] Workouts to pass:', result.workouts?.length);
        // Keep loading screen visible during navigation
        setTimeout(() => {
          navigation.navigate('WorkoutLive', { 
            sessionId, 
            round: 1,
            // Pass the organization data for efficient loading
            organization: result.workoutOrganization,
            workouts: result.workouts,
            clients: result.clients
          });
          // Dismiss loading screen after navigation starts
          setTimeout(() => setIsGenerating(false), 100);
        }, 0);
      } else {
        // This shouldn't happen with the current implementation
        throw new Error('Unexpected state: no organization data returned');
      }
      
      return result;
    } catch (e: any) {
      console.error('[TV useStartWorkout] Error:', e);
      setError(e.message || 'Failed to start workout');
      setIsGenerating(false); // Only set false on error
      throw e;
    }
  };
  
  return { startWorkout, isGenerating, error, setError };
}