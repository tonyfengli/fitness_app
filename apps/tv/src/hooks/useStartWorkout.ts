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
    }
  });

  const updatePhase2Mutation = useMutation({
    ...api.trainingSession.updatePhase2Exercises.mutationOptions(),
    onError: (error: any) => {
      console.error('[TV useStartWorkout] Phase 2 update error:', error);
      setError(error.message || 'Failed to save Phase 2 updates');
    },
    onSuccess: () => {
    }
  });
  
  const startWorkout = async (sessionId: string) => {
    setIsGenerating(true);  // Show loading state on button
    setError(null);
    setLoadingMessage('Preparing workout...');
    
    try {
      
      // First, check if workout organization already exists
      const sessionQuery = await queryClient.fetchQuery(
        api.trainingSession.getById.queryOptions({ id: sessionId })
      );
      
      if (sessionQuery?.workoutOrganization) {
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
        
        setIsGenerating(false); // Hide loading state
        
        // Navigate directly to WorkoutLive
        navigation.navigate('WorkoutLive', { 
          sessionId, 
          round: 1,
          organization: transformedOrganization,
          workouts: workouts,
          clients: clients
        });
        
        return {
          success: true,
          alreadyOrganized: true,
          workoutOrganization: sessionQuery.workoutOrganization
        };
      }
      
      // No existing organization - need to generate Phase 2
      setLoadingMessage('Preparing workout data...');
      
      // Get preprocessing data for fixed assignments  
      const preprocessData = await queryClient.fetchQuery(
        api.trainingSession.previewPhase2Data.queryOptions({ sessionId })
      );
      
      // Get initial workouts and clients data
      const workouts = await queryClient.fetchQuery(
        api.workoutSelections.getSelections.queryOptions({ sessionId })
      );
      const clients = await queryClient.fetchQuery(
        api.trainingSession.getCheckedInClients.queryOptions({ sessionId })
      );
      
      // Get total rounds from preprocessing
      const totalRounds = preprocessData?.roundOrganization?.majorityRounds || 5;
      
      // Create a complete organization with Round 1 from preprocessing
      // Include empty round names for all rounds so dots render correctly
      const roundNames: Record<string, string> = {};
      for (let i = 1; i <= totalRounds; i++) {
        roundNames[i.toString()] = `Round ${i}`;
      }
      
      const round1Organization = {
        placements: [],
        roundNames: roundNames,
        fixedAssignments: preprocessData?.allowedSlots?.fixedAssignments || [],
        isLoading: true, // Flag to indicate Phase 2 is still running
        totalRounds: totalRounds
      };
      
      // Transform the Round 1 data
      const transformedRound1Organization = transformWorkoutDataForLiveView(
        round1Organization,
        workouts
      );
      
      setIsGenerating(false); // Hide loading state on button
      // Navigate to WorkoutLive with Round 1 data
      navigation.navigate('WorkoutLive', { 
        sessionId, 
        round: 1,
        organization: transformedRound1Organization,
        workouts: workouts,
        clients: clients,
        isPhase2Loading: true, // Flag to show "Finalizing Workout..."
        totalRounds: totalRounds
      });
      
      // Continue with Phase 2 generation in the background
      // Generate Phase 2 in the background without blocking
      generatePhase2Mutation.mutateAsync({ sessionId })
        .then(async (phase2Result) => {
          
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
          
          // Invalidate and refetch session data to get the updated workoutOrganization
          await queryClient.invalidateQueries({
            queryKey: [["trainingSession", "getById"], { input: { id: sessionId } }]
          });
          
          const updatedSession = await queryClient.fetchQuery(
            api.trainingSession.getById.queryOptions({ id: sessionId })
          );
          
          // Fetch the updated workout data
          const updatedWorkouts = await queryClient.fetchQuery(
            api.workoutSelections.getSelections.queryOptions({ sessionId })
          );
          
          // Transform the complete data
          const organizationData = updatedSession?.workoutOrganization || {
            placements: phase2Result.selections.placements,
            roundNames: phase2Result.selections.roundNames,
            fixedAssignments: fixedAssignments,
            llmData: llmData,
            generatedAt: new Date().toISOString()
          };
          
          const transformedOrganization = transformWorkoutDataForLiveView(
            organizationData,
            updatedWorkouts
          );
          
          // Since navigation.setParams is not available in TV app, 
          // the WorkoutLive screen will need to poll for updates
        })
        .catch((phase2Error) => {
          console.error('[TV useStartWorkout] Phase 2 generation failed:', phase2Error);
          // Can't update params, WorkoutLive will need to handle this
        });
      
      return {
        success: true,
        alreadyOrganized: false,
        workoutOrganization: null // Phase 2 will complete asynchronously
      };
      
    } catch (e: any) {
      console.error('[TV useStartWorkout] Error:', e);
      setError(e.message || 'Failed to start workout');
      setIsGenerating(false); // Hide loading state on error
      throw e;
    }
  };
  
  return { startWorkout, isGenerating, error, setError };
}