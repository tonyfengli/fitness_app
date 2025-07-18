"use client";

import React from "react";
import { Button, Icon } from "@acme/ui-shared";
import type { DuplicateWorkoutModalProps } from "./DuplicateWorkoutModal.types";

export function DuplicateWorkoutModal({
  isOpen,
  onClose,
  onConfirm,
  workoutData,
  isLoading = false,
}: DuplicateWorkoutModalProps) {
  if (!isOpen || !workoutData) return null;

  const handleConfirm = () => {
    onConfirm();
  };

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
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Duplicate Workout</h2>
                  <p className="text-gray-500 mt-1">Create a copy of this workout for today</p>
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Workout Summary</h3>
                  
                  {/* Exercise Blocks */}
                  <div className="space-y-4">
                    {workoutData.exerciseBlocks.map((block) => (
                      <div key={block.blockName} className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-2">
                          {block.blockName}
                        </h4>
                        {block.exercises.length > 0 ? (
                          <ul className="space-y-1">
                            {block.exercises.map((exercise, index) => (
                              <li key={exercise.id} className="text-sm text-gray-600">
                                • {exercise.name} - {exercise.sets} sets
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No exercises</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600">
                    This will create a new workout with today's date. All exercises and settings will be copied exactly.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <Button 
                variant="ghost" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? 'Duplicating...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}