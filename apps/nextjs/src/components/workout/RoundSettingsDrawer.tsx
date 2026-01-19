"use client";

import React from "react";

interface RoundSettingsDrawerProps {
  roundNumber: number;
  roundName: string;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  onSelectLighting: () => void;
  onSelectMusic: () => void;
  onClose: () => void;
}

export function RoundSettingsDrawer({
  roundNumber,
  roundName,
  roundType,
  onSelectLighting,
  onSelectMusic,
  onClose,
}: RoundSettingsDrawerProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 p-4 space-y-3">
        {/* Lighting Button */}
        <button
          onClick={onSelectLighting}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Lighting
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure lighting scenes for each phase
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Music Button */}
        <button
          onClick={onSelectMusic}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
            <svg
              className="w-6 h-6 text-purple-600 dark:text-purple-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Music
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set music triggers and transitions
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
