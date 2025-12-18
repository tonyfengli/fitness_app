import { useEffect, useCallback, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { workoutMachine } from '../../../machines/workoutMachine';
import { useWorkoutLighting } from '../../../hooks/useWorkoutLighting';
import type { CircuitConfig } from '@acme/db';
import { RoundData, CircuitExercise } from '../types';

interface UseWorkoutMachineWithLightingProps {
  circuitConfig: CircuitConfig | null | undefined;
  roundsData: RoundData[];
  selections: any[] | null | undefined;
  sessionId?: string | null;
  onWorkoutComplete?: () => void;
  isStartedOverride?: boolean;
}

export function useWorkoutMachineWithLighting({ 
  circuitConfig, 
  roundsData, 
  selections,
  sessionId,
  onWorkoutComplete,
  isStartedOverride = false
}: UseWorkoutMachineWithLightingProps) {
  const previousStateRef = useRef<string | null>(null);
  const hasAppliedInitialLighting = useRef(false);
  
  console.log('[useWorkoutMachineWithLighting] Hook initialized with:', {
    sessionId,
    hasCircuitConfig: !!circuitConfig,
    roundsCount: roundsData.length,
    selectionsCount: selections?.length || 0,
    isStartedOverride
  });
  
  // Initialize state machine with default context
  const [state, send] = useMachine(workoutMachine, {
    context: {
      circuitConfig,
      timeRemaining: 0,
      isPaused: false,
      currentRoundIndex: 0,
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      rounds: roundsData,
      selections: selections || [],
      isStarted: false // Always false in the machine, we'll use the override separately
    }
  });
  
  // Initialize lighting
  const { applyLightingForPhase, resetPhase, isLightingEnabled, lightingConfig } = useWorkoutLighting({
    sessionId,
    isEnabled: true
  });
  
  console.log('[useWorkoutMachineWithLighting] Lighting status:', {
    isLightingEnabled,
    hasLightingConfig: !!lightingConfig,
    lightingEnabled: lightingConfig?.enabled
  });

  // Update machine context when data changes
  useEffect(() => {
    if (circuitConfig) {
      send({ type: 'CONFIG_UPDATED', config: circuitConfig });
    }
  }, [circuitConfig, send]);

  useEffect(() => {
    if (roundsData.length > 0) {
      send({ type: 'SELECTIONS_UPDATED', selections: roundsData });
    }
  }, [roundsData, send]);

  // Timer management
  useEffect(() => {
    if (state.context.timeRemaining > 0 && !state.context.isPaused) {
      const interval = setInterval(() => {
        send({ type: 'TIMER_TICK' });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.context.timeRemaining, state.context.isPaused, send]);

  // Get round timing helper
  const getRoundTiming = useCallback((roundIndex: number) => {
    const config = circuitConfig?.config;
    const roundTemplates = config?.roundTemplates;
    
    if (!roundTemplates || !config) {
      return {
        workDuration: config?.workDuration || 45,
        restDuration: config?.restDuration || 15,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const,
        repeatTimes: 1
      };
    }
    
    const currentTemplate = roundTemplates.find(
      rt => rt.roundNumber === roundIndex + 1
    );
    
    if (!currentTemplate) {
      return {
        workDuration: config.workDuration || 45,
        restDuration: config.restDuration || 15,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const,
        repeatTimes: 1
      };
    }
    
    const template = currentTemplate.template;
    if (template.type === 'circuit_round') {
      return {
        workDuration: template.workDuration ?? config.workDuration ?? 45,
        restDuration: template.restDuration ?? config.restDuration ?? 15,
        restBetweenSets: (template as any).restBetweenSets ?? 30,
        roundType: 'circuit_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'stations_round') {
      return {
        workDuration: (template as any).workDuration ?? config.workDuration ?? 60,
        restDuration: (template as any).restDuration ?? config.restDuration ?? 15,
        restBetweenSets: (template as any).restBetweenSets ?? 30,
        roundType: 'stations_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'amrap_round') {
      const totalDuration = (template as any).totalDuration || 300;
      return {
        workDuration: totalDuration,
        restDuration: 0,
        roundType: 'amrap_round' as const,
        repeatTimes: 1
      };
    }
    
    return {
      workDuration: config.workDuration || 45,
      restDuration: config.restDuration || 15,
      restBetweenSets: 30,
      roundType: 'circuit_round' as const,
      repeatTimes: 1
    };
  }, [circuitConfig]);

  // Helper to get detailed phase type for lighting
  const getDetailedPhaseType = useCallback((
    state: any,
    roundType: string
  ): { phaseType: string; detailedPhaseType?: string } => {
    const currentRound = state.context.rounds[state.context.currentRoundIndex];
    const currentExercise: CircuitExercise | undefined = currentRound?.exercises[state.context.currentExerciseIndex];
    
    if (state.value === 'roundPreview') {
      return { phaseType: 'preview' };
    }
    
    if (state.value === 'exercise' || state.value === 'rest') {
      if (roundType === 'stations_round') {
        // For stations, use sequential station index
        const sequentialIndex = state.context.currentExerciseIndex;
        
        if (state.value === 'exercise') {
          return {
            phaseType: 'work',
            detailedPhaseType: `work-station-${sequentialIndex}`
          };
        } else {
          return {
            phaseType: 'rest',
            detailedPhaseType: `rest-after-station-${sequentialIndex}`
          };
        }
      } else if (roundType === 'circuit_round') {
        // For circuit, use exercise index
        if (state.value === 'exercise') {
          return {
            phaseType: 'work',
            detailedPhaseType: `work-exercise-${state.context.currentExerciseIndex}`
          };
        } else {
          return {
            phaseType: 'rest',
            detailedPhaseType: `rest-after-exercise-${state.context.currentExerciseIndex}`
          };
        }
      } else if (roundType === 'amrap_round') {
        // AMRAP only has work phase
        return { phaseType: state.value === 'exercise' ? 'work' : 'rest' };
      }
    }
    
    if (state.value === 'setBreak') {
      return { phaseType: 'roundBreak' };
    }
    
    // Default
    return { phaseType: state.value };
  }, []);

  // Apply lighting when state changes
  useEffect(() => {
    console.log('[useWorkoutMachineWithLighting] Effect triggered:', {
      stateValue: state.value,
      isStarted: state.context.isStarted,
      previousState: previousStateRef.current,
      roundIndex: state.context.currentRoundIndex,
      exerciseIndex: state.context.currentExerciseIndex,
      isStartedOverride,
      contextDump: state.context
    });
    
    // Only process state changes (not initial render)
    if (previousStateRef.current === null) {
      previousStateRef.current = state.value;
      console.log('[useWorkoutMachineWithLighting] Initial render, skipping lighting');
      return;
    }
    
    // Check if state actually changed
    const isInitialLightingNeeded = isStartedOverride && !hasAppliedInitialLighting.current && isLightingEnabled && lightingConfig;
    
    if (previousStateRef.current === state.value && 
        previousStateRef.current !== 'exercise' && 
        previousStateRef.current !== 'rest' &&
        !isInitialLightingNeeded) {
      // For non-exercise/rest states, only trigger on actual state change
      console.log('[useWorkoutMachineWithLighting] Same state, skipping lighting');
      return;
    }
    
    previousStateRef.current = state.value;
    
    // Skip if workout not started or completed (unless override is active)
    if ((!state.context.isStarted && !isStartedOverride) || state.value === 'workoutComplete') {
      console.log('[useWorkoutMachineWithLighting] Workout not started or completed, skipping lighting');
      return;
    }
    
    const roundTiming = getRoundTiming(state.context.currentRoundIndex);
    const { phaseType, detailedPhaseType } = getDetailedPhaseType(state, roundTiming.roundType);
    
    console.log('[useWorkoutMachineWithLighting] State changed - applying lighting:', {
      state: state.value,
      roundIndex: state.context.currentRoundIndex,
      exerciseIndex: state.context.currentExerciseIndex,
      phaseType,
      detailedPhaseType,
      roundType: roundTiming.roundType,
      isLightingEnabled,
      hasLightingConfig: !!lightingConfig
    });
    
    // Apply lighting for the new phase
    applyLightingForPhase({
      roundIndex: state.context.currentRoundIndex,
      phaseType,
      detailedPhaseType
    }).then(() => {
      console.log('[useWorkoutMachineWithLighting] Lighting applied successfully');
      // Mark initial lighting as applied if override is active
      if (isStartedOverride) {
        hasAppliedInitialLighting.current = true;
      }
    }).catch((error) => {
      console.error('[useWorkoutMachineWithLighting] Failed to apply lighting:', error);
    });
  }, [
    state.value, 
    state.context.currentRoundIndex, 
    state.context.currentExerciseIndex,
    state.context.isStarted,
    getRoundTiming,
    getDetailedPhaseType,
    applyLightingForPhase,
    isLightingEnabled,
    lightingConfig
  ]);

  // Reset lighting when workout completes
  useEffect(() => {
    if (state.value === 'workoutComplete') {
      resetPhase();
    }
  }, [state.value, resetPhase]);

  // Timer complete handling
  useEffect(() => {
    if (state.context.timeRemaining === 0 && 
        (state.value === 'exercise' || 
         state.value === 'rest' || 
         state.value === 'setBreak' || 
         (state.value === 'roundPreview' && state.context.currentRoundIndex > 0))) {
      console.log('[Timer Complete] Sending TIMER_COMPLETE event', {
        state: state.value,
        roundIndex: state.context.currentRoundIndex,
        exerciseIndex: state.context.currentExerciseIndex,
        roundType: getRoundTiming(state.context.currentRoundIndex).roundType
      });
      const timeoutId = setTimeout(() => {
        send({ type: 'TIMER_COMPLETE' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [state.context.timeRemaining, state.value, send, getRoundTiming, state.context.currentRoundIndex, state.context.currentExerciseIndex]);

  // Navigate back when workout completes
  useEffect(() => {
    if (state.value === 'workoutComplete' && onWorkoutComplete) {
      // Small delay to allow any animations or final state updates
      const timeoutId = setTimeout(() => {
        onWorkoutComplete();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [state.value, onWorkoutComplete]);

  return { state, send, getRoundTiming };
}