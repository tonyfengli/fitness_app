"use client";

import React, { useState } from "react";
import { Button, Icon } from "@acme/ui-shared";
import type { EditModalProps } from "./EditModal.types";
import { ExerciseEditForm } from "./ExerciseEditForm";

export function EditModal({
  isOpen,
  onClose,
  onSave,
  context,
  currentData,
  isLoading = false,
  availableExercises = [],
}: EditModalProps) {
  if (!isOpen || !context) return null;

  // Determine modal title based on context
  const getModalTitle = () => {
    switch (context.type) {
      case 'workout':
        return 'Edit Workout Details';
      case 'block':
        return `Edit ${context.blockName}`;
      case 'exercise':
        return 'Edit Exercise';
      default:
        return 'Edit';
    }
  };

  // Render different content based on context
  const renderContent = () => {
    switch (context.type) {
      case 'workout':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium">Editing Workout</p>
              <p className="text-xs text-blue-600 mt-1">Workout ID: {context.workoutId}</p>
            </div>
            <p className="text-gray-600">Workout editing form will go here</p>
            {/* TODO: Add workout edit form */}
          </div>
        );

      case 'block':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">Editing Block: {context.blockName}</p>
              <p className="text-xs text-green-600 mt-1">Workout ID: {context.workoutId}</p>
            </div>
            <p className="text-gray-600">Block editing form will go here</p>
            {/* TODO: Add block edit form */}
          </div>
        );

      case 'exercise':
        return (
          <ExerciseEditForm
            context={context}
            currentData={currentData}
            availableExercises={availableExercises}
            onSave={onSave}
            onCancel={onClose}
            isLoading={isLoading}
          />
        );

      default:
        return null;
    }
  };

  const handleSave = () => {
    // TODO: Implement save logic based on context
    console.log('Saving with context:', context);
    onSave({});
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
        data-testid="edit-exercise-modal"
      >
        {/* Modal */}
        <div className="flex items-center justify-center h-full p-4">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{getModalTitle()}</h2>
                  <p className="text-gray-500 mt-1">
                    {context.type === 'workout' && 'Update workout name, description, and settings'}
                    {context.type === 'block' && 'Modify block properties and organization'}
                    {context.type === 'exercise' && 'Adjust exercise details and parameters'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isLoading}
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {renderContent()}
            </div>

            {/* Footer - only show for non-exercise modals */}
            {context.type !== 'exercise' && (
              <div className="px-8 py-6 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}