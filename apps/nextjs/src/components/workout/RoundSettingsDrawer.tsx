"use client";

import React from "react";

interface RoundSettingsDrawerProps {
  roundNumber: number;
  roundName: string;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  onSelectLighting: () => void;
  onSelectMusic: () => void;
  onClose: () => void;
  // Optional: show configured status
  hasLightingConfig?: boolean;
  hasMusicConfig?: boolean;
  configuredPhasesCount?: number;
  totalPhasesCount?: number;
}

export function RoundSettingsDrawer({
  roundNumber,
  roundName,
  roundType,
  onSelectLighting,
  onSelectMusic,
  onClose,
  hasLightingConfig = false,
  hasMusicConfig = false,
  configuredPhasesCount = 0,
  totalPhasesCount = 0,
}: RoundSettingsDrawerProps) {
  const getRoundTypeLabel = () => {
    switch (roundType) {
      case "circuit_round": return "Circuit";
      case "stations_round": return "Stations";
      case "amrap_round": return "AMRAP";
      default: return "Round";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {/* Header */}
      <div className="relative px-6 pt-4 pb-6">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          <span>{getRoundTypeLabel()}</span>
          <span className="text-gray-300 dark:text-gray-600">•</span>
          <span>Round {roundNumber}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {roundName}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Customize the atmosphere for this round
        </p>

        {/* Gradient border - amber (lighting) to purple (music) */}
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div className="h-full bg-gradient-to-r from-amber-300 via-orange-300 to-purple-400 dark:from-amber-500/50 dark:via-orange-500/50 dark:to-purple-500/50" />
        </div>
      </div>

      {/* Spacer below border */}
      <div className="h-2" />

      {/* Options */}
      <div className="flex-1 px-4 py-2 space-y-3">
        {/* Lighting Button */}
        <button
          onClick={onSelectLighting}
          className="w-full flex items-center gap-4 p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-md transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg
              className="w-7 h-7 text-amber-600 dark:text-amber-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Lighting
              </h3>
              {hasLightingConfig && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                  {configuredPhasesCount}/{totalPhasesCount} phases
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Set Hue scenes for each workout phase
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all"
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
          className="w-full flex items-center gap-4 p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg
              className="w-7 h-7 text-purple-600 dark:text-purple-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Music
              </h3>
              {hasMusicConfig && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Choose tracks and set transitions
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 pt-2">
        <button
          onClick={onClose}
          className="w-full p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
