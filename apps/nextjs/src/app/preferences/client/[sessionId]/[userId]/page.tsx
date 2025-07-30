"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/react";
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
  existingLimits = []
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onConfirm?: (muscle: string, type: 'target' | 'limit') => void;
  isLoading?: boolean;
  existingTargets?: string[];
  existingLimits?: string[];
}) => {
  const [activeTab, setActiveTab] = useState<'target' | 'limit'>('target');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('target');
      setSelectedMuscle(null);
      setSearchQuery('');
    }
  }, [isOpen]);
  
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
            
            {/* Tab Selector */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setActiveTab('target')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    activeTab === 'target'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Target
                </button>
                <button
                  onClick={() => setActiveTab('limit')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    activeTab === 'limit'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Limit
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
  const sessionId = params.sessionId as string;
  const userId = params.userId as string;
  const trpc = useTRPC();
  
  // Use the shared hook for all business logic
  const {
    clientData,
    selectionsData,
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
                <ExerciseListItem
                  key={idx}
                  name={exercise.name}
                  isExcluded={exercise.isExcluded}
                  actionButton={
                    exercise.isActive ? (
                      exercise.round ? (
                        <button
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm font-medium ${
                            exercise.isExcluded 
                              ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                          onClick={() => {
                            // Open modal to change exercise
                            setSelectedExerciseForChange({name: exercise.name, index: idx, round: exercise.round});
                            setModalOpen(true);
                          }}
                        >
                          {exercise.isExcluded ? 'Replaced' : 'Confirmed'}
                          <ChevronDownIcon className="w-4 h-4 transform transition-transform" />
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 rounded-md bg-green-100 text-green-700 text-sm font-medium">
                          Added
                        </div>
                      )
                    ) : null
                  }
                />
              ))}
              
              {/* Add Exercise Button */}
              <button 
                onClick={() => setAddModalOpen(true)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <PlusIcon />
                Add Exercise
              </button>
            </div>
          </div>

          {/* Section 2: Muscle Focus & Avoidance */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <h4 className="font-medium text-gray-900">Muscle Target & Limit</h4>
            </div>
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
              {(displayData.muscleFocus.length === 0 && displayData.avoidance.length === 0) ? (
                <button 
                  onClick={muscleModal.open}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
                  <PlusIcon />
                  Add Target or Limit
                </button>
              ) : (
                <button 
                  onClick={muscleModal.open}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
                  <PlusIcon />
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
              {/* Display existing notes */}
              {(workoutPreferences?.notes || []).map((note, idx) => (
                <PreferenceListItem
                  key={`note-${idx}`}
                  label={note}
                  type="note"
                  onRemove={() => handleRemoveNote(idx)}
                  isRemoving={isRemovingNote}
                />
              ))}
              
              {/* Add Note button */}
              <button 
                onClick={notesModal.open}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <PlusIcon />
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
          await handleAddMusclePreference(muscle, type);
          muscleModal.close();
        }}
        isLoading={isAddingMuscle}
        existingTargets={clientData?.user?.preferences?.muscleTargets || []}
        existingLimits={clientData?.user?.preferences?.muscleLessens || []}
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

