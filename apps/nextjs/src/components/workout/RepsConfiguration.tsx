"use client";

import { useState } from "react";
import { Button, XIcon, ChevronLeftIcon } from "@acme/ui-shared";

interface RepsConfigurationProps {
  exerciseName: string;
  exerciseId: string;
  initialReps: number;
  onSave: (reps: number) => void;
  onBack?: () => void;
  onClose?: () => void;
  isSaving?: boolean;
}

export function RepsConfiguration({
  exerciseName,
  exerciseId,
  initialReps,
  onSave,
  onBack,
  onClose,
  isSaving = false,
}: RepsConfigurationProps) {
  const [repsValue, setRepsValue] = useState(initialReps);

  const handleSave = () => {
    onSave(repsValue);
  };

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
        {/* Close button if provided */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-0"
            title="Close"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
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
      <div className="flex gap-3 pt-4 pb-10 border-t dark:border-gray-700">
        <Button
          variant="outline"
          onClick={() => {
            if (onBack) {
              onBack();
            }
          }}
          className="flex-1 bg-transparent dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Back
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}