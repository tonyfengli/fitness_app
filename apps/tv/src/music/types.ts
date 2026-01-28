/**
 * Music Trigger System - Shared Types
 *
 * This file defines all types used across the music trigger infrastructure.
 * Single source of truth for type definitions.
 */

// =============================================================================
// Energy & Segment Types
// =============================================================================

export type PlayableEnergy = 'low' | 'high';
export type EnergyLevel = PlayableEnergy | 'outro';

export interface MusicSegment {
  timestamp: number; // seconds - where this segment starts
  energy: EnergyLevel;
  buildupDuration?: number; // seconds before timestamp where buildup starts
}

// =============================================================================
// Phase Types
// =============================================================================

export type PhaseType = 'preview' | 'exercise' | 'rest' | 'setBreak';

/**
 * Typed phase key - identifies a specific phase in the workout.
 * Used for trigger evaluation and deduplication.
 */
export interface PhaseKey {
  type: PhaseType;
  roundIndex: number;
  phaseIndex: number; // exercise/rest/setBreak index within the round
  setNumber: number;
}

/**
 * Serializes a PhaseKey to a string for use in Sets/Maps.
 */
export function serializePhaseKey(phase: PhaseKey): string {
  return `${phase.type}-${phase.roundIndex}-${phase.phaseIndex}-${phase.setNumber}`;
}

/**
 * Parses a serialized phase key string back to a PhaseKey object.
 */
export function parsePhaseKey(key: string): PhaseKey | null {
  const parts = key.split('-');
  if (parts.length !== 4) return null;

  const [type, roundIndex, phaseIndex, setNumber] = parts;
  if (!type || !roundIndex || !phaseIndex || !setNumber) return null;

  if (!['preview', 'exercise', 'rest', 'setBreak'].includes(type)) return null;

  return {
    type: type as PhaseType,
    roundIndex: parseInt(roundIndex, 10),
    phaseIndex: parseInt(phaseIndex, 10),
    setNumber: parseInt(setNumber, 10),
  };
}

// =============================================================================
// Trigger Configuration Types
// =============================================================================

/**
 * Countdown type for explicit configuration.
 * - 'rise': Buildup from medium to high with overlay (exercise 1)
 * - 'high': Duck current music, countdown, drop to high (exercise 1)
 * - 'riseFromRest': Future - buildup during rest period (exercise 2+)
 */
export type CountdownType = 'rise' | 'high' | 'riseFromRest';

/**
 * Music trigger configuration for a single phase.
 * Stored in CircuitConfig per phase.
 */
export interface MusicTrigger {
  enabled: boolean;
  energy?: PlayableEnergy;
  trackId?: string;

  // Countdown configuration (explicit type preferred over inference)
  countdownType?: CountdownType;

  // Legacy flags (still supported, will be inferred to countdownType)
  useBuildup?: boolean;
  showHighCountdown?: boolean;

  // Timing options
  naturalEnding?: boolean;
  repeatOnAllSets?: boolean;

  // Specific segment timestamp to play (for tracks with multiple high segments)
  segmentTimestamp?: number;
}

/**
 * Music configuration for a round.
 */
export interface RoundMusicConfig {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
  rests?: MusicTrigger[];
  setBreaks?: MusicTrigger[];
}

// =============================================================================
// Trigger Action Types (Result of evaluation)
// =============================================================================

/**
 * No action should be taken for this phase.
 */
export interface NoAction {
  type: 'none';
  reason?: string;
}

/**
 * Play music without countdown overlay.
 */
export interface PlayAction {
  type: 'play';
  energy: PlayableEnergy;
  trackId?: string;
  useBuildup?: boolean;
  naturalEnding?: boolean;
  /** Absolute timestamp (ms) when the round/set ends - used for precision natural ending */
  roundEndTime?: number;
  /** Specific segment timestamp to seek to (for tracks with multiple high segments) */
  segmentTimestamp?: number;
}

/**
 * Rise countdown - buildup from medium to high with overlay.
 */
export interface RiseCountdownAction {
  type: 'riseCountdown';
  trackId?: string;
  segmentTimestamp?: number;
  // riseDuration is calculated from track segments, not stored here
}

/**
 * High countdown - duck music, show overlay, drop to high.
 */
export interface HighCountdownAction {
  type: 'highCountdown';
  trackId?: string;
  segmentTimestamp?: number;
  durationMs: number;
}

/**
 * Rise from rest - music plays during rest, drop hits when exercise starts.
 */
export interface RiseFromRestAction {
  type: 'riseFromRest';
  energy: PlayableEnergy;
  trackId?: string;
  segmentTimestamp?: number;
  /** Absolute timestamp (ms) when exercise starts - used for precision timing */
  exerciseStartTime: number;
}

/**
 * Union of all possible trigger actions.
 */
export type TriggerAction =
  | NoAction
  | PlayAction
  | RiseCountdownAction
  | HighCountdownAction
  | RiseFromRestAction;

// =============================================================================
// Countdown State Types
// =============================================================================

export type CountdownState = 'idle' | 'ready' | 'counting' | 'complete';

export type CountdownPhase = 'ready' | 3 | 2 | 1 | 'complete';

export interface CountdownContext {
  countdownType: CountdownType | null;
  dropTime: number | null;
  trackId: string | undefined;
  phase: CountdownPhase;
}

// =============================================================================
// Controller Event Types
// =============================================================================

export type CountdownEvent =
  | { type: 'START_RISE'; trackId?: string; dropTime: number }
  | { type: 'START_HIGH'; trackId?: string; durationMs: number }
  | { type: 'SKIP' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Infers countdown type from legacy trigger flags.
 * Used for backwards compatibility with existing configs.
 */
export function inferCountdownType(trigger: MusicTrigger): CountdownType | null {
  // Explicit type takes precedence
  if (trigger.countdownType) {
    return trigger.countdownType;
  }

  // Infer from legacy flags
  // Rise countdown: useBuildup is true (medium energy is deprecated)
  if (trigger.useBuildup) {
    return 'rise';
  }
  if (trigger.showHighCountdown && trigger.energy === 'high') {
    return 'high';
  }

  return null;
}

/**
 * Checks if a trigger should show a countdown overlay.
 */
export function hasCountdownOverlay(trigger: MusicTrigger): boolean {
  const countdownType = inferCountdownType(trigger);
  return countdownType === 'rise' || countdownType === 'high';
}
