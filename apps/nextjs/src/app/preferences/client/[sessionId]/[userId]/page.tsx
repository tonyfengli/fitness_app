"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePreferenceStream } from "~/hooks/usePreferenceStream";
import type { PreferenceUpdateEvent } from "~/hooks/usePreferenceStream";

// Icon components as inline SVGs
const X = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Plus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

// Exercise Change Modal Component
const ExerciseChangeModal = ({ 
  isOpen, 
  onClose, 
  exerciseName,
  availableExercises = [],
  blueprintRecommendations = [],
  currentRound,
  onConfirm,
  isLoading = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  exerciseName: string;
  availableExercises?: any[];
  blueprintRecommendations?: any[];
  currentRound?: string;
  onConfirm?: (exerciseName: string) => void;
  isLoading?: boolean;
}) => {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Reset selection and search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedExercise(null);
      setSearchQuery('');
    }
  }, [isOpen]);
  
  // Categorize exercises into Recommended and Other
  const categorizedExercises = React.useMemo(() => {
    // Start with blueprint recommendations if available
    let recommended = [];
    let other = [];
    
    if (blueprintRecommendations && blueprintRecommendations.length > 0) {
      // Use blueprint recommendations - they're already sorted by score
      // Filter to only show recommendations from the same round if currentRound is specified
      const relevantRecommendations = currentRound 
        ? blueprintRecommendations.filter(rec => rec.roundId === currentRound)
        : blueprintRecommendations;
      
      // Get ALL candidates for the round, not just top 5
      recommended = relevantRecommendations.map(rec => ({
        ...rec.exercise || rec,
        name: rec.exercise?.name || rec.name,
        score: rec.score,
        reason: rec.score >= 8.0 ? 'Perfect match' : 
                rec.score >= 7.0 ? 'Excellent choice' :
                rec.score >= 6.0 ? 'Very compatible' : 
                null // No tag for lower scores
      }));
      
      // Add remaining exercises to "other" category
      const recommendedNames = recommended.map(r => r.name);
      other = availableExercises.filter(exercise => 
        !recommendedNames.includes(exercise.name) && 
        exercise.name !== exerciseName
      );
    } else if (availableExercises && availableExercises.length > 0) {
      // Fallback to similarity-based recommendations if no blueprint data
      const currentExercise = availableExercises.find(ex => ex.name === exerciseName);
      
      availableExercises.forEach(exercise => {
        if (exercise.name === exerciseName) return; // Skip current exercise
        
        if (currentExercise) {
          const isSameMovementPattern = exercise.movementPattern === currentExercise.movementPattern;
          const isSamePrimaryMuscle = exercise.primaryMuscle === currentExercise.primaryMuscle;
          
          if (isSameMovementPattern || isSamePrimaryMuscle) {
            recommended.push({
              ...exercise,
              reason: isSameMovementPattern ? 'Similar movement' : 'Same muscle group'
            });
          } else {
            other.push(exercise);
          }
        } else {
          other.push(exercise);
        }
      });
      
      // Sort and limit fallback recommendations
      recommended.sort((a, b) => {
        if (a.reason === 'Similar movement' && b.reason !== 'Similar movement') return -1;
        if (b.reason === 'Similar movement' && a.reason !== 'Similar movement') return 1;
        return 0;
      });
      recommended = recommended.slice(0, 5);
    }
    
    // Apply search filter to both categories
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filterFn = (exercise) => 
        exercise.name.toLowerCase().includes(query) ||
        exercise.primaryMuscle?.toLowerCase().includes(query) ||
        exercise.movementPattern?.toLowerCase().includes(query);
      
      recommended = recommended.filter(filterFn);
      other = other.filter(filterFn);
    }
    
    return { recommended, other };
  }, [availableExercises, blueprintRecommendations, exerciseName, searchQuery, currentRound]);
  
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      >
        {/* Modal */}
        <div className="flex items-center justify-center h-full p-4">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Change Exercise</h2>
                  <p className="text-gray-500 mt-1 text-sm">
                    {currentRound ? `Select a replacement for ${currentRound === 'Round1' ? 'Round 1' : 'Round 2'}` : 'Select a replacement exercise'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Selected Exercise Box */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600 font-semibold uppercase tracking-wide">Currently Selected</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{exerciseName}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Search Bar */}
              <div className="px-6 py-4 bg-gray-50 border-b sticky top-0 z-10">
                <div className="relative">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="p-6">
              {/* No results message */}
              {searchQuery.trim() && categorizedExercises.recommended.length === 0 && categorizedExercises.other.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No exercises found matching "{searchQuery}"</p>
                </div>
              )}
              
              {/* Recommended Section */}
              {categorizedExercises.recommended.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center mb-4">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-gray-900">Recommended Exercises</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Based on your workout preferences and goals</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {categorizedExercises.recommended.map((exercise, idx) => (
                      <button 
                        key={exercise.id || idx}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          selectedExercise === exercise.name 
                            ? 'bg-indigo-100 border-2 border-indigo-500 shadow-sm' 
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                        onClick={() => setSelectedExercise(exercise.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedExercise === exercise.name && (
                              <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            <span className={`font-medium ${
                              selectedExercise === exercise.name ? 'text-indigo-900' : 'text-gray-900'
                            }`}>{exercise.name}</span>
                          </div>
                          {exercise.reason && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              exercise.reason === 'Perfect match' ? 'bg-purple-100 text-purple-700' :
                              exercise.reason === 'Excellent choice' ? 'bg-indigo-100 text-indigo-700' :
                              exercise.reason === 'Very compatible' ? 'bg-green-100 text-green-700' :
                              exercise.reason === 'Similar movement' ? 'bg-green-100 text-green-700' : 
                              exercise.reason === 'Same muscle group' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {exercise.reason}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Separator */}
              {categorizedExercises.recommended.length > 0 && categorizedExercises.other.length > 0 && (
                <div className="my-6 border-t border-gray-200"></div>
              )}

              {/* Other Section */}
              <div>
                <div className="flex items-center mb-4">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">Other Exercises</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Additional options from your exercise library</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {categorizedExercises.other.length > 0 ? (
                    categorizedExercises.other.map((exercise, idx) => (
                      <button 
                        key={exercise.id || idx}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          selectedExercise === exercise.name 
                            ? 'bg-indigo-100 border-2 border-indigo-500 shadow-sm' 
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                        onClick={() => setSelectedExercise(exercise.name)}
                      >
                        <div className="flex items-center gap-3">
                          {selectedExercise === exercise.name && (
                            <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <span className={`font-medium ${
                            selectedExercise === exercise.name ? 'text-indigo-900' : 'text-gray-900'
                          }`}>{exercise.name}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No other exercises available</p>
                  )}
                </div>
              </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (selectedExercise && onConfirm) {
                    onConfirm(selectedExercise);
                  }
                }}
                disabled={!selectedExercise || isLoading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedExercise && !isLoading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Changing...
                  </>
                ) : (
                  'Confirm Change'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function ClientPreferencePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const userId = params.userId as string;
  const trpc = useTRPC();
  
  
  // State for modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExerciseForChange, setSelectedExerciseForChange] = useState<{name: string; index: number; round?: string} | null>(null);
  const [isProcessingChange, setIsProcessingChange] = useState(false);

  // Fetch client data using public endpoint (no auth required)
  const { data: clientData, isLoading: clientLoading, error: clientError } = useQuery(
    trpc.trainingSession.getClientPreferenceData.queryOptions({ sessionId, userId })
  );

  // Fetch deterministic selections using public endpoint
  const { data: selectionsData, isLoading: selectionsLoading, error: selectionsError } = useQuery(
    trpc.trainingSession.getClientDeterministicSelections.queryOptions({ sessionId, userId })
  );

  // Fetch all available exercises (public endpoint, no auth required)
  const { data: availableExercises, isLoading: exercisesLoading } = useQuery(
    trpc.exercise.all.queryOptions({ limit: 1000 })
  );

  const isLoading = clientLoading || selectionsLoading || exercisesLoading;

  // Get query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Handle real-time preference updates
  const handlePreferenceUpdate = useCallback((event: PreferenceUpdateEvent) => {
    console.log('[ClientPreferences] Received preference update:', event);
    // Refetch data to show updated preferences
    queryClient.invalidateQueries({
      queryKey: ['trainingSession', 'getClientPreferenceData']
    });
    queryClient.invalidateQueries({
      queryKey: ['trainingSession', 'getClientDeterministicSelections']
    });
  }, [queryClient]);
  
  // Set up SSE connection for real-time updates
  const { isConnected } = usePreferenceStream({
    sessionId,
    onPreferenceUpdate: handlePreferenceUpdate,
    onConnect: () => console.log('[ClientPreferences] SSE connected'),
    onDisconnect: () => console.log('[ClientPreferences] SSE disconnected'),
    onError: (error) => console.error('[ClientPreferences] SSE error:', error)
  });

  // Exercise replacement mutation
  const replaceExerciseMutation = useMutation({
    ...trpc.trainingSession.replaceClientExercisePublic.mutationOptions(),
    onMutate: () => {
      // Start loading state when mutation begins
      setIsProcessingChange(true);
    },
    onSuccess: async (data, variables) => {
      console.log('[ClientPreferences] Exercise replacement successful', {
        data,
        variables,
        oldExercise: selectedExerciseForChange?.name,
        newExercise: variables.newExerciseName
      });
      
      // Don't close modal yet - wait for data to update
      
      // Force immediate refetch with a small delay to ensure backend has processed the change
      setTimeout(async () => {
        console.log('[ClientPreferences] Refetching data after delay');
        
        // Invalidate and refetch all relevant queries
        await queryClient.invalidateQueries({
          queryKey: [['trainingSession', 'getClientPreferenceData'], { input: { sessionId, userId } }]
        });
        
        await queryClient.invalidateQueries({
          queryKey: [['trainingSession', 'getClientDeterministicSelections'], { input: { sessionId, userId } }]
        });
        
        // Force refetch
        await queryClient.refetchQueries({
          queryKey: [['trainingSession', 'getClientPreferenceData'], { input: { sessionId, userId } }],
          exact: true
        });
        
        await queryClient.refetchQueries({
          queryKey: [['trainingSession', 'getClientDeterministicSelections'], { input: { sessionId, userId } }],
          exact: true
        });
        
        // Close modal and stop loading after data is refreshed
        setModalOpen(false);
        setSelectedExerciseForChange(null);
        setIsProcessingChange(false);
      }, 500);
    },
    onError: (error) => {
      console.error('[ClientPreferences] Exercise replacement failed:', error);
      setIsProcessingChange(false);
    }
  });

  // Handle exercise replacement
  const handleExerciseReplacement = async (newExerciseName: string) => {
    if (!selectedExerciseForChange?.round) return;

    try {
      await replaceExerciseMutation.mutateAsync({
        sessionId,
        userId,
        round: selectedExerciseForChange.round as 'Round1' | 'Round2',
        newExerciseName
      });
    } catch (error) {
      console.error('Failed to replace exercise:', error);
    }
  };

  // Get exercises from deterministic selections or workout preferences
  const getClientExercises = () => {
    // Check if we have exercises data from the API
    if (!selectionsData) return [];
    
    // For the new implementation, selections will be under `exercises` key
    const exercisesList = selectionsData.exercises || selectionsData.selections || [];
    
    // Get the list of avoided exercises from preferences
    const avoidedExercises = clientData?.user?.preferences?.avoidExercises || [];
    const includeExercises = clientData?.user?.preferences?.includeExercises || [];
    
    console.log('[getClientExercises] Mapping exercises:', {
      exercisesList: exercisesList.map(e => ({ name: e.exercise.name, round: e.roundId })),
      avoidedExercises,
      includeExercises
    });
    
    const exercises = [];
    
    // First, add current active exercises
    exercisesList.forEach(sel => {
      exercises.push({
        name: sel.exercise.name,
        confirmed: false,
        round: sel.roundId,
        isExcluded: false,
        isActive: true
      });
    });
    
    // Then, add excluded exercises that were previously replaced
    avoidedExercises.forEach(excludedExercise => {
      // Only add if it's not already in the active list
      if (!exercises.find(ex => ex.name === excludedExercise)) {
        exercises.push({
          name: excludedExercise,
          confirmed: false,
          round: null, // We don't know which round it was from
          isExcluded: true,
          isActive: false
        });
      }
    });
    
    return exercises;
  };

  // Transform client data for display
  const exercises = getClientExercises();
  
  // Debug logging
  useEffect(() => {
    console.log('[ClientPreferences] Component state:', {
      sessionId,
      userId,
      isLoading,
      hasClientData: !!clientData,
      hasSelectionsData: !!selectionsData,
      clientError,
      selectionsError,
      exercises: selectionsData ? (selectionsData.exercises || selectionsData.selections) : null,
      includeExercises: clientData?.user?.preferences?.includeExercises,
      avoidExercises: clientData?.user?.preferences?.avoidExercises,
      exercisesWithStatus: exercises,
      sseConnected: isConnected
    });
  }, [sessionId, userId, isLoading, clientData, selectionsData, clientError, selectionsError, exercises, isConnected]);
  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  // Check for errors or missing data
  if (clientError || selectionsError || !clientData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Client Not Found</h1>
          <p className="mt-2 text-gray-600">This preference link may be invalid or expired.</p>
          {(clientError || selectionsError) && (
            <p className="mt-2 text-sm text-red-600">
              Error: {clientError?.message || selectionsError?.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const client = clientData.user;
  const displayData = {
    id: client.userId,
    name: client.userName || "Unknown Client",
    avatar: client.userId,
    exerciseCount: exercises.length,
    confirmedExercises: exercises,
    muscleFocus: client.preferences?.muscleTargets || [],
    avoidance: client.preferences?.muscleLessens || []
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Client Card - Single card view */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4">
          {/* Client Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayData.avatar}`}
                alt={displayData.name}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{displayData.name}</h3>
                <p className="text-sm text-gray-500">{displayData.exerciseCount} exercises</p>
              </div>
            </div>
          </div>

          {/* Section 1: Confirm Exercises */}
          <div className="p-6 border-b border-gray-200">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <h4 className="font-medium text-gray-900">Confirm Exercises</h4>
              </div>
            </div>
            <div className="space-y-3">
              {displayData.confirmedExercises.map((exercise, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                    exercise.isExcluded ? 'bg-gray-100' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        exercise.isExcluded 
                          ? 'text-gray-400 line-through decoration-2' 
                          : 'text-gray-700'
                      }`}>{exercise.name}</span>
                    </div>
                    <div className="relative">
                      {exercise.isActive ? (
                        <button
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm font-medium ${
                            exercise.isExcluded 
                              ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open modal directly when clicking confirmed button
                            setSelectedExerciseForChange({name: exercise.name, index: idx, round: exercise.round});
                            setModalOpen(true);
                          }}
                        >
                          {exercise.isExcluded ? 'Replaced' : 'Confirmed'}
                          <svg 
                            className="w-4 h-4 transform transition-transform" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
              ))}
            </div>
          </div>

          {/* Section 2: Muscle Focus & Avoidance */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <h4 className="font-medium text-gray-900">Muscle Focus & Avoidance</h4>
            </div>
            <div className="space-y-3">
              {/* Muscle Focus Items */}
              {displayData.muscleFocus.map((muscle, idx) => (
                <div key={`focus-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700 font-medium">Focus: {muscle}</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <X />
                  </button>
                </div>
              ))}
              
              {/* Avoidance Items */}
              {displayData.avoidance.map((item, idx) => (
                <div key={`avoid-${idx}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-red-700 font-medium">Avoid: {item}</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <X />
                  </button>
                </div>
              ))}
              
              {/* Add button */}
              {(displayData.muscleFocus.length === 0 && displayData.avoidance.length === 0) ? (
                <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                  <Plus />
                  Add Focus or Avoidance
                </button>
              ) : (
                <button className="w-full p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 flex items-center justify-center gap-2">
                  <Plus />
                  Add More
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Other Notes */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <h4 className="font-medium text-gray-900">Other Notes</h4>
            </div>
            <div className="space-y-3">
              <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                <Plus />
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Success feedback will appear here */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Changes save automatically
        </div>
      </div>
      
      {/* Exercise Change Modal */}
      <ExerciseChangeModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedExerciseForChange(null);
        }}
        exerciseName={selectedExerciseForChange?.name || ''}
        availableExercises={availableExercises || []}
        blueprintRecommendations={selectionsData?.recommendations || []}
        currentRound={selectedExerciseForChange?.round}
        onConfirm={handleExerciseReplacement}
        isLoading={isProcessingChange}
      />
    </div>
  );
}