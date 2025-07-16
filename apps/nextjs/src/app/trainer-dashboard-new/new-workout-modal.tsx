"use client";

import { useState, useCallback, useMemo } from "react";
import { Button, Icon } from "@acme/ui-shared";
import { useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
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
}: NewWorkoutModalProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const filterMutation = useMutation(
    trpc.exercise.filterForWorkoutGeneration.mutationOptions()
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
      // Generate workout will be handled later
      console.log('Generate workout with:', workoutParams, filteredExercises);
    }
  }, [currentStep, workoutParams, filterMutation, clientId, filteredExercises]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null); // Clear any errors when going back
    }
  }, [currentStep]);

  const handleClose = useCallback(() => {
    // Reset state when closing
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
    setIsLoading(false);
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

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
              {isLoading ? 'Loading...' : nextButtonText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}