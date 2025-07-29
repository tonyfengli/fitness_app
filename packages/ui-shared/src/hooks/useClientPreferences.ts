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
  };
  exercise: {
    all: {
      queryOptions: (input: { limit: number }) => any;
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

  const exercises = getClientExercises();

  return {
    // Data
    clientData,
    selectionsData,
    availableExercises,
    exercises,
    isLoading,
    clientError,
    selectionsError,
    
    // Modal state
    modalOpen,
    setModalOpen,
    selectedExerciseForChange,
    setSelectedExerciseForChange,
    
    // Actions
    handleExerciseReplacement,
    handlePreferenceUpdate,
    isProcessingChange,
    
    // Utils
    getClientExercises
  };
}