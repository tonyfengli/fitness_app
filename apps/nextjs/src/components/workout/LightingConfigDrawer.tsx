"use client";

import React from "react";

interface LightingConfigDrawerProps {
  roundId?: number;
  phaseType?: string;
  phaseLabel?: string;
  currentConfig?: any;
  onSave?: () => void;
  onClose?: () => void;
}

export function LightingConfigDrawer({
  roundId,
  phaseType,
  phaseLabel,
  currentConfig,
  onSave,
  onClose,
}: LightingConfigDrawerProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Configure Light
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {phaseLabel && `${phaseLabel} • `}Round {roundId} • {phaseType}
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
        <div className="space-y-4">
          {/* Light Preview */}
          <div className="flex justify-center mb-6">
            <div 
              className="w-24 h-24 rounded-full border-4 border-white shadow-xl"
              style={{
                backgroundColor: currentConfig?.color || '#6B7280',
                opacity: currentConfig?.active ? (currentConfig?.brightness / 100) : 0.5,
                boxShadow: currentConfig?.active ? `0 0 32px ${currentConfig?.color}40` : 'none'
              }}
            />
          </div>

          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
            Lighting Configuration
          </h4>
          <p className="text-gray-600 dark:text-gray-400">
            Configuration options will be implemented here
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}