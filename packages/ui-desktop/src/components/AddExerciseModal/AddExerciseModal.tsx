"use client";

import React, { useState, useMemo } from "react";
import { Input, Button, Icon, cn } from "@acme/ui-shared";
import type { AddExerciseModalProps } from "./AddExerciseModal.types";

// Group exercises by primary muscle
const groupByMuscle = (exercises: any[]) => {
  const grouped = exercises.reduce((acc, exercise) => {
    const muscle = exercise.primaryMuscle || "Other";
    if (!acc[muscle]) acc[muscle] = [];
    acc[muscle].push(exercise);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Sort muscle groups alphabetically
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
};

// Movement pattern badge colors
const MOVEMENT_COLORS = {
  push: "bg-blue-100 text-blue-700",
  pull: "bg-green-100 text-green-700",
  squat: "bg-purple-100 text-purple-700",
  hinge: "bg-orange-100 text-orange-700",
  lunge: "bg-pink-100 text-pink-700",
  carry: "bg-yellow-100 text-yellow-700",
  isolation: "bg-gray-100 text-gray-700",
} as const;

type Step = 'select-exercise' | 'exercise-details';

export function AddExerciseModal({
  isOpen,
  onClose,
  onAdd,
  blockName,
  exercises = [],
}: AddExerciseModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('select-exercise');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
  const [sets, setSets] = useState(3);
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    
    const query = searchQuery.toLowerCase();
    return exercises.filter(exercise => 
      exercise.name.toLowerCase().includes(query) ||
      exercise.primaryMuscle?.toLowerCase().includes(query) ||
      exercise.movementPattern?.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  // Group filtered exercises by muscle
  const groupedExercises = useMemo(() => 
    groupByMuscle(filteredExercises),
    [filteredExercises]
  );

  const resetState = () => {
    setCurrentStep('select-exercise');
    setSelectedExercise(null);
    setSets(3);
    setSearchQuery("");
    setExpandedMuscle(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAdd = () => {
    if (selectedExercise) {
      onAdd(selectedExercise.id, sets);
      handleClose();
    }
  };

  const handleExerciseClick = (exercise: any) => {
    setSelectedExercise(exercise);
    setExpandedMuscle(null); // Close the expansion after selection
    setCurrentStep('exercise-details'); // Automatically move to next step
  };

  const goToNextStep = () => {
    if (currentStep === 'select-exercise' && selectedExercise) {
      setCurrentStep('exercise-details');
    } else if (currentStep === 'exercise-details') {
      handleAdd();
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'exercise-details') {
      setCurrentStep('select-exercise');
    }
  };

  const canProceed = () => {
    if (currentStep === 'select-exercise') {
      return selectedExercise !== null;
    } else if (currentStep === 'exercise-details') {
      return sets > 0;
    }
    return false;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      >
        {/* Modal */}
        <div className="flex items-center justify-center p-4 h-full">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="add-exercise-modal"
          >
          {/* Header */}
          <div className="px-8 py-6 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add Exercise</h2>
                <p className="text-gray-500 mt-1">Add an exercise to {blockName}</p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="close" size={24} />
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="px-8 py-6 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-center">
              {['select-exercise', 'exercise-details'].map((step, index) => {
                const stepNum = index + 1;
                const isActive = step === currentStep;
                const isCompleted = (currentStep === 'exercise-details' && step === 'select-exercise');
                
                return (
                  <React.Fragment key={step}>
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
                        {step === 'select-exercise' ? 'Select Exercise' : 'Set Count'}
                      </span>
                    </div>
                    {index < 1 && (
                      <div className={cn(
                        "w-24 h-0.5 mx-2 mt-5",
                        isCompleted ? "bg-indigo-600" : "bg-gray-200"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {currentStep === 'select-exercise' ? (
              <>
                {/* Search */}
                <div className="px-8 py-4 bg-gray-50 border-b">
                  <div className="relative">
                    <Icon 
                      name="search" 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                      size={20}
                    />
                    <Input
                      placeholder="Search by name, muscle, or movement..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="exercise-search-input"
                    />
                  </div>
                </div>

                {/* Exercise List */}
                <div className="px-8 py-6">
            {/* Selected Exercise Display */}
            {selectedExercise && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-600 font-medium mb-1">Selected Exercise</p>
                <p className="text-lg font-semibold text-indigo-900">{selectedExercise.name}</p>
                {selectedExercise.primaryMuscle && (
                  <p className="text-sm text-indigo-700 mt-1">Muscle: {selectedExercise.primaryMuscle}</p>
                )}
              </div>
            )}

            {groupedExercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No exercises found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-4 pb-4">
              {groupedExercises.map(([muscle, muscleExercises]) => {
                // Check if this muscle group contains the selected exercise
                const hasSelectedExercise = muscleExercises.some(e => e.id === selectedExercise?.id);
                
                return (
                <div key={muscle} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedMuscle(expandedMuscle === muscle ? null : muscle)}
                    className={`w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors ${
                      hasSelectedExercise ? 'bg-indigo-50' : ''
                    }`}
                    data-testid="exercise-select"
                  >
                    <span className="font-medium text-gray-700">{muscle}</span>
                    <div className="flex items-center gap-2">
                      {hasSelectedExercise && (
                        <Icon name="check_circle" size={18} className="text-indigo-600" />
                      )}
                      <Icon 
                        name={expandedMuscle === muscle ? "expand_less" : "expand_more"} 
                        className="text-gray-400"
                        size={20}
                      />
                    </div>
                  </button>
                  
                  {expandedMuscle === muscle && (
                    <div className="divide-y divide-gray-100">
                      {muscleExercises.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleExerciseClick(exercise)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                            selectedExercise?.id === exercise.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                          }`}
                          data-testid="exercise-option"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{exercise.name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {exercise.movementPattern && (
                                  <span 
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      MOVEMENT_COLORS[exercise.movementPattern as keyof typeof MOVEMENT_COLORS] || "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {exercise.movementPattern}
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedExercise?.id === exercise.id && (
                              <Icon name="check" className="text-indigo-600 ml-2" size={20} />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
              })}
              </div>
            )}
                </div>
              </>
            ) : (
              /* Exercise Details Step */
              <div className="px-8 py-8">
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
                            data-testid="sets-input"
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
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t bg-gray-50 flex-shrink-0">
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={currentStep === 'select-exercise' ? handleClose : goToPreviousStep}
              >
                {currentStep === 'select-exercise' ? 'Cancel' : 'Back'}
              </Button>
              <Button
                onClick={goToNextStep}
                disabled={!canProceed()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid={currentStep === 'exercise-details' ? 'add-exercise-button' : 'modal-next-button'}
              >
                {currentStep === 'exercise-details' ? 'Add Exercise' : 'Continue'}
              </Button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}