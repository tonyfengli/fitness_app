"use client";

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { ModalButton } from './ModalButton';
import { SearchIcon, CheckIcon } from '../icons';
import { MUSCLE_GROUPS_ALPHABETICAL } from '../../constants/muscles';

export interface MuscleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (muscles: string[]) => void;
  isLoading?: boolean;
  existingMuscles?: string[];
  modalType: 'target' | 'limit';
  workoutType?: string;
  disabledMuscles?: string[]; // Additional muscles to disable (e.g., muscle targets when showing limit modal)
}

/**
 * Modal for selecting muscle targets and limits
 */
export const MuscleModal: React.FC<MuscleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  existingMuscles = [],
  modalType,
  workoutType = 'full_body',
  disabledMuscles = []
}) => {
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedMuscles([]);
      setSearchQuery('');
    }
  }, [isOpen]);
  
  // Use shared muscle groups constant
  const muscleGroups = MUSCLE_GROUPS_ALPHABETICAL;
  
  // Calculate constraints
  const isTargeted = workoutType?.includes('targeted');
  const minRequired = modalType === 'target' && isTargeted ? 2 : 0;
  const maxAllowed = modalType === 'target' ? (isTargeted ? 4 : 3) : 999; // No limit for muscle limits
  
  // Calculate if we can select more
  const totalSelected = existingMuscles.length + selectedMuscles.length;
  const canSelectMore = totalSelected < maxAllowed;
  const hasMetMinimum = totalSelected >= minRequired;
  
  // Filter muscles by search and remove already selected
  const filteredMuscles = muscleGroups.filter(muscle => {
    const matchesSearch = muscle.label.toLowerCase().includes(searchQuery.toLowerCase());
    const notAlreadySelected = !existingMuscles.includes(muscle.value);
    return matchesSearch && notAlreadySelected;
  });
  
  // Toggle muscle selection
  const toggleMuscleSelection = (muscleValue: string) => {
    setSelectedMuscles(prev => {
      if (prev.includes(muscleValue)) {
        return prev.filter(m => m !== muscleValue);
      } else {
        // Only add if we haven't reached the max
        if (canSelectMore || prev.includes(muscleValue)) {
          return [...prev, muscleValue];
        }
        return prev;
      }
    });
  };

  const footer = (
    <>
      <ModalButton onClick={onClose} disabled={isLoading}>
        Cancel
      </ModalButton>
      <ModalButton
        onClick={() => {
          if (selectedMuscles.length > 0 && onConfirm) {
            onConfirm(selectedMuscles);
          }
        }}
        disabled={selectedMuscles.length === 0 || !hasMetMinimum || isLoading}
        variant="primary"
        loading={isLoading}
        loadingText="Adding..."
      >
        {!hasMetMinimum && minRequired > 0
          ? `Select at least ${minRequired - totalSelected} more`
          : selectedMuscles.length === 0
          ? 'Select muscles to add'
          : `Add ${selectedMuscles.length} muscle${selectedMuscles.length > 1 ? 's' : ''}`}
      </ModalButton>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Muscle Group"
      footer={footer}
    >
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
          {/* Constraint info */}
          {modalType === 'target' && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {isTargeted ? (
                  <>
                    <span className="font-medium">Targeted workout:</span> Select {minRequired} to {maxAllowed} muscles
                    {existingMuscles.length > 0 && (
                      <span className="block text-xs mt-1">
                        Already selected: {existingMuscles.length} • Can add: {maxAllowed - existingMuscles.length} more
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-medium">Full Body workout:</span> Select up to {maxAllowed} muscles
                    {existingMuscles.length > 0 && (
                      <span className="block text-xs mt-1">
                        Already selected: {existingMuscles.length} • Can add: {maxAllowed - existingMuscles.length} more
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          )}
          
          {/* No results message */}
          {searchQuery.trim() && filteredMuscles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No muscle groups found matching "{searchQuery}"</p>
            </div>
          )}
          
          {/* Muscle List */}
          {filteredMuscles.length > 0 && (
            <div className="space-y-2">
              {filteredMuscles.map((muscle) => {
                const isSelected = selectedMuscles.includes(muscle.value);
                const isInDisabledList = disabledMuscles.includes(muscle.value);
                const isDisabled = isInDisabledList || (!isSelected && !canSelectMore);
                
                return (
                  <button 
                    key={muscle.value}
                    className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-100 border-2 border-indigo-500 shadow-sm' 
                        : isDisabled
                        ? 'bg-gray-100 border-2 border-transparent cursor-not-allowed opacity-50'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && toggleMuscleSelection(muscle.value)}
                    disabled={isDisabled}
                  >
                    <div>
                      <span className={`font-medium ${
                        isSelected ? 'text-indigo-900' : isDisabled ? 'text-gray-400' : 'text-gray-900'
                      }`}>{muscle.label}</span>
                      {isInDisabledList && modalType === 'limit' && (
                        <span className="block text-xs text-gray-500 mt-0.5">Already in muscle targets</span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
};