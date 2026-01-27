/**
 * Music Trigger Controller
 *
 * Stateless utility for music trigger logic.
 * Single source of truth for:
 * - Trigger evaluation
 * - Phase key management
 * - Countdown detection
 *
 * NOTE: All state (triggeredPhases, consumedPhases) is now stored
 * in the workout machine context. This controller is purely functional.
 */

import type {
  PhaseKey,
  PhaseType,
  TriggerAction,
  MusicTrigger,
  RoundMusicConfig,
  PlayableEnergy,
} from './types';
import { serializePhaseKey, inferCountdownType } from './types';

// =============================================================================
// Phase Key Utilities
// =============================================================================

/**
 * Creates a PhaseKey from workout state.
 */
export function createPhaseKey(
  type: PhaseType,
  roundIndex: number,
  phaseIndex: number,
  setNumber: number
): PhaseKey {
  return { type, roundIndex, phaseIndex, setNumber };
}

/**
 * Serializes a PhaseKey to string for storage.
 */
export function serializeKey(phase: PhaseKey): string {
  return serializePhaseKey(phase);
}

// =============================================================================
// Trigger Configuration
// =============================================================================

/**
 * Gets the trigger configuration for a specific phase.
 */
export function getTriggerConfig(
  musicConfig: RoundMusicConfig | null | undefined,
  phase: PhaseKey
): MusicTrigger | undefined {
  if (!musicConfig) return undefined;

  switch (phase.type) {
    case 'preview':
      return musicConfig.roundPreview;
    case 'exercise':
      return musicConfig.exercises?.[phase.phaseIndex];
    case 'rest':
      return musicConfig.rests?.[phase.phaseIndex];
    case 'setBreak':
      return musicConfig.setBreaks?.[phase.phaseIndex];
    default:
      return undefined;
  }
}

// =============================================================================
// Trigger Evaluation
// =============================================================================

/**
 * Evaluates what action should be taken for a phase transition.
 * Pure function - all state is passed in as parameters.
 *
 * @param phase - The phase being entered
 * @param musicConfig - Music configuration for the current round
 * @param triggeredPhases - Set of phase keys that have been triggered
 * @param consumedPhases - Set of phase keys that have been consumed
 * @param context - Additional context for evaluation
 * @returns The action to take
 */
export function evaluateTrigger(
  phase: PhaseKey,
  musicConfig: RoundMusicConfig | null | undefined,
  triggeredPhases: string[],
  consumedPhases: string[],
  context: {
    isEnabled: boolean;
    isPaused: boolean;
    currentSetNumber: number;
    totalSets: number;
    /** Absolute timestamp (ms) when round/set ends - for precision natural ending */
    roundEndTime?: number;
    /** Rest duration in seconds - for Rise from Rest calculation */
    restDurationSec?: number;
    /** Next exercise trigger config - for Rise from Rest look-ahead */
    nextExerciseTrigger?: MusicTrigger;
  }
): TriggerAction {
  const phaseKey = serializePhaseKey(phase);

  // Early exit if music is disabled or paused
  if (!context.isEnabled) {
    return { type: 'none', reason: 'Music disabled' };
  }
  if (context.isPaused) {
    return { type: 'none', reason: 'Workout paused' };
  }

  // Check deduplication using passed-in state
  if (consumedPhases.includes(phaseKey)) {
    console.log('[MusicTrigger] Phase consumed:', phaseKey);
    return { type: 'none', reason: 'Phase consumed' };
  }
  if (triggeredPhases.includes(phaseKey)) {
    console.log('[MusicTrigger] Phase already triggered:', phaseKey);
    return { type: 'none', reason: 'Phase already triggered' };
  }

  // Rise from Rest: Check on REST phase entry BEFORE checking rest trigger
  // This is because Rise from Rest is configured on the NEXT exercise, not the rest phase
  // For exercise 2+, any useBuildup: true means Rise from Rest (the only "rise" option available)
  // Energy is always 'high' - Rise from Rest seeks to the high/drop segment
  if (phase.type === 'rest' && context.nextExerciseTrigger) {
    const nextTrigger = context.nextExerciseTrigger;
    console.log('[MusicTrigger] Checking Rise from Rest:', {
      nextTriggerEnabled: nextTrigger.enabled,
      useBuildup: nextTrigger.useBuildup,
      restDurationSec: context.restDurationSec,
    });
    if (nextTrigger.enabled && nextTrigger.useBuildup) {
      return {
        type: 'riseFromRest',
        energy: 'high',
        trackId: nextTrigger.trackId,
        segmentTimestamp: nextTrigger.segmentTimestamp,
        restDurationSec: context.restDurationSec ?? 0,
      };
    }
  }

  // Get trigger config
  const trigger = getTriggerConfig(musicConfig, phase);
  if (!trigger?.enabled) {
    return { type: 'none', reason: 'Trigger not enabled' };
  }

  // Apply multi-set logic for exercise/rest phases
  if (phase.type === 'exercise' || phase.type === 'rest') {
    const isLastSet = context.currentSetNumber >= context.totalSets;

    // Natural ending only fires on last set
    if (trigger.naturalEnding && !isLastSet) {
      return { type: 'none', reason: 'Natural ending - not last set' };
    }

    // Non-natural triggers on sets 2+: skip unless repeatOnAllSets
    if (!trigger.naturalEnding && context.currentSetNumber > 1 && !trigger.repeatOnAllSets) {
      return { type: 'none', reason: 'Not repeating on all sets' };
    }
  }

  // Determine countdown type
  const countdownType = inferCountdownType(trigger);

  // Check for countdown triggers on exercise phases
  if (phase.type === 'exercise' && phase.phaseIndex === 0 && countdownType) {
    // Exercise 0: Traditional Rise or High countdown
    if (countdownType === 'rise') {
      return {
        type: 'riseCountdown',
        trackId: trigger.trackId,
        segmentTimestamp: trigger.segmentTimestamp,
      };
    }
    if (countdownType === 'high') {
      // Default duration, can be overridden by caller
      return {
        type: 'highCountdown',
        trackId: trigger.trackId,
        segmentTimestamp: trigger.segmentTimestamp,
        durationMs: 4500,
      };
    }
  }

  // Default: play action
  const energy = trigger.energy ?? 'high';
  const shouldUseNaturalEnding = trigger.naturalEnding && context.currentSetNumber >= context.totalSets;

  return {
    type: 'play',
    energy: energy as PlayableEnergy,
    trackId: trigger.trackId,
    segmentTimestamp: trigger.segmentTimestamp,
    useBuildup: trigger.useBuildup && !trigger.naturalEnding, // No buildup for natural ending
    naturalEnding: shouldUseNaturalEnding,
    roundEndTime: shouldUseNaturalEnding ? context.roundEndTime : undefined,
  };
}

// =============================================================================
// Countdown Helpers
// =============================================================================

/**
 * Checks if a phase should trigger a countdown (Rise or High).
 * Used for optimistic detection before state transition.
 */
export function shouldTriggerCountdown(
  phase: PhaseKey,
  musicConfig: RoundMusicConfig | null | undefined,
  consumedPhases: string[]
): { shouldTrigger: boolean; type: 'rise' | 'high' | null } {
  // Only exercise 0 can trigger countdown
  if (phase.type !== 'exercise' || phase.phaseIndex !== 0) {
    return { shouldTrigger: false, type: null };
  }

  // Check if already consumed
  const phaseKey = serializePhaseKey(phase);
  if (consumedPhases.includes(phaseKey)) {
    return { shouldTrigger: false, type: null };
  }

  // Get trigger config
  const trigger = getTriggerConfig(musicConfig, phase);
  if (!trigger?.enabled) {
    return { shouldTrigger: false, type: null };
  }

  const countdownType = inferCountdownType(trigger);
  if (countdownType === 'rise' || countdownType === 'high') {
    return { shouldTrigger: true, type: countdownType };
  }

  return { shouldTrigger: false, type: null };
}

/**
 * Gets countdown info for display purposes (e.g., button styling).
 */
export function getCountdownInfo(
  roundIndex: number,
  musicConfig: RoundMusicConfig | null | undefined
): { hasCountdown: boolean; type: 'rise' | 'high' | null } {
  const trigger = musicConfig?.exercises?.[0];
  if (!trigger?.enabled) {
    return { hasCountdown: false, type: null };
  }

  const countdownType = inferCountdownType(trigger);
  if (countdownType === 'rise' || countdownType === 'high') {
    return { hasCountdown: true, type: countdownType };
  }

  return { hasCountdown: false, type: null };
}

// =============================================================================
// Legacy Singleton (Deprecated)
// =============================================================================

/**
 * @deprecated Use the stateless functions directly with workout machine context.
 * This class is kept for backwards compatibility during migration.
 */
export class MusicTriggerController {
  // Deduplication state - DEPRECATED: use workout machine context instead
  private triggeredPhases: Set<string> = new Set();
  private consumedPhases: Set<string> = new Set();
  private currentRoundIndex: number = -1;

  createPhaseKey = createPhaseKey;
  serializeKey = serializeKey;

  markTriggered(phase: PhaseKey): void {
    console.warn('[MusicTriggerController] DEPRECATED: markTriggered - use MARK_PHASE_TRIGGERED event');
    this.triggeredPhases.add(this.serializeKey(phase));
  }

  isTriggered(phase: PhaseKey): boolean {
    return this.triggeredPhases.has(this.serializeKey(phase));
  }

  consumePhase(phase: PhaseKey): void {
    console.warn('[MusicTriggerController] DEPRECATED: consumePhase - use CONSUME_PHASE event');
    const key = this.serializeKey(phase);
    this.consumedPhases.add(key);
    this.triggeredPhases.add(key);
  }

  isConsumed(phase: PhaseKey): boolean {
    const key = this.serializeKey(phase);
    return this.consumedPhases.has(key);
  }

  resetForRound(roundIndex: number): void {
    console.warn('[MusicTriggerController] DEPRECATED: resetForRound - machine handles this automatically');
    if (roundIndex !== this.currentRoundIndex) {
      this.triggeredPhases.clear();
      this.consumedPhases.clear();
      this.currentRoundIndex = roundIndex;
    }
  }

  reset(): void {
    console.warn('[MusicTriggerController] DEPRECATED: reset - use RESET_MUSIC_TRIGGERS event');
    this.triggeredPhases.clear();
    this.consumedPhases.clear();
    this.currentRoundIndex = -1;
  }

  clearTriggeredOnly(): void {
    console.warn('[MusicTriggerController] DEPRECATED: clearTriggeredOnly - use CLEAR_TRIGGERED_ONLY event');
    this.triggeredPhases.clear();
  }

  getTriggerConfig = getTriggerConfig;

  evaluateTrigger(
    phase: PhaseKey,
    musicConfig: RoundMusicConfig | null | undefined,
    context: {
      isEnabled: boolean;
      isPaused: boolean;
      currentSetNumber: number;
      totalSets: number;
      roundEndTime?: number;
    }
  ): TriggerAction {
    console.warn('[MusicTriggerController] DEPRECATED: evaluateTrigger - use stateless function with machine context');
    return evaluateTrigger(
      phase,
      musicConfig,
      Array.from(this.triggeredPhases),
      Array.from(this.consumedPhases),
      context
    );
  }

  shouldTriggerCountdown(
    phase: PhaseKey,
    musicConfig: RoundMusicConfig | null | undefined
  ): { shouldTrigger: boolean; type: 'rise' | 'high' | null } {
    return shouldTriggerCountdown(phase, musicConfig, Array.from(this.consumedPhases));
  }

  getCountdownInfo = getCountdownInfo;
}

// Export deprecated singleton for backwards compatibility
export const musicTriggerController = new MusicTriggerController();
