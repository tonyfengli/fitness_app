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
  };
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
  const { playWithTrigger, isPlaying, currentEnergy, lastTriggeredPhase, setLastTriggeredPhase } = useMusic();

  // Track previous enabled state to detect re-enable
  const prevEnabledRef = useRef(enabled);

  // When user re-enables music (enabled goes false → true), reset lastTriggeredPhase
  // so the current phase trigger can fire
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      console.log(`[useWorkoutMusic] Music re-enabled - resetting trigger state`);
      setLastTriggeredPhase(null);
    }
    prevEnabledRef.current = enabled;
  }, [enabled, setLastTriggeredPhase]);

  useEffect(() => {
    const { value: stateValue, context } = workoutState;
    const { currentRoundIndex, currentExerciseIndex, currentSetNumber, isPaused } = context;

    // Debug: Log every state change
    console.log(`[useWorkoutMusic] State change:`, {
      stateValue,
      roundIndex: currentRoundIndex,
      exerciseIndex: currentExerciseIndex,
      setNumber: currentSetNumber,
      isPaused,
      enabled,
      hasConfig: !!circuitConfig?.config?.roundTemplates,
    });

    if (!enabled) {
      console.log(`[useWorkoutMusic] Skipping - not enabled`);
      return;
    }

    // Don't trigger while paused
    if (isPaused) {
      console.log(`[useWorkoutMusic] Skipping - paused`);
      return;
    }

    // Map state to phase type
    const phaseType = mapStateToPhaseType(stateValue);
    if (!phaseType) {
      console.log(`[useWorkoutMusic] Skipping - unmapped state: ${stateValue}`);
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

    // Skip if we already triggered for this phase (shared across screens)
    if (lastTriggeredPhase === phaseKey) {
      console.log(`[useWorkoutMusic] Skipping - already triggered for: ${phaseKey}`);
      return;
    }

    // Get the music config for this round
    const musicConfig = getRoundMusicConfig(circuitConfig, currentRoundIndex);
    console.log(`[useWorkoutMusic] Round ${currentRoundIndex + 1} music config:`, musicConfig);

    // Evaluate the trigger
    const triggerResult = evaluateMusicTrigger(musicConfig, phaseType, phaseIndex);
    console.log(`[useWorkoutMusic] Trigger evaluation for ${phaseType}[${phaseIndex}]:`, triggerResult);

    // Skip non-first sets unless repeatOnAllSets is enabled
    if ((phaseType === 'exercise' || phaseType === 'rest') && currentSetNumber > 1) {
      if (!triggerResult?.repeatOnAllSets) {
        console.log(`[useWorkoutMusic] Skipping - not first set (set ${currentSetNumber}) and repeatOnAllSets is false`);
        return;
      }
      console.log(`[useWorkoutMusic] repeatOnAllSets enabled - firing trigger on set ${currentSetNumber}`);
    }

    if (triggerResult) {
      // For preview phases, skip trigger if:
      // - Music is already playing at the same energy level
      // - The trigger is a "default" trigger (no specific trackId, no useBuildup)
      // This allows seamless navigation between round previews without interrupting music
      const isDefaultTrigger = !triggerResult.trackId && !triggerResult.useBuildup;
      if (phaseType === 'preview' && isPlaying && currentEnergy === triggerResult.energy && isDefaultTrigger) {
        console.log(`[useWorkoutMusic] Skipping preview trigger - music already playing at ${currentEnergy} energy (default trigger)`);
        setLastTriggeredPhase(phaseKey); // Mark as triggered to prevent re-firing
        return;
      }

      console.log(`[useWorkoutMusic] 🎵 FIRING TRIGGER for ${phaseType} at round ${currentRoundIndex + 1}, index ${phaseIndex}:`, triggerResult);

      // Mark this phase as triggered (shared across screens)
      setLastTriggeredPhase(phaseKey);

      // Fire the music action
      playWithTrigger({
        energy: triggerResult.energy,
        useBuildup: triggerResult.useBuildup,
        trackId: triggerResult.trackId,
      });
    } else {
      console.log(`[useWorkoutMusic] No trigger for ${phaseType}[${phaseIndex}]`);
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
    isPlaying,
    currentEnergy,
    lastTriggeredPhase,
    setLastTriggeredPhase,
  ]);

  // Reset the last triggered phase when the workout restarts or round changes significantly
  useEffect(() => {
    // Reset when going back to idle or workout complete
    if (workoutState.value === 'idle' || workoutState.value === 'workoutComplete') {
      setLastTriggeredPhase(null);
    }
  }, [workoutState.value, setLastTriggeredPhase]);
}
