import type { MusicTrigger, RoundMusicConfig } from "./circuit-config";

/**
 * Phase types that can have music triggers
 */
export type MusicPhaseType = "preview" | "exercise" | "rest" | "setBreak";

/**
 * Result of evaluating a music trigger - contains the action to take
 */
export interface MusicTriggerResult {
  /** Energy level for track selection */
  energy: "low" | "medium" | "high";
  /** Whether to start at buildup point before the drop */
  useBuildup: boolean;
  /** Specific track ID if configured (otherwise select by energy) */
  trackId?: string;
  /** Whether to repeat on all sets (not just first) */
  repeatOnAllSets: boolean;
}

/**
 * Evaluates whether a music trigger should fire for a given phase.
 *
 * @param musicConfig - The round's music configuration (can be null/undefined)
 * @param phase - The current phase type
 * @param phaseIndex - Index within the phase (e.g., which exercise, which rest)
 * @returns The trigger result if a trigger should fire, null otherwise
 *
 * @example
 * // Check if music should change at round preview
 * const result = evaluateMusicTrigger(roundConfig.music, 'preview', 0);
 * if (result) {
 *   playMusic({ energy: result.energy, useBuildup: result.useBuildup });
 * }
 *
 * @example
 * // Check if music should change at exercise 2 (index 1)
 * const result = evaluateMusicTrigger(roundConfig.music, 'exercise', 1);
 */
export function evaluateMusicTrigger(
  musicConfig: RoundMusicConfig | null | undefined,
  phase: MusicPhaseType,
  phaseIndex: number = 0
): MusicTriggerResult | null {
  if (!musicConfig) return null;

  let trigger: MusicTrigger | undefined;

  switch (phase) {
    case "preview":
      trigger = musicConfig.roundPreview;
      break;
    case "exercise":
      trigger = musicConfig.exercises?.[phaseIndex];
      break;
    case "rest":
      trigger = musicConfig.rests?.[phaseIndex];
      break;
    case "setBreak":
      trigger = musicConfig.setBreaks?.[phaseIndex];
      break;
  }

  // No trigger configured or trigger is disabled
  if (!trigger?.enabled) return null;

  // Return the trigger result with defaults
  return {
    energy: trigger.energy ?? "high",
    useBuildup: trigger.useBuildup ?? false,
    trackId: trigger.trackId,
    repeatOnAllSets: trigger.repeatOnAllSets ?? false,
  };
}

/**
 * Checks if any music trigger is configured for a round (regardless of enabled state).
 * Useful for UI indicators.
 *
 * @param musicConfig - The round's music configuration
 * @returns true if any trigger is configured
 */
export function hasMusicConfig(
  musicConfig: RoundMusicConfig | null | undefined
): boolean {
  if (!musicConfig) return false;

  return !!(
    musicConfig.roundPreview?.enabled ||
    musicConfig.exercises?.some((t) => t.enabled) ||
    musicConfig.rests?.some((t) => t.enabled) ||
    musicConfig.setBreaks?.some((t) => t.enabled)
  );
}

/**
 * Gets the raw trigger config for a phase (for UI display purposes).
 * Unlike evaluateMusicTrigger, this returns the raw trigger even if disabled.
 *
 * @param musicConfig - The round's music configuration
 * @param phase - The phase type
 * @param phaseIndex - Index within the phase
 * @returns The raw trigger config or null
 */
export function getMusicTriggerConfig(
  musicConfig: RoundMusicConfig | null | undefined,
  phase: MusicPhaseType,
  phaseIndex: number = 0
): MusicTrigger | null {
  if (!musicConfig) return null;

  switch (phase) {
    case "preview":
      return musicConfig.roundPreview ?? null;
    case "exercise":
      return musicConfig.exercises?.[phaseIndex] ?? null;
    case "rest":
      return musicConfig.rests?.[phaseIndex] ?? null;
    case "setBreak":
      return musicConfig.setBreaks?.[phaseIndex] ?? null;
  }
}
