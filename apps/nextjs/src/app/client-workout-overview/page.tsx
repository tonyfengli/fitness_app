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

const AVATAR_API_URL = "https://api.dicebear.com/7.x/avataaars/svg";

interface SelectedExercise {
  exerciseId: string;
  exerciseName: string;
  reasoning: string;
  isShared: boolean;
}

function ClientWorkoutOverviewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId");
  const trpc = useTRPC();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(null);

  // Fetch visualization data
  const { data: visualizationData, isLoading } = useQuery({
    ...trpc.trainingSession.getSavedVisualizationDataPublic.queryOptions({ 
      sessionId: sessionId || "",
      userId: userId || ""
    }),
    enabled: !!sessionId && !!userId,
  });

  // We'll get user info from the visualization data instead

  // Fetch available exercises
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    ...trpc.exercise.getAvailablePublic.queryOptions({
      sessionId: sessionId || "",
      userId: userId || ""
    }),
    enabled: !!sessionId && !!userId && showExerciseSelection,
  });

  const availableExercises = exercisesData?.exercises || [];

  // Extract exercises for this specific client
  const clientExercises = useMemo(() => {
    if (!visualizationData || !userId) return [];
    
    const llmResult = visualizationData.llmResult;
    const groupContext = visualizationData.groupContext;
    
    if (!llmResult || !groupContext) return [];

    // Debug logging
    console.log('Visualization data:', visualizationData);
    console.log('LLM Result:', llmResult);
    console.log('Looking for userId:', userId);

    // Find the client's information
    const clientIndex = groupContext.clients.findIndex((c: any) => c.user_id === userId);
    if (clientIndex === -1) return [];
    
    const client = groupContext.clients[clientIndex];
    const exercises: any[] = [];
    
    // Get pre-assigned exercises from the blueprint
    const blueprint = visualizationData.blueprint;
    if (blueprint?.clientExercisePools?.[userId]) {
      const preAssigned = blueprint.clientExercisePools[userId].preAssigned || [];
      preAssigned.forEach((pa: any, index: number) => {
        exercises.push({
          id: pa.exercise.id,
          name: pa.exercise.name,
          source: pa.source,
          reasoning: `Pre-assigned from ${pa.source.toLowerCase()}`,
          isPreAssigned: true,
          orderIndex: index
        });
      });
    }
    
    // Get LLM selected exercises
    console.log('Checking for LLM selections at:', {
      path1: llmResult.exerciseSelection?.clientSelections?.[userId],
      path2: llmResult.llmAssignments,
      hasExerciseSelection: !!llmResult.exerciseSelection,
      hasClientSelections: !!llmResult.exerciseSelection?.clientSelections,
      clientIds: llmResult.exerciseSelection?.clientSelections ? Object.keys(llmResult.exerciseSelection.clientSelections) : [],
      actualUserId: userId,
      clientsInContext: groupContext.clients.map((c: any) => ({ user_id: c.user_id, name: c.name }))
    });

    // Check multiple possible paths for the LLM selections
    let llmSelections = null;
    
    // First, check if exerciseSelection is a string that needs parsing
    let exerciseSelection = llmResult.exerciseSelection;
    if (typeof exerciseSelection === 'string') {
      try {
        exerciseSelection = JSON.parse(exerciseSelection);
        console.log('Parsed exerciseSelection from string');
      } catch (e) {
        console.log('Failed to parse exerciseSelection string');
      }
    }
    
    // Path 1: exerciseSelection.clientSelections
    if (exerciseSelection?.clientSelections?.[userId]) {
      // The structure uses 'selected' not 'selectedExercises'
      llmSelections = exerciseSelection.clientSelections[userId].selected || 
                     exerciseSelection.clientSelections[userId].selectedExercises;
      console.log('Found in exerciseSelection.clientSelections');
    } 
    // Path 2: Direct clientSelections
    else if (llmResult.clientSelections?.[userId]) {
      llmSelections = llmResult.clientSelections[userId].selected || 
                     llmResult.clientSelections[userId].selectedExercises;
      console.log('Found in llmResult.clientSelections');
    }
    // Path 3: Check if we need to use client index instead of userId
    else if (exerciseSelection?.clientSelections) {
      // Try using the client index from groupContext
      const clientKey = `client_${clientIndex}`;
      if (exerciseSelection.clientSelections[clientKey]) {
        console.log('Found selections using client key:', clientKey);
        llmSelections = exerciseSelection.clientSelections[clientKey].selectedExercises;
      }
    }
    // Path 4: llmAssignments for BMF templates
    else if (llmResult.llmAssignments) {
      // Look for user in llmAssignments structure
      console.log('Checking llmAssignments structure');
    }

    if (llmSelections) {
      console.log('Found LLM selections:', llmSelections);
      llmSelections.forEach((ex: any, index: number) => {
        // Handle different possible structures
        const exercise = {
          id: ex.exerciseId || ex.id,
          name: ex.exerciseName || ex.name,
          reasoning: ex.reasoning || '',
          isShared: ex.isShared || false,
          isPreAssigned: false,
          orderIndex: exercises.length + index
        };
        
        // Only add if we have at least an ID and name
        if (exercise.id && exercise.name) {
          exercises.push(exercise);
        }
      });
      console.log('Added exercises from LLM:', exercises.length - (blueprint?.clientExercisePools?.[userId]?.preAssigned?.length || 0));
    } else {
      console.log('No LLM selections found for user');
    }
    
    return exercises;
  }, [visualizationData, userId]);

  // Get user name and avatar
  const userName = useMemo(() => {
    if (visualizationData?.groupContext) {
      const client = visualizationData.groupContext.clients.find((c: any) => c.user_id === userId);
      if (client?.name) return client.name;
    }
    return 'Client';
  }, [visualizationData, userId]);

  const avatarUrl = `${AVATAR_API_URL}?seed=${encodeURIComponent(userName)}`;

  // Reset states when modals close
  useEffect(() => {
    if (!modalOpen && !showExerciseSelection) {
      setSelectedExercise(null);
      setSelectedExerciseIndex(null);
      setSelectedReplacement(null);
      setSearchQuery("");
    }
  }, [modalOpen, showExerciseSelection]);

  // Categorize exercises for the selection modal
  const categorizedExercises = useMemo(() => {
    if (!showExerciseSelection || !selectedExercise) {
      return { recommended: [], other: [] };
    }

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

  // Empty state when no exercises found
  if (!visualizationData || clientExercises.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Workout</h1>
            
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-sm mx-auto mt-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header with avatar */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img
                src={avatarUrl}
                alt={`${userName} avatar`}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{userName}</h3>
                <p className="text-sm text-gray-500">The exercises below are locked in. Feel free to pick your own swaps or let AI handle it.</p>
              </div>
            </div>
          </div>
          
          {/* Exercise list */}
          <div className="p-4">
            <div className="space-y-6">
              {clientExercises.map((exercise, index) => (
                <div key={exercise.id} className="flex items-center group">
                  <div className="flex-1">
                    <span className="text-gray-800 font-medium text-base">{exercise.name}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedExercise(exercise);
                      setSelectedExerciseIndex(index);
                      setModalOpen(true);
                    }}
                    className="ml-2 p-1 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
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
              How would you like to replace "{selectedExercise?.name}"?
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
                  console.log("Let AI choose for exercise at index:", selectedExerciseIndex);
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
                  <p className="text-sm text-gray-500 mt-1">Replacing: {selectedExercise?.name}</p>
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
                  console.log("Would replace exercise at index:", selectedExerciseIndex, "with:", selectedReplacement);
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