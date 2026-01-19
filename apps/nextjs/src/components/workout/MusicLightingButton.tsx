"use client";

import React from "react";

interface MusicLightingButtonProps {
  roundNumber: number;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  hasLightingConfig?: boolean;
  hasMusicConfig?: boolean;
  onClick: () => void;
}

export function MusicLightingButton({
  roundNumber,
  roundType,
  hasLightingConfig = false,
  hasMusicConfig = false,
  onClick,
}: MusicLightingButtonProps) {
  const hasAnyConfig = hasLightingConfig || hasMusicConfig;

  return (
    <button
      onClick={onClick}
      className="mt-4 w-full border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-2">
        {/* Music & Lighting icon (sliders/mixing) */}
        <svg
          className="w-4 h-4 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
          />
        </svg>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Music & Lighting
        </span>

        {/* Status indicators */}
        {hasAnyConfig && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            · {[hasLightingConfig && "Lights", hasMusicConfig && "Music"].filter(Boolean).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
}
