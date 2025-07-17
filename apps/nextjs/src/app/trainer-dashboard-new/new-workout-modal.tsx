"use client";

import { useState, useCallback, useMemo } from "react";
import { Button, Icon } from "@acme/ui-shared";
import { useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isDebugEnabled } from "~/utils/debugConfig";

import type { WorkoutParameters, FilteredExercisesResult } from './types';
import {
  BasicSettingsStep,
  PreferencesStep,
  ReviewStep,
  ProgressIndicator
} from './components';

interface NewWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientProfile?: {
    strengthLevel: string;
    skillLevel: string;
    notes?: string;
  };
}

const STEPS = [
  { number: 1, label: 'Basic Settings' },
  { number: 2, label: 'Preferences' },
  { number: 3, label: 'Review' }
];

export default function NewWorkoutModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientProfile,
}: NewWorkoutModalProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const filterMutation = useMutation(
    trpc.exercise.filterForWorkoutGeneration.mutationOptions()
  );
  const generateWorkoutMutation = useMutation(
    trpc.workout.generateIndividual.mutationOptions()
  );
  
  const [currentStep, setCurrentStep] = useState(1);
  const [workoutParams, setWorkoutParams] = useState<WorkoutParameters>({
    sessionGoal: "strength",
    intensity: "moderate",
    template: "",
    includeExercises: [],
    avoidExercises: [],
    muscleTarget: [],
    muscleLessen: [],
    avoidJoints: [],
  });
  const [filteredExercises, setFilteredExercises] = useState<FilteredExercisesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Reset modal state function
  const resetModalState = useCallback(() => {
    setCurrentStep(1);
    setWorkoutParams({
      sessionGoal: "strength",
      intensity: "moderate",
      template: "",
      includeExercises: [],
      avoidExercises: [],
      muscleTarget: [],
      muscleLessen: [],
      avoidJoints: [],
    });
    setFilteredExercises(null);
    setError(null);
    setShowMore(false);
    setIsLoading(false);
    setIsFullscreen(false);
  }, []);

  const handleGenerateWorkout = useCallback(async () => {
    if (!filteredExercises) {
      setError('No filtered exercises available. Please go back and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Build exercises object for LLM (maintaining legacy format)
      const exercisesForLLM: any = {};
      
      if (filteredExercises.blocks) {
        // Format Block A
        if (filteredExercises.blocks.blockA) {
          exercisesForLLM.blockA = filteredExercises.blocks.blockA.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
            tags: ex.functionTags || [],
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment
          }));
        }
        
        // Format Block B
        if (filteredExercises.blocks.blockB) {
          exercisesForLLM.blockB = filteredExercises.blocks.blockB.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
            tags: ex.functionTags || [],
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment
          }));
        }
        
        // Format Block C
        if (filteredExercises.blocks.blockC) {
          exercisesForLLM.blockC = filteredExercises.blocks.blockC.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
            tags: ex.functionTags || [],
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment
          }));
        }
        
        // Format Block D
        if (filteredExercises.blocks.blockD) {
          exercisesForLLM.blockD = filteredExercises.blocks.blockD.map((ex: any) => ({
            id: ex.id,
            name: ex.name,
            score: ex.score || 0,
            tags: ex.functionTags || [],
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment
          }));
        }
      }

      // Step 2: Build client context (matching legacy format)
      const clientContext: Record<string, any> = {
        sessionGoal: workoutParams.sessionGoal,
        strength_capacity: clientProfile?.strengthLevel || 'moderate',
        skill_capacity: clientProfile?.skillLevel || 'moderate',
        intensity: workoutParams.intensity,
      };

      // Only add non-empty arrays
      if (workoutParams.includeExercises.length > 0) {
        clientContext.exercise_requests = { 
          include: workoutParams.includeExercises, 
          avoid: workoutParams.avoidExercises 
        };
      } else if (workoutParams.avoidExercises.length > 0) {
        clientContext.exercise_requests = { 
          include: [], 
          avoid: workoutParams.avoidExercises 
        };
      }
      
      if (workoutParams.muscleTarget.length > 0) {
        clientContext.muscle_target = workoutParams.muscleTarget;
      }
      
      if (workoutParams.muscleLessen.length > 0) {
        clientContext.muscle_lessen = workoutParams.muscleLessen;
      }

      // Step 3: Call the interpret-workout API
      const interpretResponse = await fetch('/api/interpret-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exercises: exercisesForLLM, clientContext }),
      });

      const interpretResult = await interpretResponse.json();

      if (!interpretResponse.ok || interpretResult.error) {
        throw new Error(interpretResult.error || 'Failed to interpret workout');
      }

      // Step 4: Generate the workout using the LLM interpretation
      const workoutName = `${workoutParams.template.replace("_", " ").toUpperCase()} Workout - ${new Date().toLocaleDateString()}`;
      const workoutDescription = `Individual ${workoutParams.template.replace("_", " ")} workout for ${clientName}`;

      // Add timing data to the structured output so it gets saved with the workout
      const workoutDataWithTiming = {
        ...interpretResult.structuredOutput,
        processingTime: interpretResult.timing ? 
          (interpretResult.timing.llmApiCall || 0) / 1000 : // Convert ms to seconds
          undefined,
        timing: interpretResult.timing
      };

      await generateWorkoutMutation.mutateAsync({
        userId: clientId,
        templateType: workoutParams.template as "standard" | "circuit" | "full_body",
        exercises: workoutDataWithTiming,
        workoutName,
        workoutDescription,
      });

      // Success - invalidate the workouts query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: [['workout', 'getClientWorkoutsWithExercises'], { input: { clientId } }]
      });
      
      // Reset modal state before closing
      resetModalState();
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error generating workout:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filteredExercises, workoutParams, clientId, clientName, generateWorkoutMutation, onClose, queryClient, resetModalState]);

  const handleNext = useCallback(async () => {
    if (currentStep === 1) {
      // Validate step 1 inputs
      if (!workoutParams.sessionGoal || !workoutParams.intensity || !workoutParams.template) {
        setError('Please fill in all required fields before proceeding.');
        return;
      }
      setError(null);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Call the filtering endpoint when going to review step
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await filterMutation.mutateAsync({
          clientId,
          sessionGoal: workoutParams.sessionGoal as 'strength' | 'stability',
          intensity: workoutParams.intensity as 'low' | 'moderate' | 'high',
          template: workoutParams.template as 'standard' | 'circuit' | 'full_body',
          includeExercises: workoutParams.includeExercises,
          avoidExercises: workoutParams.avoidExercises,
          muscleTarget: workoutParams.muscleTarget,
          muscleLessen: workoutParams.muscleLessen,
          avoidJoints: workoutParams.avoidJoints,
          debug: isDebugEnabled(),
        });
        
        setFilteredExercises(result);
        
        // Debug logging
        if (isDebugEnabled()) {
          console.log('=== WORKOUT FILTER RESULTS ===');
          console.log('Total exercises:', result.exercises?.length || 0);
          console.log('Block A:', result.blocks?.blockA?.length || 0);
          console.log('Block B:', result.blocks?.blockB?.length || 0);
          console.log('Block C:', result.blocks?.blockC?.length || 0);
          console.log('Block D:', result.blocks?.blockD?.length || 0);
          console.log('Timing:', result.timing);
          console.log('==============================');
        }
        
        setCurrentStep(3);
      } catch (err) {
        console.error('Failed to filter exercises:', err);
        setError('Failed to filter exercises. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 3) {
      // Generate workout
      await handleGenerateWorkout();
    }
  }, [currentStep, workoutParams, filterMutation, clientId, filteredExercises, handleGenerateWorkout]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null); // Clear any errors when going back
    }
  }, [currentStep]);

  const handleClose = useCallback(() => {
    // Reset state when closing
    resetModalState();
    onClose();
  }, [onClose, resetModalState]);

  const toggleShowMore = useCallback(() => {
    setShowMore(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const nextButtonText = useMemo(() => {
    if (currentStep === 3) return 'Generate Workout';
    return 'Next';
  }, [currentStep]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? '' : 'p-4'}`}>
        <div className={`bg-white shadow-xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'rounded-2xl max-w-2xl w-full h-[85vh]'
        }`}>
          {/* Header */}
          <div className="px-8 py-6 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New Workout</h2>
                <p className="text-gray-500 mt-1">Create a workout for {clientName}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleFullscreen}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={24} />
                </button>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="px-8 py-4 border-b bg-gray-50 flex-shrink-0">
            <ProgressIndicator currentStep={currentStep} steps={STEPS} />
          </div>

          {/* Content */}
          <div className="px-8 py-6 flex-1 overflow-y-auto">
            {currentStep === 1 && (
              <BasicSettingsStep
                workoutParams={workoutParams}
                onChange={setWorkoutParams}
              />
            )}
            
            {currentStep === 2 && (
              <PreferencesStep
                workoutParams={workoutParams}
                onChange={setWorkoutParams}
              />
            )}
            
            {currentStep === 3 && (
              <ReviewStep
                workoutParams={workoutParams}
                filteredExercises={filteredExercises}
                error={error}
                showMore={showMore}
                onToggleShowMore={toggleShowMore}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t bg-gray-50 flex justify-between flex-shrink-0">
            <div>
              {currentStep > 1 && (
                <Button
                  onClick={handleBack}
                  variant="secondary"
                  disabled={isLoading}
                >
                  Back
                </Button>
              )}
            </div>
            <Button
              onClick={handleNext}
              disabled={isLoading}
            >
              {isLoading ? (currentStep === 3 ? 'Generating Workout...' : 'Loading...') : nextButtonText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}