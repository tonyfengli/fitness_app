/**
 * Music Trigger Controller
 *
 * Central controller for all music trigger logic.
 * Single source of truth for:
 * - Trigger evaluation
 * - Phase key management
 * - Deduplication
 * - Countdown state coordination
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
// Controller Class
// =============================================================================

export class MusicTriggerController {
  // Deduplication state
  private triggeredPhases: Set<string> = new Set();
  private consumedPhases: Set<string> = new Set();

  // Current round tracking
  private currentRoundIndex: number = -1;

  // =============================================================================
  // Phase Key Management
  // =============================================================================

  /**
   * Creates a PhaseKey from workout state.
   */
  createPhaseKey(
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
  serializeKey(phase: PhaseKey): string {
    return serializePhaseKey(phase);
  }

  // =============================================================================
  // Deduplication
  // =============================================================================

  /**
   * Marks a phase as triggered (prevents re-firing on same phase).
   */
  markTriggered(phase: PhaseKey): void {
    this.triggeredPhases.add(this.serializeKey(phase));
  }

  /**
   * Checks if a phase has already been triggered.
   */
  isTriggered(phase: PhaseKey): boolean {
    return this.triggeredPhases.has(this.serializeKey(phase));
  }

  /**
   * Consumes a phase (prevents firing even if state re-enters).
   * Used for manual countdown triggers.
   */
  consumePhase(phase: PhaseKey): void {
    const key = this.serializeKey(phase);
    console.log('[MusicTriggerController] consumePhase:', key, '| currentRoundIndex:', this.currentRoundIndex);
    this.consumedPhases.add(key);
    this.triggeredPhases.add(key); // Also mark as triggered
  }

  /**
   * Checks if a phase has been consumed.
   */
  isConsumed(phase: PhaseKey): boolean {
    const key = this.serializeKey(phase);
    const consumed = this.consumedPhases.has(key);
    console.log('[MusicTriggerController] isConsumed:', key, '=', consumed, '| consumedPhases:', Array.from(this.consumedPhases), '| currentRoundIndex:', this.currentRoundIndex);
    return consumed;
  }

  /**
   * Resets deduplication state for a new round.
   * Called when entering roundPreview.
   *
   * Clears both triggeredPhases and consumedPhases when round changes.
   * This allows triggers (including Rise/High countdowns) to fire again
   * when navigating to a different round.
   *
   * Same-round re-entry (e.g., going back to preview within the same round)
   * does NOT clear anything - consumed phases persist within a round.
   */
  resetForRound(roundIndex: number): void {
    const willReset = roundIndex !== this.currentRoundIndex;
    console.log('[MusicTriggerController] resetForRound:', roundIndex, '| currentRoundIndex:', this.currentRoundIndex, '| willReset:', willReset, '| consumedPhases before:', Array.from(this.consumedPhases));
    if (willReset) {
      this.triggeredPhases.clear();
      this.consumedPhases.clear();
      this.currentRoundIndex = roundIndex;
      console.log('[MusicTriggerController] resetForRound CLEARED - new currentRoundIndex:', this.currentRoundIndex);
    }
  }

  /**
   * Clears all deduplication state.
   */
  reset(): void {
    console.log('[MusicTriggerController] reset() called - clearing all state. Was:', { consumedPhases: Array.from(this.consumedPhases), currentRoundIndex: this.currentRoundIndex });
    this.triggeredPhases.clear();
    this.consumedPhases.clear();
    this.currentRoundIndex = -1;
  }

  /**
   * Clears only triggered phases, preserving consumed phases.
   * Used when music is re-enabled - we want normal triggers to re-fire,
   * but consumed phases (from countdown flow) should stay blocked
   * until round changes or workout restarts.
   */
  clearTriggeredOnly(): void {
    console.log('[MusicTriggerController] clearTriggeredOnly() - preserving consumedPhases:', Array.from(this.consumedPhases));
    this.triggeredPhases.clear();
  }

  // =============================================================================
  // Trigger Evaluation
  // =============================================================================

  /**
   * Gets the trigger configuration for a specific phase.
   */
  getTriggerConfig(
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

  /**
   * Evaluates what action should be taken for a phase transition.
   *
   * @param phase - The phase being entered
   * @param musicConfig - Music configuration for the current round
   * @param context - Additional context for evaluation
   * @returns The action to take
   */
  evaluateTrigger(
    phase: PhaseKey,
    musicConfig: RoundMusicConfig | null | undefined,
    context: {
      isEnabled: boolean;
      isPaused: boolean;
      currentSetNumber: number;
      totalSets: number;
      /** Absolute timestamp (ms) when round/set ends - for precision natural ending */
      roundEndTime?: number;
    }
  ): TriggerAction {
    // Early exit if music is disabled or paused
    if (!context.isEnabled) {
      return { type: 'none', reason: 'Music disabled' };
    }
    if (context.isPaused) {
      return { type: 'none', reason: 'Workout paused' };
    }

    // Check deduplication
    if (this.isConsumed(phase)) {
      this.markTriggered(phase); // Still mark as triggered for tracking
      return { type: 'none', reason: 'Phase consumed' };
    }
    if (this.isTriggered(phase)) {
      return { type: 'none', reason: 'Phase already triggered' };
    }

    // Get trigger config
    const trigger = this.getTriggerConfig(musicConfig, phase);
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

    // Check for countdown triggers (only on exercise 0)
    if (phase.type === 'exercise' && phase.phaseIndex === 0 && countdownType) {
      if (countdownType === 'rise') {
        return {
          type: 'riseCountdown',
          trackId: trigger.trackId,
        };
      }
      if (countdownType === 'high') {
        // Default duration, can be overridden by caller
        return {
          type: 'highCountdown',
          trackId: trigger.trackId,
          durationMs: 4500,
        };
      }
    }

    // Future: Rise from rest for exercise 2+
    // if (phase.type === 'exercise' && phase.phaseIndex > 0 && countdownType === 'riseFromRest') {
    //   return {
    //     type: 'riseFromRest',
    //     trackId: trigger.trackId,
    //     restDurationSec: context.restDurationSec ?? 0,
    //   };
    // }

    // Default: play action
    const energy = trigger.energy ?? 'high';
    const shouldUseNaturalEnding = trigger.naturalEnding && context.currentSetNumber >= context.totalSets;

    return {
      type: 'play',
      energy: energy as PlayableEnergy,
      trackId: trigger.trackId,
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
  shouldTriggerCountdown(
    phase: PhaseKey,
    musicConfig: RoundMusicConfig | null | undefined
  ): { shouldTrigger: boolean; type: 'rise' | 'high' | null } {
    // Only exercise 0 can trigger countdown
    if (phase.type !== 'exercise' || phase.phaseIndex !== 0) {
      return { shouldTrigger: false, type: null };
    }

    // Check if already consumed
    if (this.isConsumed(phase)) {
      return { shouldTrigger: false, type: null };
    }

    // Get trigger config
    const trigger = this.getTriggerConfig(musicConfig, phase);
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
  getCountdownInfo(
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
}

// =============================================================================
// Singleton Instance
// =============================================================================

// Export a singleton instance for use across the app
export const musicTriggerController = new MusicTriggerController();
