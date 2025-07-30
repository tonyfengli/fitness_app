"use client";

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { ModalButton } from './ModalButton';
import { SearchIcon, CheckIcon } from '../icons';
import { MUSCLE_GROUPS_ALPHABETICAL } from '../../constants/muscles';

export interface MuscleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (muscle: string, type: 'target' | 'limit') => void;
  isLoading?: boolean;
  existingTargets?: string[];
  existingLimits?: string[];
}

/**
 * Modal for selecting muscle targets and limits
 */
export const MuscleModal: React.FC<MuscleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  existingTargets = [],
  existingLimits = []
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

  const footer = (
    <>
      <ModalButton onClick={onClose} disabled={isLoading}>
        Cancel
      </ModalButton>
      <ModalButton
        onClick={() => {
          if (selectedMuscle && onConfirm) {
            onConfirm(selectedMuscle, activeTab);
          }
        }}
        disabled={!selectedMuscle}
        variant="primary"
        loading={isLoading}
        loadingText="Adding..."
      >
        Add
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
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('target')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'target'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Target
          </button>
          <button
            onClick={() => setActiveTab('limit')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'limit'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Limit
          </button>
        </div>
      </div>

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
    </BaseModal>
  );
};