"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { 
  useClientPreferences, 
  useRealtimePreferences,
  categorizeExercisesByRecommendation,
  filterExercisesBySearch,
  getFilteredExercises
} from "@acme/ui-shared";
import { supabase } from "~/lib/supabase";

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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
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
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Recommended</h3>
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

              {/* All other exercises */}
              {categorizedExercises.other.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Other Exercises</h3>
                  <div className="space-y-2">
                  {categorizedExercises.other.map((exercise, idx) => (
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
  
  // Complete muscle list from exercise metadata
  const muscleGroups = [
    // Lower Body
    { value: 'glutes', label: 'Glutes' },
    { value: 'quads', label: 'Quads' },
    { value: 'hamstrings', label: 'Hamstrings' },
    { value: 'calves', label: 'Calves' },
    { value: 'adductors', label: 'Adductors' },
    { value: 'abductors', label: 'Abductors' },
    { value: 'shins', label: 'Shins' },
    { value: 'tibialis_anterior', label: 'Tibialis Anterior' },
    // Core
    { value: 'core', label: 'Core' },
    { value: 'lower_abs', label: 'Lower Abs' },
    { value: 'upper_abs', label: 'Upper Abs' },
    { value: 'obliques', label: 'Obliques' },
    // Upper Body - Push
    { value: 'chest', label: 'Chest' },
    { value: 'upper_chest', label: 'Upper Chest' },
    { value: 'lower_chest', label: 'Lower Chest' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'delts', label: 'Delts' },
    { value: 'triceps', label: 'Triceps' },
    // Upper Body - Pull
    { value: 'lats', label: 'Lats' },
    { value: 'upper_back', label: 'Upper Back' },
    { value: 'lower_back', label: 'Lower Back' },
    { value: 'traps', label: 'Traps' },
    { value: 'biceps', label: 'Biceps' }
  ].sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically by label
  
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
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
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
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
              {searchQuery.trim() && filteredExercises.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No exercises found matching "{searchQuery}"</p>
                </div>
              )}
              
              {/* All Exercises */}
              {filteredExercises.length > 0 && (
                <div className="space-y-2">
                  {filteredExercises.map((exercise, idx) => (
                    <button 
                      key={exercise.id || idx}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedExercise === exercise.name 
                          ? 'bg-indigo-100 border-2 border-indigo-500 shadow-sm' 
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      } ${isLoading && selectedExercise === exercise.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isLoading && setSelectedExercise(exercise.name)}
                      disabled={isLoading && selectedExercise === exercise.name}
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
                      </div>
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

// Helper function to format muscle values to display labels
const formatMuscleLabel = (muscleValue: string): string => {
  const muscleMap: Record<string, string> = {
    // Lower Body
    'glutes': 'Glutes',
    'quads': 'Quads',
    'hamstrings': 'Hamstrings',
    'calves': 'Calves',
    'adductors': 'Adductors',
    'abductors': 'Abductors',
    'shins': 'Shins',
    'tibialis_anterior': 'Tibialis Anterior',
    // Core
    'core': 'Core',
    'lower_abs': 'Lower Abs',
    'upper_abs': 'Upper Abs',
    'obliques': 'Obliques',
    // Upper Body - Push
    'chest': 'Chest',
    'upper_chest': 'Upper Chest',
    'lower_chest': 'Lower Chest',
    'shoulders': 'Shoulders',
    'delts': 'Delts',
    'triceps': 'Triceps',
    // Upper Body - Pull
    'lats': 'Lats',
    'upper_back': 'Upper Back',
    'lower_back': 'Lower Back',
    'traps': 'Traps',
    'biceps': 'Biceps'
  };
  return muscleMap[muscleValue] || muscleValue;
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
  
  // Local state for modals
  const [muscleModalOpen, setMuscleModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  
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
                          onClick={() => {
                            // Open modal to change exercise
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
              
              {/* Add Exercise Button */}
              <button 
                onClick={() => setAddModalOpen(true)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <Plus />
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
                <div key={`focus-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700 font-medium">Target: {formatMuscleLabel(muscle)}</span>
                  <button 
                    onClick={() => handleRemoveMusclePreference(muscle, 'target')}
                    disabled={isRemovingMuscle}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1"
                  >
                    <X />
                  </button>
                </div>
              ))}
              
              {/* Limit Items */}
              {displayData.avoidance.map((item, idx) => (
                <div key={`avoid-${idx}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-red-700 font-medium">Limit: {formatMuscleLabel(item)}</span>
                  <button 
                    onClick={() => handleRemoveMusclePreference(item, 'limit')}
                    disabled={isRemovingMuscle}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1"
                  >
                    <X />
                  </button>
                </div>
              ))}
              
              {/* Add button */}
              {(displayData.muscleFocus.length === 0 && displayData.avoidance.length === 0) ? (
                <button 
                  onClick={() => setMuscleModalOpen(true)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
                  <Plus />
                  Add Target or Limit
                </button>
              ) : (
                <button 
                  onClick={() => setMuscleModalOpen(true)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
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
              {/* Display existing notes */}
              {(workoutPreferences?.notes || []).map((note, idx) => (
                <div key={`note-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{note}</span>
                  <button 
                    onClick={() => handleRemoveNote(idx)}
                    disabled={isRemovingNote}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1"
                  >
                    <X />
                  </button>
                </div>
              ))}
              
              {/* Add Note button */}
              <button 
                onClick={() => setNotesModalOpen(true)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
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
        isOpen={muscleModalOpen}
        onClose={() => {
          setMuscleModalOpen(false);
        }}
        onConfirm={async (muscle, type) => {
          await handleAddMusclePreference(muscle, type);
          setMuscleModalOpen(false);
        }}
        isLoading={isAddingMuscle}
        existingTargets={clientData?.user?.preferences?.muscleTargets || []}
        existingLimits={clientData?.user?.preferences?.muscleLessens || []}
      />
      
      {/* Notes Modal */}
      <NotesModal
        isOpen={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false);
        }}
        onConfirm={async (note) => {
          await handleAddNote(note);
          setNotesModalOpen(false);
        }}
        isLoading={isAddingNote}
      />
    </div>
  );
}