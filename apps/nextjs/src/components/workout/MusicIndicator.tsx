"use client";

import type { MusicTrigger } from "@fitness/validators";

interface MusicIndicatorProps {
  /** The music trigger configuration */
  trigger: MusicTrigger | null | undefined;
  /** Title for the indicator */
  title?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * Music indicator component that shows a music note icon with energy-based coloring
 * and optional startTimestamp indicator dot.
 */
export function MusicIndicator({
  trigger,
  title = "Music trigger",
  size = "md",
}: MusicIndicatorProps) {
  if (!trigger?.enabled) return null;

  const sizeClasses = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  // Purple for low energy, green for high energy
  const color = trigger.energy === "low" ? "#8B5CF6" : "#10B981";
  const energyLabel = trigger.energy === "low" ? "low energy" : "high energy";

  return (
    <div className="relative flex-shrink-0">
      <svg
        className={sizeClasses}
        viewBox="0 0 24 24"
        fill={color}
        stroke="#9CA3AF"
        strokeWidth="1"
        style={{ filter: `drop-shadow(0 0 2px ${color}80)` }}
        title={`${title} (${energyLabel})`}
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
      {trigger.useStartTimestamp && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full border border-white dark:border-gray-800 bg-amber-500`}
          title="Uses start timestamp"
        />
      )}
    </div>
  );
}
