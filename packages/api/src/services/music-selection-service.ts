import type { RoundMusicConfig, MusicTrigger } from "@acme/validators";
import type { RoundTemplate } from "@acme/db";

/**
 * Service for generating music configurations for workout rounds.
 * Handles default trigger generation and energy level defaults.
 */

// Default energy levels by phase type
const PHASE_ENERGY_DEFAULTS: Record<string, 'high' | 'low'> = {
  exercise: 'high',
  rest: 'low',
  roundPreview: 'low',
  setBreak: 'low',
};

/**
 * Creates a default music trigger for a given phase type
 */
export function createDefaultMusicTrigger(
  phaseType: 'exercise' | 'rest' | 'roundPreview' | 'setBreak',
  options?: {
    enabled?: boolean;
    useBuildup?: boolean;
  }
): MusicTrigger {
  return {
    enabled: options?.enabled ?? true,
    energy: PHASE_ENERGY_DEFAULTS[phaseType],
    useBuildup: options?.useBuildup ?? false,
  };
}

/**
 * Generates MINIMAL default music configuration for a round.
 * Only creates two triggers per the user's requirements:
 * - Preview: low energy music
 * - First exercise/station: high energy music with buildup
 *
 * Users can add more triggers manually if needed.
 */
export function generateMinimalMusicConfig(
  template: RoundTemplate
): RoundMusicConfig {
  const config: RoundMusicConfig = {
    // Round preview - trigger low energy track
    roundPreview: createDefaultMusicTrigger('roundPreview'),

    // Only first exercise/station gets a trigger (high energy, use buildup)
    exercises: [
      createDefaultMusicTrigger('exercise', { useBuildup: true })
    ],

    // No rest triggers by default - music continues playing
    rests: [],

    // No set break triggers by default - music continues playing
    setBreaks: [],
  };

  return config;
}

/**
 * Generates FULL default music configuration for a round based on its template.
 * Creates triggers for all phases with sensible defaults.
 * Use this when you need triggers for every phase, not just defaults.
 */
export function generateFullRoundMusicConfig(
  template: RoundTemplate
): RoundMusicConfig {
  const exerciseCount = template.exercisesPerRound;
  const restCount = Math.max(0, exerciseCount - 1); // One less rest than exercises

  // Get repeat times (sets) for the round
  let repeatTimes = 1;
  if (template.type === 'circuit_round' || template.type === 'stations_round') {
    repeatTimes = (template as any).repeatTimes ?? 1;
  }

  // Calculate set breaks needed (one less than repeat times)
  const setBreakCount = Math.max(0, repeatTimes - 1);

  // Generate default triggers for each phase
  const config: RoundMusicConfig = {
    // Round preview - trigger low energy track
    roundPreview: createDefaultMusicTrigger('roundPreview'),

    // Exercise triggers - one per exercise
    exercises: Array.from({ length: exerciseCount }, () =>
      createDefaultMusicTrigger('exercise')
    ),

    // Rest triggers - one per rest (between exercises)
    rests: Array.from({ length: restCount }, () =>
      createDefaultMusicTrigger('rest')
    ),

    // Set break triggers - one per set transition
    setBreaks: Array.from({ length: setBreakCount }, () =>
      createDefaultMusicTrigger('setBreak')
    ),
  };

  // Special handling for AMRAP - no rests, no set breaks, minimal triggers
  if (template.type === 'amrap_round') {
    config.rests = [];
    config.setBreaks = [];
    // For AMRAP, just one exercise trigger at the start
    config.exercises = [createDefaultMusicTrigger('exercise')];
  }

  return config;
}

/**
 * @deprecated Use generateMinimalMusicConfig for new sessions or generateFullRoundMusicConfig for complete triggers
 */
export function generateDefaultRoundMusicConfig(
  template: RoundTemplate
): RoundMusicConfig {
  return generateFullRoundMusicConfig(template);
}

/**
 * Merges user-provided music config with defaults.
 * User config takes precedence, undefined values fall back to defaults.
 */
export function mergeWithDefaultMusicConfig(
  template: RoundTemplate,
  userConfig?: Partial<RoundMusicConfig>
): RoundMusicConfig {
  const defaults = generateDefaultRoundMusicConfig(template);

  if (!userConfig) {
    return defaults;
  }

  return {
    roundPreview: userConfig.roundPreview ?? defaults.roundPreview,
    exercises: userConfig.exercises ?? defaults.exercises,
    rests: userConfig.rests ?? defaults.rests,
    setBreaks: userConfig.setBreaks ?? defaults.setBreaks,
  };
}

/**
 * Gets the effective energy level for a trigger, applying defaults if not specified.
 */
export function getEffectiveEnergy(
  trigger: MusicTrigger,
  phaseType: 'exercise' | 'rest' | 'roundPreview' | 'setBreak'
): 'high' | 'low' {
  return trigger.energy ?? PHASE_ENERGY_DEFAULTS[phaseType];
}
