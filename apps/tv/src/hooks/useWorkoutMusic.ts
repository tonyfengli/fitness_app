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
 */
function calculateFuturePhasesDuration(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: PhaseType
): { duration: number; phaseCount: number } {
  if (!circuitConfig?.config?.roundTemplates) return { duration: 0, phaseCount: 0 };

  const roundConfig = (circuitConfig.config.roundTemplates as any[]).find(
    (rt) => rt.roundNumber === roundIndex + 1
  );
  if (!roundConfig?.template) return { duration: 0, phaseCount: 0 };

  const template = roundConfig.template;
  const exerciseCount = template.exercisesPerRound || 0;

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
 */
function calculatePrecisionRoundEndTime(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: PhaseType,
  actualTimeRemaining: number | undefined,
  includeNaturalEndingOvershoot: boolean = false
): number | undefined {
  // If no actual timer value, we can't calculate precision timing
  if (actualTimeRemaining === undefined || actualTimeRemaining < 0) {
    return undefined;
  }

  const { duration: futureDuration, phaseCount: futurePhaseCount } = calculateFuturePhasesDuration(
    circuitConfig,
    roundIndex,
    currentExerciseIndex,
    phaseType
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
    } = context;

    console.log('[useWorkoutMusic] State changed:', {
      stateValue,
      currentRoundIndex,
      currentExerciseIndex,
      currentSetNumber,
      isPaused,
      musicEnabled,
      musicStartedFromPreview,
      triggeredPhases: triggeredPhases.length,
      consumedPhases: consumedPhases.length,
    });

    // Map state to phase type
    const phaseType = mapStateToPhaseType(stateValue);
    if (!phaseType) {
      console.log('[useWorkoutMusic] No phase type for state:', stateValue);
      return;
    }

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

    // Get total sets for context
    const roundConfig = (circuitConfig?.config?.roundTemplates as any[])?.find(
      (rt) => rt.roundNumber === currentRoundIndex + 1
    );
    const totalSets = roundConfig?.template?.repeatTimes || 1;

    // Check if this phase has natural ending configured AND we're on the last set
    // Natural ending overshoot only applies when both conditions are true
    const triggerConfig = getTriggerConfig(musicConfig, phase);
    const isLastSet = currentSetNumber >= totalSets;
    const hasNaturalEnding = triggerConfig?.naturalEnding && isLastSet;

    // Calculate precision roundEndTime using actual timer state
    // This uses actualTimeRemaining (from state machine) + futurePhases (from config)
    // Much more accurate than calculating everything from config due to setInterval drift
    // For natural ending, adds 3-second overshoot so music plays past round end
    const roundEndTime = calculatePrecisionRoundEndTime(
      circuitConfig,
      currentRoundIndex,
      currentExerciseIndex,
      phaseType,
      context.timeRemaining,
      hasNaturalEnding
    );

    // Evaluate trigger using stateless function with machine context
    // musicEnabled comes from XState context - atomic with triggeredPhases/consumedPhases
    const action = evaluateTrigger(phase, musicConfig, triggeredPhases, consumedPhases, {
      isEnabled: musicEnabled,
      isPaused,
      currentSetNumber,
      totalSets,
      roundEndTime,
    });

    console.log('[useWorkoutMusic] Action:', action);

    const phaseKey = serializeKey(phase);

    // Handle action
    switch (action.type) {
      case 'none':
        console.log('[useWorkoutMusic] No action:', action.reason);
        break;

      case 'play': {
        console.log('[useWorkoutMusic] FIRING play for phase:', phaseKey);
        markTriggered(phaseKey);

        // Skip if preview with same energy already playing (optimization)
        // BUT don't skip if natural ending is active - let it queue in playWithTrigger
        if (phaseType === 'preview' && isPlaying && currentEnergy === action.energy && !action.trackId && !action.useBuildup && !isNaturalEndingActive) {
          console.log('[useWorkoutMusic] SKIPPED - preview with same energy already playing');
          return;
        }

        playWithTrigger({
          energy: action.energy,
          useBuildup: action.useBuildup,
          trackId: action.trackId,
          naturalEnding: action.naturalEnding,
          roundEndTime: action.roundEndTime,
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
          });
          break;
        }
        console.log('[useWorkoutMusic] FIRING Rise countdown for phase:', phaseKey);
        markTriggered(phaseKey);
        setRiseCountdownActive(true);
        playWithTrigger({
          energy: 'medium',
          useBuildup: true,
          trackId: action.trackId,
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

      case 'riseFromRest':
        // Future: implement rise from rest
        console.log('[useWorkoutMusic] Rise from rest not yet implemented');
        break;
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
    circuitConfig,
    playWithTrigger,
    startHighCountdown,
    setRiseCountdownActive,
    isPlaying,
    currentEnergy,
    isNaturalEndingActive,
    markTriggered,
  ]);

  // Reset triggers when workout ends
  useEffect(() => {
    if (workoutState.value === 'idle' || workoutState.value === 'workoutComplete') {
      send({ type: 'RESET_MUSIC_TRIGGERS' });
    }
  }, [workoutState.value, send]);
}
