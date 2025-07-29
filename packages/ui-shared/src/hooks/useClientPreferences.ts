'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

// We'll need to import these from the app that uses this hook
// For now, we'll define the interface
interface TRPCClient {
  trainingSession: {
    getClientPreferenceData: {
      queryOptions: (input: { sessionId: string; userId: string }) => any;
    };
    getClientDeterministicSelections: {
      queryOptions: (input: { sessionId: string; userId: string }) => any;
    };
    replaceClientExercisePublic: {
      mutationOptions: () => any;
    };
    addClientExercise: {
      mutationOptions: () => any;
    };
  };
  exercise: {
    all: {
      queryOptions: (input: { limit: number }) => any;
    };
  };
  workoutPreferences: {
    addMuscleTargetPublic: {
      mutationOptions: () => any;
    };
    addMuscleLessenPublic: {
      mutationOptions: () => any;
    };
    removeMuscleTargetPublic: {
      mutationOptions: () => any;
    };
    removeMuscleLessenPublic: {
      mutationOptions: () => any;
    };
    getForUserSessionPublic: {
      queryOptions: (input: { sessionId: string; userId: string }) => any;
    };
  };
}

interface UseClientPreferencesProps {
  sessionId: string;
  userId: string;
  trpc: TRPCClient;
}

interface Exercise {
  name: string;
  confirmed: boolean;
  round: string | null;
  isExcluded: boolean;
  isActive: boolean;
}

export function useClientPreferences({ sessionId, userId, trpc }: UseClientPreferencesProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExerciseForChange, setSelectedExerciseForChange] = useState<{
    name: string;
    index: number;
    round?: string;
  } | null>(null);
  const [isProcessingChange, setIsProcessingChange] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);

  // Fetch client data using public endpoint
  const { data: clientData, isLoading: clientLoading, error: clientError } = useQuery(
    trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId })
  );

  // Fetch deterministic selections using public endpoint
  const selectionsQueryOptions = trpc.trainingSession.getClientDeterministicSelections.queryOptions({ sessionId, userId });
  const { data: selectionsData, isLoading: selectionsLoading, error: selectionsError } = useQuery(
    selectionsQueryOptions
  );

  // Fetch all available exercises
  const { data: availableExercises, isLoading: exercisesLoading } = useQuery(
    trpc.exercise.all.queryOptions({ limit: 1000 })
  );

  const isLoading = clientLoading || selectionsLoading || exercisesLoading;

  // Get exercises from deterministic selections or workout preferences
  const getClientExercises = (): Exercise[] => {
    if (!selectionsData) return [];
    
    const exercisesList = selectionsData.exercises || selectionsData.selections || [];
    const avoidedExercises = clientData?.user?.preferences?.avoidExercises || [];
    const includeExercises = clientData?.user?.preferences?.includeExercises || [];
    
    const exercises: Exercise[] = [];
    
    // First, add current active exercises
    exercisesList.forEach((sel: any) => {
      exercises.push({
        name: sel.exercise.name,
        confirmed: false,
        round: sel.roundId,
        isExcluded: false,
        isActive: true
      });
    });
    
    // Then, add excluded exercises that were previously replaced
    avoidedExercises.forEach((excludedExercise: string) => {
      if (!exercises.find(ex => ex.name === excludedExercise)) {
        exercises.push({
          name: excludedExercise,
          confirmed: false,
          round: null,
          isExcluded: true,
          isActive: false
        });
      }
    });
    
    // Add manually included exercises from preferences
    includeExercises.forEach((includedExercise: string) => {
      // Only add if not already in the list
      if (!exercises.find(ex => ex.name === includedExercise)) {
        exercises.push({
          name: includedExercise,
          confirmed: true,
          round: null,
          isExcluded: false,
          isActive: true
        });
      }
    });
    
    return exercises;
  };

  // Exercise replacement mutation with optimistic updates
  const replaceExerciseMutation = useMutation({
    ...trpc.trainingSession.replaceClientExercisePublic.mutationOptions(),
    onMutate: async (variables: any) => {
      setIsProcessingChange(true);
      
      // Use the exact same query key that tRPC generates
      const queryKey = selectionsQueryOptions.queryKey;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousSelections = queryClient.getQueryData(queryKey);
      
      // Perform optimistic update
      if (previousSelections && selectedExerciseForChange) {
        const newSelections = { ...previousSelections } as any;
        const exercises = newSelections.exercises || newSelections.selections || [];
        
        // Update the exercise for the specific round
        const updatedExercises = exercises.map((sel: any) => {
          if (sel.roundId === variables.round) {
            return {
              ...sel,
              exercise: {
                ...sel.exercise,
                name: variables.newExerciseName
              }
            };
          }
          return sel;
        });
        
        // Update both properties for compatibility
        newSelections.exercises = updatedExercises;
        newSelections.selections = updatedExercises;
        
        // Update the query cache
        queryClient.setQueryData(queryKey, newSelections);
        
        // Update preferences to mark the old exercise as avoided
        const prefsQueryKey = trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey;
        const previousPrefs = queryClient.getQueryData(prefsQueryKey) as any;
        
        if (previousPrefs && selectedExerciseForChange) {
          const avoidExercises = previousPrefs.user?.preferences?.avoidExercises || [];
          if (!avoidExercises.includes(selectedExerciseForChange.name)) {
            queryClient.setQueryData(prefsQueryKey, {
              ...previousPrefs,
              user: {
                ...previousPrefs.user,
                preferences: {
                  ...previousPrefs.user.preferences,
                  avoidExercises: [...avoidExercises, selectedExerciseForChange.name]
                }
              }
            });
          }
        }
      }
      
      // Return snapshot for potential rollback on error
      return { previousSelections };
    },
    onSuccess: () => {
      // Clean up state and close modal
      setModalOpen(false);
      setSelectedExerciseForChange(null);
      setIsProcessingChange(false);
    },
    onError: (error: any, variables: any, context: any) => {
      console.error('[ClientPreferences] Exercise replacement failed:', error);
      setIsProcessingChange(false);
      
      // Revert the optimistic update on error
      if (context?.previousSelections) {
        queryClient.setQueryData(
          selectionsQueryOptions.queryKey,
          context.previousSelections
        );
      }
    }
  });

  // Handle exercise replacement
  const handleExerciseReplacement = async (newExerciseName: string) => {
    if (!selectedExerciseForChange?.round) return;

    await replaceExerciseMutation.mutateAsync({
      sessionId,
      userId,
      round: selectedExerciseForChange.round as 'Round1' | 'Round2',
      newExerciseName
    });
  };

  // Handle preference update from realtime
  const handlePreferenceUpdate = useCallback((update: any) => {
    // Only update if it's for this user
    if (update.userId === userId) {
      // Update the preferences cache
      const prefsQueryKey = trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey;
      const currentPrefs = queryClient.getQueryData(prefsQueryKey) as any;
      
      if (currentPrefs) {
        queryClient.setQueryData(prefsQueryKey, {
          ...currentPrefs,
          user: {
            ...currentPrefs.user,
            preferences: update.preferences
          }
        });
      }
    }
  }, [userId, sessionId, queryClient, trpc]);

  // Add exercise mutation with optimistic updates
  const addExerciseMutation = useMutation({
    ...trpc.trainingSession.addClientExercise.mutationOptions(),
    onMutate: async (variables: any) => {
      setIsAddingExercise(true);
      
      // Cancel any outgoing refetches
      const prefsQueryKey = trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey;
      await queryClient.cancelQueries({ queryKey: prefsQueryKey });
      
      // Snapshot the previous value
      const previousPrefs = queryClient.getQueryData(prefsQueryKey) as any;
      
      // Perform optimistic update
      if (previousPrefs) {
        const currentIncludeExercises = previousPrefs.user?.preferences?.includeExercises || [];
        
        queryClient.setQueryData(prefsQueryKey, {
          ...previousPrefs,
          user: {
            ...previousPrefs.user,
            preferences: {
              ...previousPrefs.user.preferences,
              includeExercises: [...currentIncludeExercises, variables.exerciseName]
            }
          }
        });
      }
      
      // Return snapshot for potential rollback on error
      return { previousPrefs };
    },
    onSuccess: () => {
      // Clean up state and close modal
      setAddModalOpen(false);
      setIsAddingExercise(false);
      
      // Invalidate preferences query to ensure fresh data
      const prefsQueryKey = trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey;
      queryClient.invalidateQueries({ queryKey: prefsQueryKey });
    },
    onError: (error: any, variables: any, context: any) => {
      console.error('[ClientPreferences] Add exercise failed:', error);
      setIsAddingExercise(false);
      
      // Revert the optimistic update on error
      if (context?.previousPrefs) {
        const prefsQueryKey = trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey;
        queryClient.setQueryData(prefsQueryKey, context.previousPrefs);
      }
    }
  });

  // Handle adding exercise
  const handleAddExercise = async (exerciseName: string) => {
    console.log('[useClientPreferences] Adding exercise:', exerciseName);
    try {
      await addExerciseMutation.mutateAsync({
        sessionId,
        userId,
        exerciseName
      });
      console.log('[useClientPreferences] Exercise added successfully');
    } catch (error) {
      console.error('[useClientPreferences] Failed to add exercise:', error);
      throw error;
    }
  };

  // Fetch workout preferences for muscle data
  const { data: workoutPreferences } = useQuery(
    trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId })
  );

  // Add muscle target mutation
  const addMuscleTargetMutation = useMutation({
    ...trpc.workoutPreferences.addMuscleTargetPublic.mutationOptions(),
    onMutate: async ({ muscle }) => {
      console.log('[useClientPreferences] Adding muscle target:', muscle);
      // Optimistic update
      const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) {
          return {
            muscleTargets: [muscle],
            muscleLessens: []
          };
        }
        return {
          ...old,
          muscleTargets: [...(old.muscleTargets || []), muscle]
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      console.error('[useClientPreferences] Failed to add muscle target:', err);
      if (context?.previousData) {
        const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate client data to refresh the view
      queryClient.invalidateQueries({ 
        queryKey: trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey 
      });
    }
  });

  // Add muscle lessen mutation
  const addMuscleLessenMutation = useMutation({
    ...trpc.workoutPreferences.addMuscleLessenPublic.mutationOptions(),
    onMutate: async ({ muscle }) => {
      console.log('[useClientPreferences] Adding muscle lessen:', muscle);
      // Optimistic update
      const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) {
          return {
            muscleTargets: [],
            muscleLessens: [muscle]
          };
        }
        return {
          ...old,
          muscleLessens: [...(old.muscleLessens || []), muscle]
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      console.error('[useClientPreferences] Failed to add muscle lessen:', err);
      if (context?.previousData) {
        const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate client data to refresh the view
      queryClient.invalidateQueries({ 
        queryKey: trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey 
      });
    }
  });

  // Handle adding muscle preference
  const handleAddMusclePreference = async (muscle: string, type: 'target' | 'limit') => {
    try {
      if (type === 'target') {
        await addMuscleTargetMutation.mutateAsync({
          sessionId,
          userId,
          muscle
        });
        console.log('[useClientPreferences] Muscle target added successfully');
      } else {
        await addMuscleLessenMutation.mutateAsync({
          sessionId,
          userId,
          muscle
        });
        console.log('[useClientPreferences] Muscle limit added successfully');
      }
    } catch (error) {
      console.error('[useClientPreferences] Failed to add muscle preference:', error);
      throw error;
    }
  };

  // Remove muscle target mutation
  const removeMuscleTargetMutation = useMutation({
    ...trpc.workoutPreferences.removeMuscleTargetPublic.mutationOptions(),
    onMutate: async ({ muscle }) => {
      console.log('[useClientPreferences] Removing muscle target:', muscle);
      // Optimistic update
      const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          muscleTargets: (old.muscleTargets || []).filter((m: string) => m !== muscle)
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      console.error('[useClientPreferences] Failed to remove muscle target:', err);
      if (context?.previousData) {
        const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate client data to refresh the view
      queryClient.invalidateQueries({ 
        queryKey: trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey 
      });
    }
  });

  // Remove muscle lessen mutation
  const removeMuscleLessenMutation = useMutation({
    ...trpc.workoutPreferences.removeMuscleLessenPublic.mutationOptions(),
    onMutate: async ({ muscle }) => {
      console.log('[useClientPreferences] Removing muscle lessen:', muscle);
      // Optimistic update
      const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          muscleLessens: (old.muscleLessens || []).filter((m: string) => m !== muscle)
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      console.error('[useClientPreferences] Failed to remove muscle lessen:', err);
      if (context?.previousData) {
        const queryKey = trpc.workoutPreferences.getForUserSessionPublic.queryOptions({ sessionId, userId }).queryKey;
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate client data to refresh the view
      queryClient.invalidateQueries({ 
        queryKey: trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId }).queryKey 
      });
    }
  });

  // Handle removing muscle preference
  const handleRemoveMusclePreference = async (muscle: string, type: 'target' | 'limit') => {
    try {
      if (type === 'target') {
        await removeMuscleTargetMutation.mutateAsync({
          sessionId,
          userId,
          muscle
        });
        console.log('[useClientPreferences] Muscle target removed successfully');
      } else {
        await removeMuscleLessenMutation.mutateAsync({
          sessionId,
          userId,
          muscle
        });
        console.log('[useClientPreferences] Muscle limit removed successfully');
      }
    } catch (error) {
      console.error('[useClientPreferences] Failed to remove muscle preference:', error);
      throw error;
    }
  };

  const exercises = getClientExercises();
  const isAddingMuscle = addMuscleTargetMutation.isPending || addMuscleLessenMutation.isPending;
  const isRemovingMuscle = removeMuscleTargetMutation.isPending || removeMuscleLessenMutation.isPending;

  return {
    // Data
    clientData,
    selectionsData,
    availableExercises,
    exercises,
    isLoading,
    clientError,
    selectionsError,
    
    // Modal state - Exercise Change
    modalOpen,
    setModalOpen,
    selectedExerciseForChange,
    setSelectedExerciseForChange,
    
    // Modal state - Add Exercise
    addModalOpen,
    setAddModalOpen,
    
    // Actions
    handleExerciseReplacement,
    handleAddExercise,
    handlePreferenceUpdate,
    
    // State
    isProcessingChange,
    isAddingExercise,
    isAddingMuscle,
    
    // Muscle preferences
    handleAddMusclePreference,
    handleRemoveMusclePreference,
    workoutPreferences,
    isRemovingMuscle,
    
    // Utils
    getClientExercises
  };
}