"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { 
  categorizeExercisesByRecommendation,
  filterExercisesBySearch,
  ExerciseListItem,
  SearchIcon,
  SpinnerIcon,
  XIcon
} from "@acme/ui-shared";

function ClientWorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId");
  const trpc = useTRPC();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(null);

  // Fetch workout data for this client and session
  const { data: workoutData, isLoading } = useQuery({
    ...trpc.workout.getClientWorkoutPublic.queryOptions({ 
      sessionId: sessionId || "", 
      userId: userId || "" 
    }),
    enabled: !!sessionId && !!userId,
  });

  // Fetch available exercises
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || ""
    }),
    enabled: !!sessionId && !!userId && showExerciseSelection,
  });

  const availableExercises = exercisesData?.exercises || [];

  // Reset states when modals close
  useEffect(() => {
    if (!modalOpen && !showExerciseSelection) {
      setSelectedExercise(null);
      setSelectedReplacement(null);
      setSearchQuery("");
    }
  }, [modalOpen, showExerciseSelection]);

  // Categorize exercises for the selection modal
  const categorizedExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return { recommended: [], other: [] };
    }

    // For now, we don't have blueprint recommendations in this context
    // So we'll just show all exercises in the "other" category
    const filtered = searchQuery.trim() 
      ? filterExercisesBySearch(availableExercises, searchQuery)
      : availableExercises;

    return {
      recommended: [],
      other: filtered
    };
  }, [availableExercises, searchQuery, showExerciseSelection, selectedExercise]);

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Link</h1>
            <p className="text-gray-600">
              The workout link appears to be invalid. Please check with your trainer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your workout...</p>
        </div>
      </div>
    );
  }

  // Empty state when no workout exists
  if (!workoutData || workoutData.exercises.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Confirmed Exercises</h1>
            
            <div className="space-y-4">
              <div className="p-6 bg-gray-50 rounded-lg text-center">
                <svg 
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h2 className="font-semibold text-gray-800 mt-4 mb-2">No Workout Yet</h2>
                <p className="text-gray-600">
                  Your workout hasn't been generated yet. Please check back after your trainer creates it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sort exercises by orderIndex to maintain proper order
  const sortedExercises = [...workoutData.exercises].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirmed Exercises</h1>
          
          <div className="space-y-2">
            {sortedExercises.map((exercise, index) => (
              <div 
                key={exercise.id}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{exercise.exercise.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedExercise(exercise);
                    setModalOpen(true);
                  }}
                  className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                  aria-label="Remove exercise"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Replace Exercise Modal */}
      {modalOpen && (
        <>
          {/* Background overlay */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => {
              setModalOpen(false);
              setSelectedExercise(null);
            }}
          />
          
          {/* Modal */}
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white rounded-2xl shadow-2xl z-50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Replace Exercise</h2>
            <p className="text-gray-600 mb-6">
              How would you like to replace "{selectedExercise?.exercise.name}"?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setShowExerciseSelection(true);
                }}
                className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Pick a replacement
              </button>
              
              <button
                onClick={() => {
                  // Handle AI choice
                  console.log("Let AI choose");
                  setModalOpen(false);
                }}
                className="w-full py-3 px-4 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Let AI choose
              </button>
            </div>
            
            {/* Close button */}
            <button
              onClick={() => {
                setModalOpen(false);
                setSelectedExercise(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </>
      )}
      
      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <>
          {/* Background overlay */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => {
              setShowExerciseSelection(false);
              setSelectedReplacement(null);
            }}
          />
          
          {/* Modal */}
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Change Exercise</h2>
                  <p className="text-sm text-gray-500 mt-1">Replacing: {selectedExercise?.exercise.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowExerciseSelection(false);
                    setSelectedReplacement(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Search Bar */}
              <div className="px-6 py-4 bg-gray-50 border-b sticky top-0 z-10">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isLoadingExercises}
                    className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 placeholder-gray-400"
                  />
                </div>
              </div>
              
              <div className="p-6">
                {/* Loading state */}
                {isLoadingExercises && (
                  <div className="text-center py-8">
                    <SpinnerIcon className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-500">Loading exercises...</p>
                  </div>
                )}
                
                {/* No results message */}
                {!isLoadingExercises && searchQuery.trim() && categorizedExercises.other.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No exercises found matching "{searchQuery}"</p>
                  </div>
                )}
                
                {/* All exercises */}
                {!isLoadingExercises && categorizedExercises.other.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Available Exercises</h3>
                    <div className="space-y-2">
                      {categorizedExercises.other.map((exercise: any, idx: number) => (
                        <ExerciseListItem
                          key={exercise.id || idx}
                          name={exercise.name}
                          isSelected={selectedReplacement === exercise.name}
                          onClick={() => setSelectedReplacement(exercise.name)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Empty state when no exercises available */}
                {!isLoadingExercises && !searchQuery.trim() && categorizedExercises.other.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No exercises available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => {
                  setShowExerciseSelection(false);
                  setSelectedReplacement(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // As requested, confirm doesn't do anything
                  console.log("Confirm clicked - no action taken");
                  setShowExerciseSelection(false);
                }}
                disabled={!selectedReplacement}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedReplacement
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientWorkoutOverview() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ClientWorkoutOverviewContent />
    </Suspense>
  );
}