"use client";

import React from "react";

interface MusicTrigger {
  enabled: boolean;
  energy?: "high" | "low";
  useStartTimestamp?: boolean;
}

interface MusicTriggers {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
}

interface MusicLightingButtonProps {
  roundNumber: number;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  hasLightingConfig?: boolean;
  hasMusicConfig?: boolean;
  musicTriggers?: MusicTriggers;
  onClick: () => void;
}

export function MusicLightingButton({
  roundNumber,
  roundType,
  hasLightingConfig = false,
  hasMusicConfig = false,
  musicTriggers,
  onClick,
}: MusicLightingButtonProps) {
  const hasAnyConfig = hasLightingConfig || hasMusicConfig;

  // Build music trigger summary
  const getMusicSummary = () => {
    if (!musicTriggers) return null;

    const parts: { label: string; energy: "high" | "low"; hasDrop?: boolean }[] = [];

    // Check preview
    if (musicTriggers.roundPreview?.enabled) {
      parts.push({
        label: "Preview",
        energy: musicTriggers.roundPreview.energy || "low",
        hasDrop: musicTriggers.roundPreview.useStartTimestamp,
      });
    }

    // Check first exercise (represents exercise phase)
    const firstExercise = musicTriggers.exercises?.[0];
    if (firstExercise?.enabled) {
      parts.push({
        label: roundType === "stations_round" ? "Stations" : "Exercise",
        energy: firstExercise.energy || "high",
        hasDrop: firstExercise.useStartTimestamp,
      });
    }

    return parts.length > 0 ? parts : null;
  };

  const musicSummary = getMusicSummary();

  return (
    <div className="mt-6">
      {/* Separator with label */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Atmosphere
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
      </div>

      {/* Button */}
      <button
        onClick={onClick}
        className={`
          w-full rounded-xl px-4 py-3.5
          flex items-center justify-between
          transition-all duration-200
          border
          ${hasAnyConfig
            ? 'bg-gradient-to-r from-amber-50/80 to-purple-50/80 dark:from-amber-900/10 dark:to-purple-900/10 border-amber-200/50 dark:border-purple-700/30 hover:from-amber-50 hover:to-purple-50 dark:hover:from-amber-900/20 dark:hover:to-purple-900/20'
            : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:bg-gray-100/70 dark:hover:bg-gray-800/50'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Icons container */}
          <div className="flex items-center gap-1.5">
            {/* Lightbulb icon */}
            <div className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${hasLightingConfig
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-700/50'
              }
            `}>
              <svg
                className={`w-4 h-4 ${hasLightingConfig ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}
                viewBox="0 0 24 24"
                fill={hasLightingConfig ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={hasLightingConfig ? 0 : 1.5}
              >
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
              </svg>
            </div>

            {/* Music icon */}
            <div className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${musicSummary
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-gray-100 dark:bg-gray-700/50'
              }
            `}>
              <svg
                className={`w-4 h-4 ${musicSummary ? 'text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}
                viewBox="0 0 24 24"
                fill={musicSummary ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={musicSummary ? 0 : 1.5}
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          </div>

          {/* Text and Music Summary */}
          <div className="flex flex-col items-start gap-1">
            <span className={`text-sm font-medium ${hasAnyConfig || musicSummary ? 'text-gray-700 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
              Music & Lighting
            </span>

            {/* Music trigger summary - subtle inline display */}
            {musicSummary ? (
              <div className="flex items-center gap-1.5">
                {musicSummary.map((part, idx) => (
                  <React.Fragment key={part.label}>
                    {idx > 0 && (
                      <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          part.energy === "low"
                            ? "bg-violet-400"
                            : "bg-emerald-400"
                        }`}
                        title={`${part.energy} energy`}
                      />
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {part.label}
                      </span>
                      {part.hasDrop && (
                        <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium">
                          drop
                        </span>
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Tap to configure
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className="w-5 h-5 text-gray-400 dark:text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
