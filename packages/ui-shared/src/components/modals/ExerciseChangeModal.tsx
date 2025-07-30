"use client";

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { ModalButton } from './ModalButton';
import { SearchIcon } from '../icons';
import { ExerciseListItem } from '../lists';
import { categorizeExercisesByRecommendation, filterExercisesBySearch } from '../../utils/exercise-filters';

export interface ExerciseChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  availableExercises?: any[];
  blueprintRecommendations?: any[];
  currentRound?: string;
  onConfirm?: (exerciseName: string) => void;
  isLoading?: boolean;
}

/**
 * Modal for changing/replacing an exercise
 */
export const ExerciseChangeModal: React.FC<ExerciseChangeModalProps> = ({
  isOpen,
  onClose,
  exerciseName,
  availableExercises = [],
  blueprintRecommendations = [],
  currentRound,
  onConfirm,
  isLoading = false
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

  const footer = (
    <>
      <ModalButton onClick={onClose} disabled={isLoading}>
        Cancel
      </ModalButton>
      <ModalButton
        onClick={() => {
          if (selectedExercise && onConfirm) {
            onConfirm(selectedExercise);
          }
        }}
        disabled={!selectedExercise}
        variant="primary"
        loading={isLoading}
        loadingText="Changing..."
      >
        Confirm Change
      </ModalButton>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Exercise"
      footer={footer}
    >
      <div className="px-6 py-2">
        <p className="text-sm text-gray-500">Replacing: {exerciseName}</p>
      </div>
      
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
          
          {/* Recommended exercises */}
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
    </BaseModal>
  );
};