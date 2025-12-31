import { useEffect, useCallback, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { workoutMachine } from '../../../machines/workoutMachine';
// Removed lighting import - now handled at component level
import type { CircuitConfig } from '@acme/db';
import { RoundData, CircuitExercise } from '../types';
import { audioService } from '../../../services/AudioService';

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
  
  // Lighting is now handled at the component level

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

  // Track previous time remaining for countdown detection
  const prevTimeRemaining = useRef(state.context.timeRemaining);

  // Timer management with countdown audio
  useEffect(() => {
    if (state.context.timeRemaining > 0 && !state.context.isPaused) {
      const interval = setInterval(() => {
        send({ type: 'TIMER_TICK' });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.context.timeRemaining, state.context.isPaused, send]);

  // Countdown audio trigger
  useEffect(() => {
    const currentTime = state.context.timeRemaining;
    const previousTime = prevTimeRemaining.current;
    
    // Log timer changes for debugging sync issues
    if (currentTime !== previousTime && currentTime <= 5 && currentTime >= 0) {
      console.log(`[Timer] ${state.value} - Time: ${currentTime}s`);
    }
    
    // Play individual beeps at 4, 3, 2, and 1 seconds
    if ((state.value === 'exercise' || state.value === 'rest') && 
        !state.context.isPaused &&
        (currentTime === 4 || currentTime === 3 || currentTime === 2 || currentTime === 1) && 
        previousTime > currentTime) {
      console.log(`[Timer] Playing beep at ${currentTime}s during ${state.value}`);
      // Initialize audio service if not already done
      audioService.initialize().then(() => {
        if (currentTime === 1) {
          // For the final beep, play to the end of the file
          audioService.playFinalBeep();
        } else {
          // For other beeps, play just the single beep
          audioService.playSingleBeep();
        }
      }).catch(console.error);
    }
    
    prevTimeRemaining.current = currentTime;
  }, [state.context.timeRemaining, state.value, state.context.isPaused]);

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

  // Removed phase type helper - lighting now handled at component level

  // Removed lighting effect - now handled at component level

  // Removed lighting reset - now handled at component level

  // Timer complete handling
  useEffect(() => {
    if (state.context.timeRemaining === 0 && 
        (state.value === 'exercise' || 
         state.value === 'rest' || 
         state.value === 'setBreak' || 
         (state.value === 'roundPreview' && state.context.currentRoundIndex > 0))) {
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