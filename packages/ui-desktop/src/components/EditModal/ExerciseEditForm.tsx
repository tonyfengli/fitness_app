"use client";

import React, { useState, useMemo } from "react";
import { Button, Icon, Input } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import type { EditContext } from "./EditModal.types";

interface ExerciseEditFormProps {
  context: Extract<EditContext, { type: 'exercise' }>;
  currentData?: any;
  availableExercises: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type Step = 'choose-method' | 'select-exercise' | 'exercise-details';

// Group exercises by muscle
const groupByMuscle = (exercises: any[]) => {
  const grouped = exercises.reduce((acc, exercise) => {
    const muscle = exercise.primaryMuscle || "Other";
    if (!acc[muscle]) acc[muscle] = [];
    acc[muscle].push(exercise);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Sort by muscle name
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
};

// Badge colors for movement patterns
const MOVEMENT_PATTERN_COLORS: Record<string, string> = {
  horizontal_push: "bg-blue-100 text-blue-800",
  horizontal_pull: "bg-green-100 text-green-800",
  vertical_push: "bg-purple-100 text-purple-800",
  vertical_pull: "bg-indigo-100 text-indigo-800",
  squat: "bg-red-100 text-red-800",
  hinge: "bg-orange-100 text-orange-800",
  lunge: "bg-pink-100 text-pink-800",
  core: "bg-yellow-100 text-yellow-800",
  carry: "bg-teal-100 text-teal-800",
  isolation: "bg-gray-100 text-gray-800",
};

export function ExerciseEditForm({
  context,
  currentData,
  availableExercises,
  onSave,
  onCancel,
  isLoading = false,
}: ExerciseEditFormProps) {
  // Find the current exercise from availableExercises based on the name
  const currentExercise = useMemo(() => {
    return availableExercises.find(ex => ex.name === context.exerciseName);
  }, [availableExercises, context.exerciseName]);

  // Initialize with the current exercise pre-selected
  const [currentStep, setCurrentStep] = useState<Step>('choose-method');
  const [method, setMethod] = useState<'ai' | 'manual' | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<any>(currentExercise || null);
  const [sets, setSets] = useState<number>(currentData?.sets || 3);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return availableExercises;
    
    const query = searchQuery.toLowerCase();
    return availableExercises.filter(exercise => 
      exercise.name.toLowerCase().includes(query) ||
      exercise.primaryMuscle?.toLowerCase().includes(query) ||
      exercise.movementPattern?.toLowerCase().includes(query)
    );
  }, [availableExercises, searchQuery]);

  // Group filtered exercises by muscle
  const groupedExercises = useMemo(() => groupByMuscle(filteredExercises), [filteredExercises]);

  // Get step number for progress indicator
  const getStepNumber = (step: Step): number => {
    switch (step) {
      case 'choose-method': return 1;
      case 'select-exercise': return 2;
      case 'exercise-details': return 3;
      default: return 1;
    }
  };

  // Navigate to next step
  const goToNextStep = () => {
    switch (currentStep) {
      case 'choose-method':
        if (method === 'ai') {
          setCurrentStep('exercise-details');
          // For AI, we'll use a dummy exercise for now
          setSelectedExercise({
            id: 'ai-selected',
            name: 'AI Selected Exercise',
            primaryMuscle: 'AI Optimized',
          });
        } else {
          setCurrentStep('select-exercise');
        }
        break;
      case 'select-exercise':
        setCurrentStep('exercise-details');
        setSets(3); // Reset sets when new exercise is selected
        break;
      case 'exercise-details':
        handleSave();
        break;
    }
  };

  // Navigate to previous step
  const goToPreviousStep = () => {
    switch (currentStep) {
      case 'select-exercise':
        setCurrentStep('choose-method');
        break;
      case 'exercise-details':
        if (method === 'ai') {
          setCurrentStep('choose-method');
        } else {
          setCurrentStep('select-exercise');
        }
        break;
    }
  };

  // Check if can proceed to next step
  const canProceed = () => {
    switch (currentStep) {
      case 'choose-method':
        return method !== null;
      case 'select-exercise':
        return selectedExercise !== null;
      case 'exercise-details':
        return sets > 0;
      default:
        return false;
    }
  };

  const handleSave = () => {
    const data = {
      exerciseId: selectedExercise?.id,
      exerciseName: selectedExercise?.name,
      sets,
      method,
    };
    onSave(data);
  };

  // Progress indicator (show all 3 steps)
  const renderProgressIndicator = () => {
    const steps = [
      { key: 'choose-method', label: 'Choose Method' },
      { key: 'select-exercise', label: 'Select Exercise' },
      { key: 'exercise-details', label: 'Set Count' }
    ];
    
    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const currentStepNum = getStepNumber(currentStep);
          const isActive = stepNum === currentStepNum;
          const isCompleted = stepNum < currentStepNum;
          
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    isActive ? "bg-indigo-600 text-white" : 
                    isCompleted ? "bg-indigo-100 text-indigo-600" : 
                    "bg-gray-100 text-gray-400"
                  )}
                >
                  {stepNum}
                </div>
                <span className={cn(
                  "text-xs mt-2 text-center",
                  isActive ? "text-gray-900 font-medium" : "text-gray-500"
                )}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-24 h-0.5 mx-2 mt-5",
                  isCompleted ? "bg-indigo-600" : "bg-gray-200"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };


  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'choose-method':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">How would you like to select the exercise?</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setMethod('ai');
                  setCurrentStep('exercise-details');
                  // For AI, we'll use a dummy exercise for now
                  setSelectedExercise({
                    id: 'ai-selected',
                    name: 'AI Selected Exercise',
                    primaryMuscle: 'AI Optimized',
                  });
                }}
                className="p-6 rounded-xl border-2 text-left transition-all border-gray-200 hover:border-indigo-600 hover:bg-indigo-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
                    <Icon 
                      name="psychology" 
                      size={24} 
                      className="text-gray-600" 
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Let AI Decide</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Get an AI-optimized exercise selection based on your workout goals
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setMethod('manual');
                  setCurrentStep('select-exercise');
                }}
                className="p-6 rounded-xl border-2 text-left transition-all border-gray-200 hover:border-indigo-600 hover:bg-indigo-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
                    <Icon 
                      name="touch_app" 
                      size={24} 
                      className="text-gray-600" 
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Choose Your Selection</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Manually select from our comprehensive exercise library
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );

      case 'select-exercise':
        return (
          <div className="space-y-4">
            {/* Selected Exercise Display */}
            {selectedExercise && (
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-600 font-medium mb-1">Selected Exercise</p>
                <p className="text-lg font-semibold text-indigo-900">{selectedExercise.name}</p>
                {selectedExercise.primaryMuscle && (
                  <p className="text-sm text-indigo-700 mt-1">Muscle: {selectedExercise.primaryMuscle}</p>
                )}
              </div>
            )}

            <div className="relative">
              <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 w-full"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {groupedExercises.map(([muscle, exercises]) => {
                // Check if this muscle group contains the selected exercise
                const hasSelectedExercise = exercises.some(e => e.id === selectedExercise?.id);
                
                return (
                  <div key={muscle} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMuscle(expandedMuscle === muscle ? null : muscle)}
                      className={cn(
                        "w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors",
                        hasSelectedExercise && "bg-indigo-50"
                      )}
                    >
                      <span className="font-medium text-gray-900">{muscle}</span>
                      <div className="flex items-center gap-2">
                        {hasSelectedExercise && (
                          <Icon name="check_circle" size={18} className="text-indigo-600" />
                        )}
                        <Icon 
                          name={expandedMuscle === muscle ? "expand_less" : "expand_more"} 
                          size={20} 
                          className="text-gray-400"
                        />
                      </div>
                    </button>
                    
                    {expandedMuscle === muscle && (
                      <div className="divide-y divide-gray-100">
                        {exercises.map((exercise) => (
                          <button
                            key={exercise.id}
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setExpandedMuscle(null); // Close the expansion after selection
                            }}
                            className={cn(
                              "w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between transition-colors",
                              selectedExercise?.id === exercise.id && "bg-indigo-50 border-l-4 border-indigo-600"
                            )}
                          >
                            <div>
                              <p className="font-medium text-gray-900">{exercise.name}</p>
                              {exercise.movementPattern && (
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1",
                                  MOVEMENT_PATTERN_COLORS[exercise.movementPattern] || "bg-gray-100 text-gray-800"
                                )}>
                                  {exercise.movementPattern.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            {selectedExercise?.id === exercise.id && (
                              <Icon name="check" size={20} className="text-indigo-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'exercise-details':
        return (
          <div className="space-y-8">
            <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-sm text-indigo-600 font-medium uppercase tracking-wide">Selected Exercise</p>
              <p className="text-2xl font-bold text-indigo-900 mt-2">{selectedExercise?.name}</p>
            </div>

            <div className="text-center space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                  How many sets?
                </h3>
                <div className="flex justify-center items-center gap-4">
                  <button
                    onClick={() => setSets(Math.max(1, sets - 1))}
                    className="w-12 h-12 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <Icon name="remove" size={24} className="text-gray-600" />
                  </button>
                  <div className="w-32">
                    <Input
                      type="number"
                      value={sets}
                      onChange={(e) => setSets(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={10}
                      className="text-center text-3xl font-bold px-4 py-3"
                    />
                  </div>
                  <button
                    onClick={() => setSets(Math.min(10, sets + 1))}
                    className="w-12 h-12 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <Icon name="add" size={24} className="text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <>
      {renderProgressIndicator()}
      <div className="min-h-[300px]">
        {renderStepContent()}
      </div>
      
      {/* Footer Actions */}
      {currentStep === 'choose-method' ? (
        <div className="flex justify-center mt-8">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={goToPreviousStep}
            disabled={isLoading}
          >
            Back
          </Button>
          <Button
            onClick={goToNextStep}
            disabled={!canProceed() || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === 'exercise-details' ? (isLoading ? 'Saving...' : 'Save Changes') : 'Continue'}
          </Button>
        </div>
      )}
    </>
  );
}