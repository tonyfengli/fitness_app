"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useClientPreferences, 
  useRealtimePreferences,
  categorizeExercisesByRecommendation,
  filterExercisesBySearch,
  getFilteredExercises,
  useModalState,
  XIcon,
  PlusIcon,
  CheckIcon,
  SearchIcon,
  SpinnerIcon,
  ChevronDownIcon,
  MUSCLE_GROUPS_ALPHABETICAL,
  formatMuscleLabel,
  PreferenceListItem,
  ExerciseListItem
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";

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
    // Use shared categorization logic
    const categorized = categorizeExercisesByRecommendation(
      availableExercises || [],
      blueprintRecommendations,
      {
        currentExerciseName: exerciseName,
        currentRound,
        maxRecommendations: undefined // Don't limit in modal, show all recommendations
      }
    );
    
    // Apply search filter to both categories
    if (searchQuery.trim()) {
      return {
        recommended: filterExercisesBySearch(categorized.recommended, searchQuery),
        other: filterExercisesBySearch(categorized.other, searchQuery)
      };
    }
    
    return categorized;
  }, [availableExercises, blueprintRecommendations, exerciseName, searchQuery, currentRound]);
  
  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Change Exercise</h2>
                  <p className="text-sm text-gray-500 mt-1">Replacing: {exerciseName}</p>
                </div>
                <button
                  onClick={onClose}
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
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Recommended</h3>
                  <div className="space-y-2">
                    {categorizedExercises.recommended.map((exercise, idx) => (
                      <ExerciseListItem
                        key={exercise.id || idx}
                        name={exercise.name}
                        isSelected={selectedExercise === exercise.name}
                        reason={exercise.reason}
                        onClick={() => setSelectedExercise(exercise.name)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All other exercises */}
              {categorizedExercises.other.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Other Exercises</h3>
                  <div className="space-y-2">
                  {categorizedExercises.other.map((exercise, idx) => (
                      <ExerciseListItem
                        key={exercise.id || idx}
                        name={exercise.name}
                        isSelected={selectedExercise === exercise.name}
                        onClick={() => setSelectedExercise(exercise.name)}
                      />
                  ))}
                  </div>
                </div>
              )}
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
                    <SpinnerIcon className="animate-spin h-4 w-4 text-white" />
                    Changing...
                  </>
                ) : (
                  'Confirm Change'
                )}
              </button>
            </div>
      </div>
    </>
  );
};

// Muscle Target/Limit Modal Component
const MuscleModal = ({ 
  isOpen, 
  onClose,
  onConfirm,
  isLoading = false,
  existingTargets = [],
  existingLimits = [],
  initialTab = 'target'
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onConfirm?: (muscle: string, type: 'target' | 'limit') => void;
  isLoading?: boolean;
  existingTargets?: string[];
  existingLimits?: string[];
  initialTab?: 'target' | 'limit';
}) => {
  const [activeTab, setActiveTab] = useState<'target' | 'limit'>(initialTab);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab(initialTab);
      setSelectedMuscle(null);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);
  
  // Use shared muscle groups constant
  const muscleGroups = MUSCLE_GROUPS_ALPHABETICAL;
  
  // Get already selected muscles based on active tab
  const alreadySelected = activeTab === 'target' ? existingTargets : existingLimits;
  
  // Filter muscles by search and remove already selected
  const filteredMuscles = muscleGroups.filter(muscle => {
    const matchesSearch = muscle.label.toLowerCase().includes(searchQuery.toLowerCase());
    const notAlreadySelected = !alreadySelected.includes(muscle.value);
    return matchesSearch && notAlreadySelected;
  });
  
  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Add Muscle Group</h2>
                <button
                  onClick={onClose}
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
                    placeholder="Search muscle group"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
              </div>
              
              <div className="p-6">
              {/* No results message */}
              {searchQuery.trim() && filteredMuscles.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No muscle groups found matching "{searchQuery}"</p>
                </div>
              )}
              
              {/* Muscle List */}
              {filteredMuscles.length > 0 && (
                <div className="space-y-2">
                  {filteredMuscles.map((muscle) => (
                    <button 
                      key={muscle.value}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                        selectedMuscle === muscle.value 
                          ? 'bg-indigo-100 border-2 border-indigo-500 shadow-sm' 
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                      onClick={() => setSelectedMuscle(muscle.value)}
                    >
                      <span className={`font-medium ${
                        selectedMuscle === muscle.value ? 'text-indigo-900' : 'text-gray-900'
                      }`}>{muscle.label}</span>
                      {selectedMuscle === muscle.value && (
                        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                          <CheckIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
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
                  if (selectedMuscle && onConfirm) {
                    onConfirm(selectedMuscle, activeTab);
                  }
                }}
                disabled={!selectedMuscle || isLoading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedMuscle && !isLoading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon className="animate-spin h-4 w-4 text-white" />
                    Adding...
                  </>
                ) : (
                  'Add'
                )}
              </button>
            </div>
      </div>
    </>
  );
};

// Notes Modal Component
const NotesModal = ({ 
  isOpen, 
  onClose,
  onConfirm,
  isLoading = false
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onConfirm?: (note: string) => void;
  isLoading?: boolean;
}) => {
  const [noteText, setNoteText] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNoteText('');
    }
  }, [isOpen]);
  
  const isValidNote = noteText.trim().length > 0;
  
  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Add Note</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add your note here..."
                className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none placeholder-gray-400"
                rows={4}
                disabled={isLoading}
              />
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
                  if (isValidNote && onConfirm) {
                    onConfirm(noteText.trim());
                  }
                }}
                disabled={!isValidNote || isLoading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isValidNote && !isLoading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon className="animate-spin h-4 w-4 text-white" />
                    Adding...
                  </>
                ) : (
                  'Add'
                )}
              </button>
            </div>
      </div>
    </>
  );
};

// Add Exercise Modal Component
const AddExerciseModal = ({ 
  isOpen, 
  onClose, 
  availableExercises = [],
  existingExercises = [],
  onConfirm,
  isLoading = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  availableExercises?: any[];
  existingExercises?: string[];
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
  
  // Filter exercises using shared utilities
  const filteredExercises = React.useMemo(() => {
    if (!availableExercises || availableExercises.length === 0) return [];
    
    // During loading, keep selected exercise visible but filter out other active exercises
    if (isLoading && selectedExercise) {
      // Filter out active exercises except the selected one
      const activeExercisesExceptSelected = existingExercises.filter(name => name !== selectedExercise);
      
      return getFilteredExercises(availableExercises, {
        searchQuery,
        activeExerciseNames: activeExercisesExceptSelected
      });
    }
    
    // Normal filtering
    return getFilteredExercises(availableExercises, {
      searchQuery,
      activeExerciseNames: existingExercises
    });
  }, [availableExercises, existingExercises, searchQuery, isLoading, selectedExercise]);
  
  if (!isOpen) return null;

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Add Exercise</h2>
                <button
                  onClick={onClose}
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="p-6">
              {/* No results message */}
              {searchQuery.trim() && filteredExercises.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No exercises found matching "{searchQuery}"</p>
                </div>
              )}
              
              {/* All Exercises */}
              {filteredExercises.length > 0 && (
                <div className="space-y-2">
                  {filteredExercises.map((exercise, idx) => (
                    <ExerciseListItem
                      key={exercise.id || idx}
                      name={exercise.name}
                      isSelected={selectedExercise === exercise.name}
                      isLoading={isLoading && selectedExercise === exercise.name}
                      onClick={() => !isLoading && setSelectedExercise(exercise.name)}
                    />
                  ))}
                </div>
              )}
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
                    <SpinnerIcon className="animate-spin h-4 w-4 text-white" />
                    Adding...
                  </>
                ) : (
                  'Add Exercise'
                )}
              </button>
            </div>
      </div>
    </>
  );
};


export default function ClientPreferencePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const userId = params.userId as string;
  const trpc = useTRPC();
  const [currentStep, setCurrentStep] = useState(1); // 1: Workout Style, 2: Muscle Target, 3: Muscle Limit, 4: Intensity
  
  // Mutation for updating ready status
  const updateReadyStatus = useMutation(
    trpc.trainingSession.updateClientReadyStatusPublic.mutationOptions({
      onSuccess: () => {
        // Navigate to workout-overview after marking as ready
        console.log('Successfully marked as ready');
        router.push(`/workout-overview?sessionId=${sessionId}&userId=${userId}`);
      },
      onError: (error) => {
        console.error('Failed to update ready status:', error);
        alert('Failed to mark as ready. Please try again.');
      }
    })
  );
  
  // Use the shared hook for all business logic
  const {
    clientData,
    selectionsData,
    recommendationsData,
    availableExercises,
    exercises,
    isLoading,
    clientError,
    selectionsError,
    modalOpen,
    setModalOpen,
    selectedExerciseForChange,
    setSelectedExerciseForChange,
    addModalOpen,
    setAddModalOpen,
    handleExerciseReplacement,
    handleAddExercise,
    handlePreferenceUpdate,
    isProcessingChange,
    isAddingExercise,
    isAddingMuscle,
    handleAddMusclePreference,
    handleRemoveMusclePreference,
    workoutPreferences,
    isRemovingMuscle,
    handleAddNote,
    handleRemoveNote,
    isAddingNote,
    isRemovingNote
  } = useClientPreferences({ sessionId, userId, trpc });
  
  const queryClient = useQueryClient();
  
  // Add workout type update mutation
  const updateWorkoutTypeMutation = useMutation({
    ...trpc.workoutPreferences.updateWorkoutTypePublic.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Failed to update workout type:', error);
    }
  });
  
  // Add intensity update mutation
  const updateIntensityMutation = useMutation({
    ...trpc.workoutPreferences.updateIntensityPublic.mutationOptions(),
    onSuccess: () => {
      // Invalidate queries to refresh data in global preferences
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Failed to update intensity:', error);
    }
  });
  
  // Use shared modal state hook
  const muscleModal = useModalState();
  const notesModal = useModalState();
  
  // Subscribe to realtime preference updates
  useRealtimePreferences({
    sessionId: sessionId || '',
    supabase,
    onPreferenceUpdate: handlePreferenceUpdate
  });
  

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
    <div className="min-h-screen bg-gray-50 overflow-y-auto relative">
      {/* Full screen loading overlay */}
      {updateWorkoutTypeMutation.isPending && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <SpinnerIcon className="animate-spin h-5 w-5 text-indigo-600" />
            <span className="text-gray-700 font-medium">Updating preferences...</span>
          </div>
        </div>
      )}
      
      <div className="max-w-md mx-auto p-4 pb-20">
        {/* Client info outside card */}
        <div className="flex items-center justify-center mb-6 mt-4">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayData.avatar}`}
            alt={displayData.name}
            className="w-10 h-10 rounded-full mr-3"
          />
          <h2 className="font-semibold text-gray-900 text-lg">{displayData.name}</h2>
        </div>
        
        {/* Client Card - Single card view */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Progress indicator */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    step === currentStep
                      ? 'bg-indigo-600'
                      : step < currentStep
                      ? 'bg-indigo-300'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              Step {currentStep} of 4
            </p>
          </div>

          {/* Step 1: Workout Focus */}
          {currentStep === 1 && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <h4 className="font-medium text-gray-900">Workout Focus</h4>
              </div>
              
              {/* Workout Type */}
              <div className="mb-8">
                <p className="text-sm font-medium text-gray-700 mb-3">Workout Type</p>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="workoutType"
                      value="full_body"
                      checked={workoutPreferences?.workoutType?.startsWith('full_body') ?? true}
                      onChange={(e) => {
                        const includeFinisher = workoutPreferences?.workoutType?.includes('with_finisher') ?? false;
                        const workoutType = includeFinisher ? 'full_body_with_finisher' : 'full_body_without_finisher';
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">Full Body</span>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="workoutType"
                      value="targeted"
                      checked={workoutPreferences?.workoutType?.startsWith('targeted') ?? false}
                      onChange={(e) => {
                        const includeFinisher = workoutPreferences?.workoutType?.includes('with_finisher') ?? false;
                        const workoutType = includeFinisher ? 'targeted_with_finisher' : 'targeted_without_finisher';
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">Targeted</span>
                  </label>
                </div>
              </div>

              {/* Include Finisher */}
              <div className="mb-8">
                <p className="text-sm font-medium text-gray-700 mb-3">Include Finisher?</p>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="includeFinisher"
                      value="no"
                      checked={!workoutPreferences?.workoutType?.includes('with_finisher') ?? true}
                      onChange={(e) => {
                        const isTargeted = workoutPreferences?.workoutType?.startsWith('targeted') ?? false;
                        const workoutType = isTargeted ? 'targeted_without_finisher' : 'full_body_without_finisher';
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">No</span>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="includeFinisher"
                      value="yes"
                      checked={workoutPreferences?.workoutType?.includes('with_finisher') ?? false}
                      onChange={(e) => {
                        const isTargeted = workoutPreferences?.workoutType?.startsWith('targeted') ?? false;
                        const workoutType = isTargeted ? 'targeted_with_finisher' : 'full_body_with_finisher';
                        handlePreferenceUpdate({
                          ...workoutPreferences,
                          workoutType: workoutType
                        });
                        // Update in database
                        updateWorkoutTypeMutation.mutate({
                          sessionId,
                          userId,
                          workoutType
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-gray-700">Yes</span>
                  </label>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Muscle Target */}
          {currentStep === 2 && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <h4 className="font-medium text-gray-900">Muscle Target</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Select muscles you want to focus on during the workout
                {workoutPreferences?.workoutType?.startsWith('full_body') && (
                  <span className="block text-xs text-gray-500 mt-1">Full Body workouts: Maximum 2 muscles</span>
                )}
                {workoutPreferences?.workoutType?.startsWith('targeted') && (
                  <span className="block text-xs text-gray-500 mt-1">Targeted workouts: 2-3 muscles required</span>
                )}
              </p>
              <div className="space-y-3">
                {/* Muscle Target Items */}
                {displayData.muscleFocus.map((muscle, idx) => (
                  <PreferenceListItem
                    key={`focus-${idx}`}
                    label={formatMuscleLabel(muscle)}
                    type="target"
                    onRemove={() => handleRemoveMusclePreference(muscle, 'target')}
                    isRemoving={isRemovingMuscle}
                  />
                ))}
                
                {/* Add button */}
                {(() => {
                  const isFullBody = workoutPreferences?.workoutType?.startsWith('full_body');
                  const isTargeted = workoutPreferences?.workoutType?.startsWith('targeted');
                  const muscleCount = displayData.muscleFocus.length;
                  const canAddMore = isFullBody ? muscleCount < 2 : muscleCount < 3;
                  
                  return (
                    <button 
                      onClick={() => {
                        if (canAddMore) {
                          muscleModal.open();
                        }
                      }}
                      disabled={!canAddMore}
                      className={`w-full p-3 border rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-sm ${
                        canAddMore 
                          ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400'
                          : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                      }`}>
                      <PlusIcon />
                      {muscleCount === 0 ? 'Add Target Muscle' : 
                       !canAddMore ? `Maximum reached (${muscleCount}/${isFullBody ? 2 : 3})` : 
                       'Add More'}
                    </button>
                  );
                })()}
              </div>
              
              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  Back
                </button>
                {(() => {
                  const isTargeted = workoutPreferences?.workoutType?.startsWith('targeted');
                  const muscleCount = displayData.muscleFocus.length;
                  const canProceed = !isTargeted || muscleCount >= 2;
                  
                  return (
                    <button
                      onClick={() => canProceed && setCurrentStep(3)}
                      disabled={!canProceed}
                      className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                        canProceed
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {!canProceed ? `Add ${2 - muscleCount} more muscle${2 - muscleCount > 1 ? 's' : ''}` :
                       displayData.muscleFocus.length === 0 ? 'Skip' : 'Next'}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Step 3: Muscle Limit */}
          {currentStep === 3 && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <h4 className="font-medium text-gray-900">Muscle Limit</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">Select muscles to avoid or limit during the workout</p>
              <div className="space-y-3">
                {/* Limit Items */}
                {displayData.avoidance.map((item, idx) => (
                  <PreferenceListItem
                    key={`avoid-${idx}`}
                    label={formatMuscleLabel(item)}
                    type="limit"
                    onRemove={() => handleRemoveMusclePreference(item, 'limit')}
                    isRemoving={isRemovingMuscle}
                  />
                ))}
                
                {/* Add button */}
                <button 
                  onClick={() => {
                    muscleModal.open();
                    // Set muscle modal to limit mode
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
                  <PlusIcon />
                  {displayData.avoidance.length === 0 ? 'Add Muscle Limit' : 'Add More'}
                </button>
              </div>
              
              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  {displayData.avoidance.length === 0 ? 'Skip' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Intensity */}
          {currentStep === 4 && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <h4 className="font-medium text-gray-900">Intensity</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">Select your preferred workout intensity</p>
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={workoutPreferences?.intensity || 'moderate'}
                    onChange={(e) => {
                      const newIntensity = e.target.value as 'low' | 'moderate' | 'high';
                      // Update local state immediately
                      handlePreferenceUpdate({
                        ...workoutPreferences,
                        intensity: newIntensity
                      });
                      // Update in database for global preferences
                      updateIntensityMutation.mutate({
                        sessionId,
                        userId,
                        intensity: newIntensity
                      });
                    }}
                    disabled={updateIntensityMutation.isPending}
                    className="w-full appearance-none px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="low">Low (4 exercises)</option>
                    <option value="moderate">Moderate (5 exercises)</option>
                    <option value="high">High (6 exercises)</option>
                    <option value="intense">Intense (7 exercises)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Navigation buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    updateReadyStatus.mutate({
                      sessionId,
                      userId,
                      isReady: true
                    });
                  }}
                  disabled={updateReadyStatus.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {updateReadyStatus.isPending ? 'Completing...' : 'Complete'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

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
        blueprintRecommendations={(() => {
          const recommendations = recommendationsData?.recommendations || [];
          console.log('[ClientPreferencePage] Passing recommendations to modal:', {
            hasRecommendationsData: !!recommendationsData,
            recommendationsCount: recommendations.length,
            sampleRecommendations: recommendations.slice(0, 3).map((r: any) => ({
              name: r.name,
              roundId: r.roundId
            }))
          });
          return recommendations;
        })()}
        currentRound={selectedExerciseForChange?.round}
        onConfirm={handleExerciseReplacement}
        isLoading={isProcessingChange}
      />
      
      {/* Add Exercise Modal */}
      <AddExerciseModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
        }}
        availableExercises={availableExercises || []}
        existingExercises={exercises.filter(ex => ex.isActive).map(ex => ex.name)}
        onConfirm={handleAddExercise}
        isLoading={isAddingExercise}
      />
      
      {/* Muscle Target/Limit Modal */}
      <MuscleModal
        isOpen={muscleModal.isOpen}
        onClose={muscleModal.close}
        onConfirm={async (muscle, type) => {
          // Check constraints before adding
          if (type === 'target') {
            const currentTargets = clientData?.user?.preferences?.muscleTargets || [];
            const isFullBody = workoutPreferences?.workoutType?.startsWith('full_body');
            const maxAllowed = isFullBody ? 2 : 3;
            
            if (currentTargets.length >= maxAllowed) {
              console.warn(`Cannot add more than ${maxAllowed} muscle targets for ${isFullBody ? 'full body' : 'targeted'} workouts`);
              return;
            }
          }
          
          await handleAddMusclePreference(muscle, type);
          muscleModal.close();
        }}
        isLoading={isAddingMuscle}
        existingTargets={clientData?.user?.preferences?.muscleTargets || []}
        existingLimits={clientData?.user?.preferences?.muscleLessens || []}
        initialTab={currentStep === 2 ? 'target' : 'limit'}
      />
      
      {/* Notes Modal */}
      <NotesModal
        isOpen={notesModal.isOpen}
        onClose={notesModal.close}
        onConfirm={async (note) => {
          await handleAddNote(note);
          notesModal.close();
        }}
        isLoading={isAddingNote}
      />
    </div>
  );
}

