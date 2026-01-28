import { useEffect, useRef, useCallback } from 'react';
import type { CircuitConfig } from '@acme/db';
import { useMusic } from '../providers/MusicProvider';
import {
  createPhaseKey,
  serializeKey,
  getTriggerConfig,
  evaluateTrigger,
  type PhaseType,
  type PhaseKey,
  type RoundMusicConfig,
  type MusicTrigger,
} from '../music';

// Re-export shared trigger state for use by other screens (e.g., CircuitWorkoutOverviewScreen)
export { useMusic } from '../providers/MusicProvider';

// =============================================================================
// Smart Drift Buffer Constants
// =============================================================================

/**
 * Drift buffer constants calibrated from real-world timing observations.
 *
 * Sources of timing drift:
 * 1. setInterval drift: ~16-50ms per tick accumulates over phase duration
 * 2. State transition overhead: ~100-200ms per TIMER_COMPLETE event
 * 3. Effect execution delay: ~10-50ms for React scheduling
 * 4. Music service delay: ~800ms for fade out + load + start
 */
const TRANSITION_DELAY_SEC = 0.2;   // Overhead per state transition
const DRIFT_RATE = 0.04;            // 4% drift per second of phase duration
const CURRENT_PHASE_DELAY_SEC = 1.0; // Effect scheduling + music loading delay

/**
 * Minimum duration (seconds) a track should play before the next trigger fires.
 * Used to prevent very short plays (e.g., 10 seconds) before a transition.
 */
const MIN_PLAY_DURATION_SEC = 30;

/**
 * Intentional overshoot for natural ending tracks.
 * Music will end 2 seconds AFTER the round ends, allowing a smooth
 * transition where the next round's music is queued and plays after
 * the natural ending track finishes.
 */
const NATURAL_ENDING_OVERSHOOT_SEC = 2.0;

/**
 * Calculates the time for FUTURE phases only (not including current phase).
 * Returns both the raw duration and the phase count for smart buffer calculation.
 *
 * For natural ending, we need: actualTimeRemaining + futurePhasesDuration + buffer
 * The buffer compensates for setInterval drift and state transition overhead.
 *
 * @param actualExerciseCount - Actual exercise count from workout machine (defensive source of truth)
 */
function calculateFuturePhasesDuration(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: PhaseType,
  actualExerciseCount?: number
): { duration: number; phaseCount: number } {
  if (!circuitConfig?.config?.roundTemplates) return { duration: 0, phaseCount: 0 };

  const roundConfig = (circuitConfig.config.roundTemplates as any[]).find(
    (rt) => rt.roundNumber === roundIndex + 1
  );
  if (!roundConfig?.template) return { duration: 0, phaseCount: 0 };

  const template = roundConfig.template;
  const templateExerciseCount = template.exercisesPerRound || 0;

  // DEFENSIVE: Use actual exercise count from workout machine as source of truth
  // Falls back to template.exercisesPerRound if actual count not available
  // This prevents bugs when config's exercisesPerRound is stale (e.g., exercises added after round creation)
  const exerciseCount = actualExerciseCount ?? templateExerciseCount;

  // Log if there's a mismatch (helps debug config issues)
  if (actualExerciseCount !== undefined && templateExerciseCount !== actualExerciseCount) {
    console.warn('[useWorkoutMusic] Exercise count mismatch (using actual):', {
      templateExercisesPerRound: templateExerciseCount,
      actualExerciseCount,
      usingActual: exerciseCount,
    });
  }

  if (template.type === 'circuit_round' || template.type === 'stations_round') {
    const workDuration = template.workDuration || 0;
    const restDuration = template.restDuration || 0;

    // Calculate FUTURE phases only (phases AFTER current one completes)
    let futureDuration = 0;
    let futurePhaseCount = 0;

    if (phaseType === 'exercise') {
      // After current exercise: remaining rests + remaining exercises (excluding current)
      const futureExercises = exerciseCount - currentExerciseIndex - 1;
      const futureRests = Math.max(0, futureExercises); // Rest after each exercise except last
      futureDuration = (workDuration * futureExercises) + (restDuration * futureRests);
      futurePhaseCount = futureExercises + futureRests; // Each exercise and rest is a phase
    } else if (phaseType === 'rest') {
      // After current rest: remaining exercises + remaining rests
      const futureExercises = exerciseCount - currentExerciseIndex - 1;
      const futureRests = Math.max(0, futureExercises - 1);
      futureDuration = (workDuration * futureExercises) + (restDuration * futureRests);
      futurePhaseCount = futureExercises + futureRests;
    } else if (phaseType === 'preview' || phaseType === 'setBreak') {
      // After preview/setBreak: full set (all exercises + all rests)
      const totalRests = Math.max(0, exerciseCount - 1);
      futureDuration = (workDuration * exerciseCount) + (restDuration * totalRests);
      futurePhaseCount = exerciseCount + totalRests;
    }

    return { duration: futureDuration, phaseCount: futurePhaseCount };
  } else if (template.type === 'amrap_round') {
    // AMRAP is a single continuous phase, no future phases
    return { duration: 0, phaseCount: 0 };
  }

  return { duration: 0, phaseCount: 0 };
}

/**
 * Calculates precision roundEndTime using actual timer state with smart drift buffer.
 *
 * Formula:
 *   buffer = (futurePhaseCount × TRANSITION_DELAY) + (futureDuration × DRIFT_RATE) + CURRENT_PHASE_DELAY
 *   roundEndTime = Date.now() + (actualTimeRemaining + futureDuration + buffer) * 1000
 *
 * This compensates for:
 * 1. setInterval drift (~4% of phase duration)
 * 2. State transition overhead (~200ms per transition)
 * 3. Effect scheduling + music loading delay (~1s)
 * 4. Natural ending overshoot (optional 3s for queue-based transitions)
 *
 * @param actualExerciseCount - Actual exercise count from workout machine (defensive source of truth)
 */
function calculatePrecisionRoundEndTime(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: PhaseType,
  actualTimeRemaining: number | undefined,
  includeNaturalEndingOvershoot: boolean = false,
  actualExerciseCount?: number
): number | undefined {
  // If no actual timer value, we can't calculate precision timing
  if (actualTimeRemaining === undefined || actualTimeRemaining < 0) {
    return undefined;
  }

  const { duration: futureDuration, phaseCount: futurePhaseCount } = calculateFuturePhasesDuration(
    circuitConfig,
    roundIndex,
    currentExerciseIndex,
    phaseType,
    actualExerciseCount
  );

  // Calculate smart drift buffer based on future phase characteristics
  const transitionBuffer = futurePhaseCount * TRANSITION_DELAY_SEC;
  const driftBuffer = futureDuration * DRIFT_RATE;
  const naturalEndingOvershoot = includeNaturalEndingOvershoot ? NATURAL_ENDING_OVERSHOOT_SEC : 0;
  const totalBuffer = transitionBuffer + driftBuffer + CURRENT_PHASE_DELAY_SEC + naturalEndingOvershoot;

  const totalRemainingSec = actualTimeRemaining + futureDuration + totalBuffer;

  if (totalRemainingSec <= 0) {
    return undefined;
  }

  const roundEndTime = Date.now() + (totalRemainingSec * 1000);

  console.log('[useWorkoutMusic] Precision timing:', {
    actualTimeRemaining,
    futureDuration,
    futurePhaseCount,
    transitionBuffer: transitionBuffer.toFixed(2),
    driftBuffer: driftBuffer.toFixed(2),
    naturalEndingOvershoot: naturalEndingOvershoot.toFixed(2),
    totalBuffer: totalBuffer.toFixed(2),
    totalRemainingSec: totalRemainingSec.toFixed(2),
    roundEndTime,
    now: Date.now(),
  });

  return roundEndTime;
}

// =============================================================================
// Next Trigger Time Calculation
// =============================================================================

/**
 * Calculates the absolute timestamp (ms) when the next music trigger will fire.
 * Used for the 30-second minimum play duration rule.
 *
 * Logic:
 * 1. Get current phase end time (now + timeRemaining)
 * 2. Iterate through remaining phases in round
 * 3. For each phase, check if trigger is enabled
 * 4. If enabled: return phase start time
 * 5. If no triggers found: return round end time (next preview)
 *
 * For AMRAP: Skip to step 5 (no internal phases with triggers)
 *
 * @param actualExerciseCount - Actual exercise count from workout machine (defensive source of truth)
 */
function calculateNextTriggerTime(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: PhaseType,
  actualTimeRemaining: number | undefined,
  currentSetNumber: number,
  musicConfig: RoundMusicConfig | null,
  actualExerciseCount?: number
): number | undefined {
  if (actualTimeRemaining === undefined || actualTimeRemaining < 0) {
    return undefined;
  }

  if (!circuitConfig?.config?.roundTemplates) return undefined;

  const roundConfig = (circuitConfig.config.roundTemplates as any[]).find(
    (rt) => rt.roundNumber === roundIndex + 1
  );
  if (!roundConfig?.template) return undefined;

  const template = roundConfig.template;
  const templateExerciseCount = template.exercisesPerRound || 0;
  // DEFENSIVE: Use actual exercise count from workout machine as source of truth
  const exerciseCount = actualExerciseCount ?? templateExerciseCount;
  const workDuration = template.workDuration || 0;
  const restDuration = template.restDuration || 0;
  const totalSets = template.repeatTimes || 1;

  // For AMRAP rounds, next trigger is always round end (next preview)
  if (template.type === 'amrap_round') {
    const amrapDuration = template.amrapDuration || 0;
    let remainingInRound = actualTimeRemaining;
    if (phaseType !== 'exercise') {
      // If in preview, add AMRAP duration
      remainingInRound = actualTimeRemaining + amrapDuration;
    }
    return Date.now() + (remainingInRound * 1000);
  }

  // For circuit/stations rounds, iterate through remaining phases
  const now = Date.now();
  let accumulatedTime = actualTimeRemaining * 1000; // Start with current phase remaining

  // Helper to check if a trigger is enabled for a phase
  const isTriggerEnabled = (type: PhaseType, index: number, setNum: number): boolean => {
    if (!musicConfig) return false;

    let trigger: MusicTrigger | undefined;
    switch (type) {
      case 'preview':
        trigger = musicConfig.roundPreview;
        break;
      case 'exercise':
        trigger = musicConfig.exercises?.[index];
        break;
      case 'rest':
        // Check for Rise from Rest (next exercise has useBuildup)
        const nextExerciseTrigger = musicConfig.exercises?.[index + 1];
        if (nextExerciseTrigger?.enabled && nextExerciseTrigger.useBuildup) {
          return true; // Rise from Rest fires on rest entry
        }
        trigger = musicConfig.rests?.[index];
        break;
      case 'setBreak':
        trigger = musicConfig.setBreaks?.[index];
        break;
    }

    if (!trigger?.enabled) return false;

    // Check multi-set logic
    if (type === 'exercise' || type === 'rest') {
      const isLastSet = setNum >= totalSets;
      if (trigger.naturalEnding && !isLastSet) return false;
      if (!trigger.naturalEnding && setNum > 1 && !trigger.repeatOnAllSets) return false;
    }

    return true;
  };

  // Phases after current phase in current set
  // Order: exercise -> rest -> exercise -> rest -> ... (no rest after last exercise)
  let setNum = currentSetNumber;
  let exIndex = currentExerciseIndex;

  // Move to next phase based on current phase type
  if (phaseType === 'exercise') {
    // After exercise: check rest (if not last exercise) or next exercise
    if (exIndex < exerciseCount - 1) {
      // Check rest trigger
      accumulatedTime += 0; // We're at end of exercise, rest starts now
      if (isTriggerEnabled('rest', exIndex, setNum)) {
        return now + accumulatedTime;
      }
      accumulatedTime += restDuration * 1000;
      exIndex++;
    } else {
      // Last exercise in set - check for set break or next set
      exIndex = 0;
      setNum++;
      if (setNum > totalSets) {
        // Round complete - next trigger is next round's preview
        return now + accumulatedTime;
      }
      // Check setBreak trigger
      if (isTriggerEnabled('setBreak', 0, setNum)) {
        return now + accumulatedTime;
      }
      // Add setBreak duration if configured
      const setBreakDuration = template.setBreakDuration || restDuration;
      accumulatedTime += setBreakDuration * 1000;
    }
  } else if (phaseType === 'rest') {
    // After rest: next exercise
    exIndex++;
    accumulatedTime += 0; // Rest just ended
  } else if (phaseType === 'setBreak') {
    // After setBreak: first exercise of new set
    exIndex = 0;
    accumulatedTime += 0;
  } else if (phaseType === 'preview') {
    // After preview: first exercise
    exIndex = 0;
    accumulatedTime += 0;
  }

  // Now iterate through remaining phases
  while (setNum <= totalSets) {
    // Check exercise trigger
    if (isTriggerEnabled('exercise', exIndex, setNum)) {
      return now + accumulatedTime;
    }
    accumulatedTime += workDuration * 1000;

    // After exercise: rest (if not last exercise)
    if (exIndex < exerciseCount - 1) {
      if (isTriggerEnabled('rest', exIndex, setNum)) {
        return now + accumulatedTime;
      }
      accumulatedTime += restDuration * 1000;
      exIndex++;
    } else {
      // Last exercise - move to next set
      exIndex = 0;
      setNum++;
      if (setNum > totalSets) break;

      // Check setBreak trigger
      if (isTriggerEnabled('setBreak', 0, setNum)) {
        return now + accumulatedTime;
      }
      const setBreakDuration = template.setBreakDuration || restDuration;
      accumulatedTime += setBreakDuration * 1000;
    }
  }

  // No more triggers in round - return round end time
  return now + accumulatedTime;
}

// ============================================================================

interface WorkoutState {
  /** Current state machine value (roundPreview, exercise, rest, setBreak, etc.) */
  value: string;
  context: {
    currentRoundIndex: number;
    currentExerciseIndex: number;
    currentSetNumber: number;
    isPaused: boolean;
    isStarted: boolean;
    /** Actual remaining time in current phase (from state machine timer) */
    timeRemaining?: number;
    /** Music trigger phases that have been triggered - from machine context */
    triggeredPhases: string[];
    /** Music trigger phases that have been consumed - from machine context */
    consumedPhases: string[];
    /** Music enabled state - from machine context for atomic updates */
    musicEnabled: boolean;
    /** Whether music was enabled from preview (true) vs mid-workout (false) */
    musicStartedFromPreview: boolean;
    /** Actual rounds data from workout machine - used for defensive exercise count */
    rounds?: { exercises: any[] }[];
  };
}

interface UseWorkoutMusicProps {
  /** The workout machine state */
  workoutState: WorkoutState;
  /** The circuit configuration (contains music config per round) */
  circuitConfig: CircuitConfig | null | undefined;
  /** Function to send events to the workout machine */
  send: (event: { type: string; phaseKey?: string; enabled?: boolean }) => void;
}

/**
 * Maps workout machine state values to music phase types.
 */
function mapStateToPhaseType(stateValue: string): PhaseType | null {
  switch (stateValue) {
    case 'roundPreview':
      return 'preview';
    case 'exercise':
      return 'exercise';
    case 'rest':
      return 'rest';
    case 'setBreak':
      return 'setBreak';
    default:
      return null;
  }
}

/**
 * Gets the music config for a specific round from the circuit config.
 */
function getRoundMusicConfig(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number
): RoundMusicConfig | null {
  if (!circuitConfig?.config?.roundTemplates) return null;

  const roundTemplate = (circuitConfig.config.roundTemplates as any[]).find(
    (rt) => rt.roundNumber === roundIndex + 1
  );

  return (roundTemplate?.music as RoundMusicConfig) ?? null;
}

/**
 * Hook that bridges workout state to music triggers.
 *
 * Watches the workout machine state and evaluates music triggers when
 * the phase changes. Uses stateless evaluateTrigger function with
 * phase state from the workout machine context.
 *
 * @example
 * ```tsx
 * useWorkoutMusic({
 *   workoutState: state,
 *   circuitConfig,
 *   enabled: isMusicEnabled,
 *   send: send,  // from useMachine
 * });
 * ```
 */
export function useWorkoutMusic({
  workoutState,
  circuitConfig,
  send,
}: UseWorkoutMusicProps) {
  const {
    playWithTrigger,
    isPlaying,
    currentEnergy,
    startHighCountdown,
    setRiseCountdownActive,
    isNaturalEndingActive,
    playRiseFromRest,
    setAutoProgressEnergy,
    setAutoProgressPhaseCategory,
    setNextTriggerTime,
  } = useMusic();

  // musicEnabled now comes from XState context - atomic with trigger state
  // No more race conditions between React state and XState events

  // Callback to mark a phase as triggered
  const markTriggered = useCallback((phaseKey: string) => {
    send({ type: 'MARK_PHASE_TRIGGERED', phaseKey });
  }, [send]);

  // Main trigger evaluation effect
  useEffect(() => {
    const { value: stateValue, context } = workoutState;
    const {
      currentRoundIndex,
      currentExerciseIndex,
      currentSetNumber,
      isPaused,
      triggeredPhases,
      consumedPhases,
      musicEnabled,
      musicStartedFromPreview,
      skippedFromPreview,
      rounds,
    } = context;

    // DEFENSIVE: Get actual exercise count from workout machine's rounds data
    // This is the source of truth - actual exercises in the workout, not stale config
    const actualExerciseCount = rounds?.[currentRoundIndex]?.exercises?.length;

    console.log('[useWorkoutMusic] State changed:', {
      stateValue,
      currentRoundIndex,
      currentExerciseIndex,
      currentSetNumber,
      isPaused,
      musicEnabled,
      musicStartedFromPreview,
      skippedFromPreview,
      triggeredPhases: triggeredPhases.length,
      consumedPhases: consumedPhases.length,
      actualExerciseCount,
    });

    // Map state to phase type
    const phaseType = mapStateToPhaseType(stateValue);
    if (!phaseType) {
      console.log('[useWorkoutMusic] No phase type for state:', stateValue);
      return;
    }

    // Set auto-progress energy and phase category based on phase type
    // Energy: 'low' for previews (background music during intro), 'high' for exercise/rest/setBreak
    // Phase category: 'preview' for roundPreview, 'workout' for exercise/rest/setBreak
    const autoProgressEnergy = phaseType === 'preview' ? 'low' : 'high';
    const autoProgressPhaseCategory = phaseType === 'preview' ? 'preview' : 'workout';
    setAutoProgressEnergy(autoProgressEnergy);
    setAutoProgressPhaseCategory(autoProgressPhaseCategory);
    console.log('[useWorkoutMusic] Set autoProgress:', { energy: autoProgressEnergy, phaseCategory: autoProgressPhaseCategory, phase: phaseType });

    // Calculate next trigger time for 30-second minimum play duration rule
    // This needs to happen BEFORE we get the music config since the calculation
    // needs the config but we want to store it for auto-progression
    // We'll recalculate after getting music config below

    // Determine the phase index based on the phase type
    let phaseIndex = 0;
    if (phaseType === 'exercise' || phaseType === 'rest') {
      phaseIndex = currentExerciseIndex;
    } else if (phaseType === 'setBreak') {
      phaseIndex = currentSetNumber - 1;
    }

    // Create phase key
    const phase: PhaseKey = createPhaseKey(
      phaseType,
      currentRoundIndex,
      phaseIndex,
      currentSetNumber
    );

    // Get music config for this round
    const musicConfig = getRoundMusicConfig(circuitConfig, currentRoundIndex);

    // Calculate and store next trigger time for 30-second minimum play duration rule
    const nextTriggerTime = calculateNextTriggerTime(
      circuitConfig,
      currentRoundIndex,
      currentExerciseIndex,
      phaseType,
      context.timeRemaining,
      currentSetNumber,
      musicConfig,
      actualExerciseCount
    );
    setNextTriggerTime(nextTriggerTime);
    console.log('[useWorkoutMusic] Next trigger time calculated:', nextTriggerTime,
      nextTriggerTime ? `(${Math.round((nextTriggerTime - Date.now()) / 1000)}s from now)` : '');

    // Get round config for timing info
    const roundConfig = (circuitConfig?.config?.roundTemplates as any[])?.find(
      (rt) => rt.roundNumber === currentRoundIndex + 1
    );
    const totalSets = roundConfig?.template?.repeatTimes || 1;
    const restDurationSec = roundConfig?.template?.restDuration || 0;

    // For rest phases, get the next exercise's trigger config (for Rise from Rest look-ahead)
    const nextExerciseTrigger = phaseType === 'rest'
      ? musicConfig?.exercises?.[phaseIndex + 1]
      : undefined;

    // Check if this phase has natural ending configured AND we're on the last set
    // Natural ending overshoot only applies when both conditions are true
    const triggerConfig = getTriggerConfig(musicConfig, phase);
    const isLastSet = currentSetNumber >= totalSets;
    const hasNaturalEnding = triggerConfig?.naturalEnding && isLastSet;

    // Calculate precision roundEndTime using actual timer state
    // This uses actualTimeRemaining (from state machine) + futurePhases (from config)
    // Much more accurate than calculating everything from config due to setInterval drift
    // For natural ending, adds 3-second overshoot so music plays past round end
    // Uses actualExerciseCount from workout machine for defensive exercise counting
    const roundEndTime = calculatePrecisionRoundEndTime(
      circuitConfig,
      currentRoundIndex,
      currentExerciseIndex,
      phaseType,
      context.timeRemaining,
      hasNaturalEnding,
      actualExerciseCount
    );

    // Evaluate trigger using stateless function with machine context
    // musicEnabled comes from XState context - atomic with triggeredPhases/consumedPhases
    const action = evaluateTrigger(phase, musicConfig, triggeredPhases, consumedPhases, {
      isEnabled: musicEnabled,
      isPaused,
      currentSetNumber,
      totalSets,
      roundEndTime,
      restDurationSec,
      nextExerciseTrigger,
    });

    console.log('[useWorkoutMusic] Action:', action);

    const phaseKey = serializeKey(phase);

    // Handle action
    switch (action.type) {
      case 'none':
        console.log('[useWorkoutMusic] No action:', action.reason);
        // Fallback: If phase is consumed but music is enabled and not playing,
        // start playback anyway. This handles mid-workout music activation where
        // the phase was already triggered/consumed before music was enabled.
        if (action.reason === 'Phase consumed' && musicEnabled && !isPlaying) {
          console.log('[useWorkoutMusic] Fallback: phase consumed but music enabled and not playing, triggering playback');
          playWithTrigger({
            energy: autoProgressEnergy,
            phaseCategory: autoProgressPhaseCategory,
          });
        }
        break;

      case 'play': {
        console.log('[useWorkoutMusic] FIRING play for phase:', phaseKey);
        markTriggered(phaseKey);

        // Skip preview when skipped from another preview (unless explicit trackId)
        // This keeps current music playing when user skips between round previews
        if (phaseType === 'preview' && skippedFromPreview && !action.trackId) {
          console.log('[useWorkoutMusic] SKIPPED - skipped from preview, keeping current music');
          return;
        }

        playWithTrigger({
          energy: action.energy,
          useBuildup: action.useBuildup,
          trackId: action.trackId,
          naturalEnding: action.naturalEnding,
          roundEndTime: action.roundEndTime,
          segmentTimestamp: action.segmentTimestamp,
          phaseCategory: autoProgressPhaseCategory,
        });
        break;
      }

      case 'riseCountdown':
        // Gate countdown with musicStartedFromPreview flag
        // If music was enabled mid-workout, skip countdown and just play
        if (!musicStartedFromPreview) {
          console.log('[useWorkoutMusic] SKIPPING Rise countdown - music enabled mid-workout, playing directly');
          markTriggered(phaseKey);
          playWithTrigger({
            energy: 'high', // Skip buildup, go straight to high
            useBuildup: false,
            trackId: action.trackId,
            segmentTimestamp: action.segmentTimestamp,
            phaseCategory: 'workout', // Rise countdown is always during exercise start
          });
          break;
        }
        console.log('[useWorkoutMusic] FIRING Rise countdown for phase:', phaseKey);
        markTriggered(phaseKey);
        setRiseCountdownActive(true);
        playWithTrigger({
          energy: 'high',
          useBuildup: true,
          trackId: action.trackId,
          phaseCategory: 'workout', // Rise countdown is always during exercise start
        });
        break;

      case 'highCountdown':
        // Gate countdown with musicStartedFromPreview flag
        // If music was enabled mid-workout, skip countdown and just play
        if (!musicStartedFromPreview) {
          console.log('[useWorkoutMusic] SKIPPING High countdown - music enabled mid-workout, playing directly');
          markTriggered(phaseKey);
          playWithTrigger({
            energy: 'high',
            useBuildup: false,
            trackId: action.trackId,
            segmentTimestamp: action.segmentTimestamp,
            phaseCategory: 'workout', // High countdown is always during exercise start
          });
          break;
        }
        console.log('[useWorkoutMusic] FIRING High countdown for phase:', phaseKey);
        markTriggered(phaseKey);
        startHighCountdown({
          energy: 'high',
          trackId: action.trackId,
          durationMs: action.durationMs,
        });
        break;

      case 'riseFromRest': {
        // Rise from Rest - music plays during rest, drop hits when exercise starts
        // Gate with musicStartedFromPreview flag (same as other countdowns)

        // Also consume the NEXT exercise phase so it doesn't fire when we enter the exercise
        // Rise from Rest is for exerciseIndex+1 (the exercise AFTER this rest)
        const nextExercisePhase = createPhaseKey(
          'exercise',
          currentRoundIndex,
          currentExerciseIndex + 1,
          currentSetNumber
        );
        const nextExerciseKey = serializeKey(nextExercisePhase);

        if (!musicStartedFromPreview) {
          console.log('[useWorkoutMusic] SKIPPING Rise from Rest - music enabled mid-workout, playing directly');
          markTriggered(phaseKey);
          send({ type: 'CONSUME_PHASE', phaseKey: nextExerciseKey });
          playWithTrigger({
            energy: 'high',
            useBuildup: false,
            trackId: action.trackId,
            segmentTimestamp: action.segmentTimestamp,
            phaseCategory: 'workout', // Rise from Rest is during rest/exercise phases
          });
          break;
        }
        console.log('[useWorkoutMusic] FIRING Rise from Rest for phase:', phaseKey, 'exerciseStartTime:', action.exerciseStartTime);
        console.log('[useWorkoutMusic] Also consuming next exercise phase:', nextExerciseKey);
        markTriggered(phaseKey);
        send({ type: 'CONSUME_PHASE', phaseKey: nextExerciseKey });
        playRiseFromRest({
          trackId: action.trackId,
          exerciseStartTime: action.exerciseStartTime,
          segmentTimestamp: action.segmentTimestamp,
        });
        break;
      }
    }
  }, [
    workoutState.value,
    workoutState.context.currentRoundIndex,
    workoutState.context.currentExerciseIndex,
    workoutState.context.currentSetNumber,
    workoutState.context.isPaused,
    workoutState.context.triggeredPhases,
    workoutState.context.consumedPhases,
    workoutState.context.musicEnabled,
    workoutState.context.musicStartedFromPreview,
    workoutState.context.skippedFromPreview,
    workoutState.context.rounds,
    circuitConfig,
    playWithTrigger,
    startHighCountdown,
    setRiseCountdownActive,
    setAutoProgressEnergy,
    setAutoProgressPhaseCategory,
    setNextTriggerTime,
    isPlaying,
    currentEnergy,
    isNaturalEndingActive,
    markTriggered,
    playRiseFromRest,
  ]);

  // Reset triggers when workout ends
  useEffect(() => {
    if (workoutState.value === 'idle' || workoutState.value === 'workoutComplete') {
      send({ type: 'RESET_MUSIC_TRIGGERS' });
    }
  }, [workoutState.value, send]);
}
