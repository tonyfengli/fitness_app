import { useState } from 'react';
import { useNavigation } from '../App';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { transformWorkoutDataForLiveView } from '../utils/workoutDataTransformer';

export function useStartWorkout() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  
  // Create mutations following TV app pattern
  const generatePhase2Mutation = useMutation({
    ...api.trainingSession.generatePhase2Selections.mutationOptions(),
    onError: (error: any) => {
      console.error('[TV useStartWorkout] Phase 2 generation error:', error);
      setError(error.message || 'Failed to generate Phase 2 organization');
    },
    onSuccess: (data) => {
      console.log('[TV useStartWorkout] Phase 2 generation succeeded with data:', data);
    }
  });

  const updatePhase2Mutation = useMutation({
    ...api.trainingSession.updatePhase2Exercises.mutationOptions(),
    onError: (error: any) => {
      console.error('[TV useStartWorkout] Phase 2 update error:', error);
      setError(error.message || 'Failed to save Phase 2 updates');
    },
    onSuccess: () => {
      console.log('[TV useStartWorkout] Phase 2 exercises updated successfully');
    }
  });
  
  const startWorkout = async (sessionId: string) => {
    setIsGenerating(true);
    setError(null);
    setLoadingMessage('Preparing workout...');
    
    try {
      console.log('[TV useStartWorkout] Starting workout for session:', sessionId);
      
      // First, check if workout organization already exists
      const sessionQuery = await queryClient.fetchQuery(
        api.trainingSession.getById.queryOptions({ id: sessionId })
      );
      
      if (sessionQuery?.workoutOrganization) {
        console.log('[TV useStartWorkout] ✅ Workout already organized - skipping Phase 2 LLM');
        setLoadingMessage('Loading workout...');
        
        // Fetch the full workout data
        const workouts = await queryClient.fetchQuery(
          api.workoutSelections.getSelections.queryOptions({ sessionId })
        );
        const clients = await queryClient.fetchQuery(
          api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
        );
        
        // Transform the data for WorkoutLive screen
        const transformedOrganization = transformWorkoutDataForLiveView(
          sessionQuery.workoutOrganization,
          workouts
        );
        
        // Navigate directly to WorkoutLive
        setTimeout(() => {
          navigation.navigate('WorkoutLive', { 
            sessionId, 
            round: 1,
            organization: transformedOrganization,
            workouts: workouts,
            clients: clients
          });
          setTimeout(() => setIsGenerating(false), 100);
        }, 0);
        
        return {
          success: true,
          alreadyOrganized: true,
          workoutOrganization: sessionQuery.workoutOrganization
        };
      }
      
      // No existing organization - need to generate Phase 2
      console.log('[TV useStartWorkout] No existing organization - generating Phase 2');
      setLoadingMessage('Organizing workout rounds...');
      
      // Get preprocessing data for fixed assignments
      const preprocessData = await queryClient.fetchQuery(
        api.trainingSession.previewPhase2Data.queryOptions({ sessionId })
      );
      
      // Generate Phase 2 selections
      const phase2Result = await generatePhase2Mutation.mutateAsync({ sessionId });
      
      console.log('[TV useStartWorkout] Phase 2 generation result:', {
        hasSelections: !!phase2Result.selections,
        placementsCount: phase2Result.selections?.placements?.length,
        hasRoundNames: !!phase2Result.selections?.roundNames
      });
      
      // Prepare fixed assignments from preprocessing data
      const fixedAssignments = preprocessData?.allowedSlots?.fixedAssignments?.map(fa => ({
        exerciseId: fa.exerciseId,
        clientId: fa.clientId,
        round: fa.round,
      })) || [];
      
      // Include LLM data from the Phase 2 result
      const llmData = {
        systemPrompt: phase2Result.systemPrompt,
        humanMessage: phase2Result.humanMessage,
        llmResponse: phase2Result.llmResponse,
        timing: phase2Result.timing,
      };
      
      // Update database with Phase 2 results
      await updatePhase2Mutation.mutateAsync({
        sessionId,
        placements: phase2Result.selections.placements,
        roundNames: phase2Result.selections.roundNames || {},
        fixedAssignments: fixedAssignments,
        llmData: llmData,
      });
      
      console.log('[TV useStartWorkout] Phase 2 saved to database');
      
      // Invalidate and refetch session data to get the updated workoutOrganization
      await queryClient.invalidateQueries({
        queryKey: [["trainingSession", "getById"], { input: { id: sessionId } }]
      });
      
      const updatedSession = await queryClient.fetchQuery(
        api.trainingSession.getById.queryOptions({ id: sessionId })
      );
      
      // Fetch the updated workout data
      const workouts = await queryClient.fetchQuery(
        api.workoutSelections.getSelections.queryOptions({ sessionId })
      );
      const clients = await queryClient.fetchQuery(
        api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
      );
      
      console.log('[TV useStartWorkout] Phase 2 complete, navigating with organization data');
      
      // Transform the data for WorkoutLive screen
      const organizationData = updatedSession?.workoutOrganization || {
        placements: phase2Result.selections.placements,
        roundNames: phase2Result.selections.roundNames,
        fixedAssignments: fixedAssignments,
        llmData: llmData,
        generatedAt: new Date().toISOString()
      };
      
      const transformedOrganization = transformWorkoutDataForLiveView(
        organizationData,
        workouts
      );
      
      // Navigate to WorkoutLive with the updated data
      setTimeout(() => {
        navigation.navigate('WorkoutLive', { 
          sessionId, 
          round: 1,
          organization: transformedOrganization,
          workouts: workouts,
          clients: clients
        });
        setTimeout(() => setIsGenerating(false), 100);
      }, 0);
      
      return {
        success: true,
        alreadyOrganized: false,
        workoutOrganization: updatedSession?.workoutOrganization || phase2Result.selections
      };
      
    } catch (e: any) {
      console.error('[TV useStartWorkout] Error:', e);
      setError(e.message || 'Failed to start workout');
      setIsGenerating(false);
      throw e;
    }
  };
  
  return { startWorkout, isGenerating, error, setError };
}