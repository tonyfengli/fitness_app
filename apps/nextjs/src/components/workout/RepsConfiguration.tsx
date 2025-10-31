"use client";

import { useState } from "react";
import { Button, XIcon, ChevronLeftIcon } from "@acme/ui-shared";

interface RepsConfigurationProps {
  exerciseName: string;
  exerciseId: string;
  initialReps: number;
  onSave: (reps: number) => void;
  onDelete: () => void;
  onBack?: () => void;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function RepsConfiguration({
  exerciseName,
  exerciseId,
  initialReps,
  onSave,
  onDelete,
  onBack,
  isSaving = false,
  isDeleting = false,
}: RepsConfigurationProps) {
  const [repsValue, setRepsValue] = useState(initialReps);
  const [viewMode, setViewMode] = useState<'configure' | 'delete'>('configure');

  const handleSave = () => {
    onSave(repsValue);
  };

  const handleDelete = () => {
    onDelete();
  };

  if (viewMode === 'delete') {
    return (
      <div className="space-y-4 px-6 py-4">
        {/* Delete Confirmation View */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Exercise
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete <span className="font-semibold text-red-600 dark:text-red-400">"{exerciseName}"</span>?
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                This will remove the exercise from all participants' workouts. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => setViewMode('configure')}
              disabled={isDeleting}
              className="focus:outline-none focus:ring-0"
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Exercise"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6 py-4">
      {/* Configure Exercise Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Configure Exercise
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {exerciseName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Delete button */}
          <button
            onClick={() => setViewMode('delete')}
            disabled={isDeleting}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus:ring-0 disabled:opacity-50"
            title="Delete exercise"
          >
            <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {/* Back button if provided */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-0"
              title="Back"
            >
              <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Sets Configuration */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Number of Reps
          </label>
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setRepsValue(Math.max(0, repsValue - 1))}
              disabled={repsValue <= 0}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10H7" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={repsValue}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                setRepsValue(Math.max(0, Math.min(99, value))); // Limit between 0-99
              }}
              onFocus={(e) => e.target.select()} // Select all text on focus
              className="w-20 text-center text-lg font-medium border border-gray-300 dark:border-gray-600 rounded-lg py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
              onClick={() => setRepsValue(Math.min(99, repsValue + 1))}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 7v6M7 10h6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
        <Button
          variant="outline"
          onClick={() => {
            if (onBack) {
              onBack();
            }
          }}
          className="flex-1 bg-transparent dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={isSaving || isDeleting}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}