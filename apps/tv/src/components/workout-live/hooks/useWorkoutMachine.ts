import { useEffect, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { workoutMachine } from '../../../machines/workoutMachine';
import type { CircuitConfig } from '@acme/db';
import { RoundData } from '../types';

interface UseWorkoutMachineProps {
  circuitConfig: CircuitConfig | null | undefined;
  roundsData: RoundData[];
  selections: any[] | null | undefined;
  onWorkoutComplete?: () => void;
}

export function useWorkoutMachine({ 
  circuitConfig, 
  roundsData, 
  selections,
  onWorkoutComplete 
}: UseWorkoutMachineProps) {
  // Initialize state machine
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
      isStarted: false
    }
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

  // Timer complete handling
  useEffect(() => {
    if (state.context.timeRemaining === 0 && 
        (state.value === 'exercise' || 
         state.value === 'rest' || 
         state.value === 'setBreak' || 
         (state.value === 'roundPreview' && state.context.currentRoundIndex > 0))) {
      // Timer has reached 0, trigger state transition
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