"use client";

interface LightingIndicatorProps {
  /** Primary color for the work/main phase */
  primaryColor: string | null;
  /** Secondary color for rest/break phase (shown as small dot) */
  secondaryColor?: string | null;
  /** Title for the primary indicator */
  primaryTitle?: string;
  /** Title for the secondary indicator */
  secondaryTitle?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * Lighting indicator component that shows a lightbulb icon with optional
 * secondary color dot for rest/break phases.
 */
export function LightingIndicator({
  primaryColor,
  secondaryColor,
  primaryTitle = "Work lighting",
  secondaryTitle = "Rest lighting",
  size = "md",
}: LightingIndicatorProps) {
  const sizeClasses = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  // No indicators to show
  if (!primaryColor && !secondaryColor) return null;

  // Only secondary (rest/break) - show as a colored dot
  if (!primaryColor && secondaryColor) {
    return (
      <div
        className={`${size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600`}
        style={{
          backgroundColor: secondaryColor,
          boxShadow: `0 0 4px ${secondaryColor}60`,
        }}
        title={secondaryTitle}
      />
    );
  }

  // Primary (work) with optional secondary dot
  return (
    <div className="relative flex-shrink-0">
      <svg
        className={sizeClasses}
        viewBox="0 0 24 24"
        fill={primaryColor!}
        stroke="#9CA3AF"
        strokeWidth="1"
        style={{ filter: `drop-shadow(0 0 2px ${primaryColor}80)` }}
        title={primaryTitle}
      >
        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
      </svg>
      {secondaryColor && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full border border-white dark:border-gray-800`}
          style={{ backgroundColor: secondaryColor }}
          title={secondaryTitle}
        />
      )}
    </div>
  );
}
