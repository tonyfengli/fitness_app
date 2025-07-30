"use client";

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { ModalButton } from './ModalButton';
import { SearchIcon } from '../icons';
import { ExerciseListItem } from '../lists';
import { getFilteredExercises } from '../../utils/exercise-filters';

export interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableExercises?: any[];
  existingExercises?: string[];
  onConfirm?: (exerciseName: string) => void;
  isLoading?: boolean;
}

/**
 * Modal for adding a new exercise
 */
export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  isOpen,
  onClose,
  availableExercises = [],
  existingExercises = [],
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
        loadingText="Adding..."
      >
        Add Exercise
      </ModalButton>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Exercise"
      footer={footer}
    >
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
    </BaseModal>
  );
};