import { useEffect, useRef } from 'react';
import type { CircuitConfig } from '@acme/db';
import { useMusic } from '../providers/MusicProvider';

// Re-export shared trigger state for use by other screens (e.g., CircuitWorkoutOverviewScreen)
export { useMusic } from '../providers/MusicProvider';

// ============================================================================
// Music Trigger Types & Logic (inlined to avoid zod/v4 bundling issues)
// ============================================================================

type MusicPhaseType = 'preview' | 'exercise' | 'rest' | 'setBreak';

// Playable energy levels (matches MusicProvider)
type PlayableEnergy = 'low' | 'medium' | 'high';

interface MusicTrigger {
  enabled: boolean;
  trackId?: string;
  useBuildup?: boolean; // Start at buildup point before the drop
  energy?: PlayableEnergy;
  repeatOnAllSets?: boolean; // If true, trigger fires on every set (not just first)
  naturalEnding?: boolean; // If true, seek so music ends naturally with round end
  showHighCountdown?: boolean; // If true, show 4.5s countdown before HIGH energy drop
}

interface RoundMusicConfig {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
  rests?: MusicTrigger[];
  setBreaks?: MusicTrigger[];
}

interface MusicTriggerResult {
  energy: PlayableEnergy;
  useBuildup: boolean;
  trackId?: string;
  repeatOnAllSets: boolean;
  naturalEnding: boolean;
  showHighCountdown: boolean;
}

function evaluateMusicTrigger(
  musicConfig: RoundMusicConfig | null | undefined,
  phase: MusicPhaseType,
  phaseIndex: number = 0
): MusicTriggerResult | null {
  if (!musicConfig) return null;

  let trigger: MusicTrigger | undefined;

  switch (phase) {
    case 'preview':
      trigger = musicConfig.roundPreview;
      break;
    case 'exercise':
      trigger = musicConfig.exercises?.[phaseIndex];
      break;
    case 'rest':
      trigger = musicConfig.rests?.[phaseIndex];
      break;
    case 'setBreak':
      trigger = musicConfig.setBreaks?.[phaseIndex];
      break;
  }

  if (!trigger?.enabled) return null;

  return {
    energy: trigger.energy ?? 'high',
    useBuildup: trigger.useBuildup ?? false,
    trackId: trigger.trackId,
    repeatOnAllSets: trigger.repeatOnAllSets ?? false,
    naturalEnding: trigger.naturalEnding ?? false,
    showHighCountdown: trigger.showHighCountdown ?? false,
  };
}

/**
 * Calculates the REMAINING time from the current phase to the end of the SET.
 * Natural ending only fires on the LAST set, so we just need to calculate time to end of current set.
 */
function calculateRemainingSetTime(
  circuitConfig: CircuitConfig | null | undefined,
  roundIndex: number,
  currentExerciseIndex: number,
  phaseType: MusicPhaseType
): number {
  if (!circuitConfig?.config?.roundTemplates) return 0;

  const roundConfig = (circuitConfig.config.roundTemplates as any[]).find(
    (rt) => rt.roundNumber === roundIndex + 1
  );
  if (!roundConfig?.template) return 0;

  const template = roundConfig.template;
  const exerciseCount = template.exercisesPerRound || 0;

  if (template.type === 'circuit_round' || template.type === 'stations_round') {
    const workDuration = template.workDuration || 0;
    const restDuration = template.restDuration || 0;

    // Calculate remaining time in current set from current position
    let remainingInSet = 0;
    const remainingExercises = exerciseCount - currentExerciseIndex;

    // Note: No buffer added here - the OVERSHOOT_BUFFER_SEC in MusicProvider handles timing
    // so the track intentionally runs ~1s past round end and gets smoothly cut off

    if (phaseType === 'exercise') {
      // At start of exercise: current exercise + remaining exercises + rests between them
      remainingInSet = (workDuration * remainingExercises) + (restDuration * Math.max(0, remainingExercises - 1));
    } else if (phaseType === 'rest') {
      // At start of rest: current rest + remaining exercises + rests between them
      const exercisesAfterRest = exerciseCount - currentExerciseIndex - 1;
      remainingInSet = restDuration + (workDuration * exercisesAfterRest) + (restDuration * Math.max(0, exercisesAfterRest - 1));
    } else if (phaseType === 'preview' || phaseType === 'setBreak') {
      // Full set duration
      remainingInSet = (workDuration * exerciseCount) + (restDuration * Math.max(0, exerciseCount - 1));
    }

    return remainingInSet;
  } else if (template.type === 'amrap_round') {
    return template.totalDuration || 0;
  }

  return 0;
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
  };
}

interface UseWorkoutMusicProps {
  /** The workout machine state */
  workoutState: WorkoutState;
  /** The circuit configuration (contains music config per round) */
  circuitConfig: CircuitConfig | null | undefined;
  /** Whether music triggers are enabled */
  enabled?: boolean;
}

/**
 * Maps workout machine state values to music phase types.
 */
function mapStateToPhaseType(stateValue: string): MusicPhaseType | null {
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
 * the phase changes. If a trigger should fire, it calls playWithTrigger
 * on the music provider.
 *
 * @example
 * ```tsx
 * useWorkoutMusic({
 *   workoutState: state,
 *   circuitConfig,
 *   enabled: isMusicEnabled,
 * });
 * ```
 */
export function useWorkoutMusic({
  workoutState,
  circuitConfig,
  enabled = true,
}: UseWorkoutMusicProps) {
  const { playWithTrigger, isPlaying, currentEnergy, lastTriggeredPhase, setLastTriggeredPhase, consumedTriggers, clearConsumedTriggers, startHighCountdown, setRiseCountdownActive } = useMusic();

  // Track previous enabled state to detect re-enable
  const prevEnabledRef = useRef(enabled);
  // Track previous state to detect transitions
  const prevStateRef = useRef(workoutState.value);

  // When user re-enables music (enabled goes false → true), reset lastTriggeredPhase
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      setLastTriggeredPhase(null);
    }
    prevEnabledRef.current = enabled;
  }, [enabled, setLastTriggeredPhase]);

  // Clear consumed triggers when entering roundPreview
  // This ensures that if the user goes back to preview and then manually navigates forward,
  // triggers will fire normally (not be blocked by stale consumed triggers from previous Rise usage)
  useEffect(() => {
    const currentState = workoutState.value;
    const prevState = prevStateRef.current;

    if (currentState === 'roundPreview' && prevState !== 'roundPreview') {
      console.log('[useWorkoutMusic] Entering roundPreview - clearing consumed triggers');
      clearConsumedTriggers();
    }

    prevStateRef.current = currentState;
  }, [workoutState.value, clearConsumedTriggers]);

  useEffect(() => {
    const { value: stateValue, context } = workoutState;
    const { currentRoundIndex, currentExerciseIndex, currentSetNumber, isPaused } = context;

    console.log('[useWorkoutMusic] State changed:', { stateValue, currentRoundIndex, currentExerciseIndex, currentSetNumber, isPaused, enabled });

    if (!enabled || isPaused) return;

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
      // setBreak index is based on which set we're about to start
      phaseIndex = currentSetNumber - 1;
    }

    // Create a unique key for this phase to avoid duplicate triggers
    const phaseKey = `${stateValue}-${currentRoundIndex}-${phaseIndex}-${currentSetNumber}`;
    console.log('[useWorkoutMusic] Phase key:', phaseKey, 'lastTriggeredPhase:', lastTriggeredPhase);
    console.log('[useWorkoutMusic] Consumed triggers:', Array.from(consumedTriggers));

    // Skip if this trigger was pre-consumed (e.g., played early via rise transition)
    if (consumedTriggers.has(phaseKey)) {
      console.log('[useWorkoutMusic] SKIPPED - trigger was pre-consumed:', phaseKey);
      setLastTriggeredPhase(phaseKey);
      return;
    }

    // Skip if we already triggered for this phase
    if (lastTriggeredPhase === phaseKey) {
      console.log('[useWorkoutMusic] SKIPPED - already triggered:', phaseKey);
      return;
    }

    // Get the music config for this round
    const musicConfig = getRoundMusicConfig(circuitConfig, currentRoundIndex);
    const triggerResult = evaluateMusicTrigger(musicConfig, phaseType, phaseIndex);

    // Get total sets to determine last set
    const roundConfig = (circuitConfig?.config?.roundTemplates as any[])?.find(
      (rt) => rt.roundNumber === currentRoundIndex + 1
    );
    const totalSets = roundConfig?.template?.repeatTimes || 1;
    const isLastSet = currentSetNumber >= totalSets;

    // Handle multi-set logic for exercise/rest phases
    if (phaseType === 'exercise' || phaseType === 'rest') {
      // Natural ending ONLY fires on the last set
      if (triggerResult?.naturalEnding && !isLastSet) return;
      // Non-natural-ending triggers on sets 2+: skip unless repeatOnAllSets is enabled
      if (!triggerResult?.naturalEnding && currentSetNumber > 1 && !triggerResult?.repeatOnAllSets) return;
    }

    if (triggerResult) {
      console.log('[useWorkoutMusic] Trigger found:', triggerResult);

      // For preview phases with default triggers, skip if music already playing at same energy
      const isDefaultTrigger = !triggerResult.trackId && !triggerResult.useBuildup;
      if (phaseType === 'preview' && isPlaying && currentEnergy === triggerResult.energy && isDefaultTrigger) {
        console.log('[useWorkoutMusic] SKIPPED - preview with same energy already playing');
        setLastTriggeredPhase(phaseKey);
        return;
      }

      console.log('[useWorkoutMusic] FIRING trigger for phase:', phaseKey);
      setLastTriggeredPhase(phaseKey);

      const shouldUseNaturalEnding = triggerResult.naturalEnding && isLastSet;
      const remainingSetTime = shouldUseNaturalEnding
        ? calculateRemainingSetTime(circuitConfig, currentRoundIndex, currentExerciseIndex, phaseType)
        : undefined;

      // If showHighCountdown is enabled and energy is high, use high countdown flow
      // This ducks the current music and shows a 4.5s countdown before the drop
      // High countdown takes precedence over Rise (useBuildup)
      // NOTE: High countdown fires for exercise 1 (index 0) - the transition INTO exercise
      if (triggerResult.showHighCountdown && triggerResult.energy === 'high' && phaseType === 'exercise' && phaseIndex === 0) {
        console.log('[useWorkoutMusic] Using HIGH countdown flow (exercise 1)');
        startHighCountdown({
          energy: triggerResult.energy,
          trackId: triggerResult.trackId,
        });
      } else if (triggerResult.useBuildup && triggerResult.energy === 'medium' && phaseType === 'exercise' && phaseIndex === 0) {
        // Rise countdown for exercise 1 - set overlay active before playing
        console.log('[useWorkoutMusic] Using RISE countdown flow (exercise 1)');
        setRiseCountdownActive(true);
        playWithTrigger({
          energy: triggerResult.energy,
          useBuildup: true,
          trackId: triggerResult.trackId,
          naturalEnding: shouldUseNaturalEnding,
          roundDurationSec: remainingSetTime,
        });
      } else {
        playWithTrigger({
          energy: triggerResult.energy,
          useBuildup: triggerResult.useBuildup,
          trackId: triggerResult.trackId,
          naturalEnding: shouldUseNaturalEnding,
          roundDurationSec: remainingSetTime,
        });
      }
    } else {
      console.log('[useWorkoutMusic] No trigger result for phase:', phaseKey);
    }
  }, [
    workoutState.value,
    workoutState.context.currentRoundIndex,
    workoutState.context.currentExerciseIndex,
    workoutState.context.currentSetNumber,
    workoutState.context.isPaused,
    circuitConfig,
    enabled,
    playWithTrigger,
    startHighCountdown,
    setRiseCountdownActive,
    isPlaying,
    currentEnergy,
    lastTriggeredPhase,
    setLastTriggeredPhase,
    consumedTriggers,
  ]);

  // Reset the last triggered phase when the workout restarts or round changes significantly
  useEffect(() => {
    // Reset when going back to idle or workout complete
    if (workoutState.value === 'idle' || workoutState.value === 'workoutComplete') {
      setLastTriggeredPhase(null);
    }
  }, [workoutState.value, setLastTriggeredPhase]);
}
