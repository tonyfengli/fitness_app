"use client";

import React from "react";

interface MusicTrigger {
  enabled: boolean;
  energy?: "low" | "medium" | "high";
  useBuildup?: boolean;
  trackId?: string;
  trackName?: string;
  repeatOnAllSets?: boolean;
}

interface MusicTriggers {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
  rests?: MusicTrigger[];
  setBreaks?: MusicTrigger[];
}

interface MusicLightingButtonProps {
  roundNumber: number;
  roundType: "circuit_round" | "stations_round" | "amrap_round";
  hasLightingConfig?: boolean;
  hasMusicConfig?: boolean;
  musicTriggers?: MusicTriggers;
  exerciseCount: number;
  onClick: () => void;
}

export function MusicLightingButton({
  roundNumber,
  roundType,
  hasLightingConfig = false,
  hasMusicConfig = false,
  musicTriggers,
  exerciseCount,
  onClick,
}: MusicLightingButtonProps) {
  const hasAnyConfig = hasLightingConfig || hasMusicConfig;

  // Build music trigger dots - represents all phases in order
  const getMusicDots = () => {
    const dots: Array<{ enabled: boolean; energy?: "high" | "medium" | "low"; type: "preview" | "exercise" | "rest" }> = [];

    // Preview phase (all round types have this)
    const previewTrigger = musicTriggers?.roundPreview;
    dots.push({
      enabled: previewTrigger?.enabled ?? false,
      energy: previewTrigger?.energy,
      type: "preview",
    });

    // AMRAP only has preview + single work phase
    if (roundType === "amrap_round") {
      const workTrigger = musicTriggers?.exercises?.[0];
      dots.push({
        enabled: workTrigger?.enabled ?? false,
        energy: workTrigger?.energy,
        type: "exercise",
      });
      return dots;
    }

    // Circuit and stations rounds: interleave exercises and rests
    if (exerciseCount === 0) return dots;

    const exercises = musicTriggers?.exercises || [];
    const rests = musicTriggers?.rests || [];

    for (let i = 0; i < exerciseCount; i++) {
      // Exercise dot
      const exTrigger = exercises[i];
      dots.push({
        enabled: exTrigger?.enabled ?? false,
        energy: exTrigger?.energy,
        type: "exercise",
      });

      // Rest dot (except after last exercise)
      if (i < exerciseCount - 1) {
        const restTrigger = rests[i];
        dots.push({
          enabled: restTrigger?.enabled ?? false,
          energy: restTrigger?.energy,
          type: "rest",
        });
      }
    }

    return dots;
  };

  const musicDots = getMusicDots();
  const enabledCount = musicDots?.filter(d => d.enabled).length || 0;
  const hasAnyEnabled = enabledCount > 0;

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
          {/* Text and Music Summary */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${hasAnyConfig || hasAnyEnabled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
              Music & Lighting
            </span>

            {/* Music trigger dots - scannable energy visualization */}
            {musicDots && musicDots.length > 0 ? (
              <div className="flex items-center gap-1">
                {musicDots.map((dot, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      dot.enabled
                        ? dot.energy === "low"
                          ? "bg-blue-300 dark:bg-blue-400/60"
                          : dot.energy === "medium"
                          ? "bg-amber-300 dark:bg-amber-400/60"
                          : "bg-orange-300 dark:bg-orange-400/60"
                        : "bg-gray-200 dark:bg-gray-600"
                    }`}
                    title={`${dot.type}${dot.enabled ? `: ${dot.energy || "high"} energy` : " (off)"}`}
                  />
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
