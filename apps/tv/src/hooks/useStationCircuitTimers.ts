import { useEffect, useRef, useState, useCallback } from 'react';

interface StationCircuitConfig {
  workDuration: number;
  restDuration: number;
  sets: number;
}

interface StationCircuitState {
  phase: 'WORK' | 'REST';
  timeRemaining: number;
  currentSet: number;
  totalSets: number;
  isActive: boolean;
}

interface UseStationCircuitTimersProps {
  stationCircuits: Record<string, StationCircuitConfig> | undefined;
  isPaused: boolean;
  isActive: boolean; // Is the workout active
  currentStationIndex: number;
  mainTimerValue?: number; // Main timer value to sync with
  currentSetNumber?: number; // Current set number to detect resets
  currentRoundIndex?: number; // Current round index to detect round changes
  stateValue?: string; // Current state value to detect state transitions
}

export function useStationCircuitTimers({
  stationCircuits,
  isPaused,
  isActive,
  currentStationIndex,
  mainTimerValue,
  currentSetNumber,
  currentRoundIndex,
  stateValue
}: UseStationCircuitTimersProps) {
  const [timerStates, setTimerStates] = useState<Record<string, StationCircuitState>>({});
  const lastMainTimerValueRef = useRef<number | undefined>(mainTimerValue);
  const elapsedSecondsRef = useRef<Record<string, number>>({});
  const lastSetNumberRef = useRef<number | undefined>(currentSetNumber);
  const lastRoundIndexRef = useRef<number | undefined>(currentRoundIndex);
  const lastStateValueRef = useRef<string | undefined>(stateValue);
  const wasInactiveRef = useRef<boolean>(!isActive);

  // Helper function to reset timers
  const resetTimers = useCallback(() => {
    
    if (!stationCircuits) {
      return;
    }

    const initialStates: Record<string, StationCircuitState> = {};
    const initialElapsed: Record<string, number> = {};
    
    Object.entries(stationCircuits).forEach(([stationIndex, config]) => {
      initialStates[stationIndex] = {
        phase: 'WORK',
        timeRemaining: config.workDuration,
        currentSet: 1,
        totalSets: config.sets,
        isActive: true
      };
      initialElapsed[stationIndex] = 0;
    });

    setTimerStates(initialStates);
    elapsedSecondsRef.current = initialElapsed;
  }, [stationCircuits]);

  // Initialize timer states
  useEffect(() => {
    resetTimers();
  }, [stationCircuits, resetTimers]);

  // Reset timers when set or round changes (skip/back actions)
  useEffect(() => {
    // Check if set number changed (within same round)
    const setNumberChanged = lastSetNumberRef.current !== undefined && 
                           currentSetNumber !== undefined && 
                           lastSetNumberRef.current !== currentSetNumber;
    
    // Check if round changed
    const roundChanged = lastRoundIndexRef.current !== undefined && 
                        currentRoundIndex !== undefined && 
                        lastRoundIndexRef.current !== currentRoundIndex;
    
    // Check if we're transitioning from inactive to active (e.g., REST -> EXERCISE)
    const transitioningToActive = wasInactiveRef.current && isActive;
    
    // Check if state value changed from 'rest' to 'exercise'
    const stateTransitionToExercise = lastStateValueRef.current === 'rest' && stateValue === 'exercise';
    
    if (setNumberChanged || roundChanged || transitioningToActive || stateTransitionToExercise) {
      resetTimers();
    }
    
    lastSetNumberRef.current = currentSetNumber;
    lastRoundIndexRef.current = currentRoundIndex;
    lastStateValueRef.current = stateValue;
    wasInactiveRef.current = !isActive;
  }, [currentSetNumber, currentRoundIndex, isActive, stateValue, resetTimers]);

  // Update timers when main timer ticks
  useEffect(() => {
    if (!stationCircuits || isPaused || !isActive || mainTimerValue === undefined) return;

    // Detect if main timer has ticked (decreased by 1)
    if (lastMainTimerValueRef.current !== undefined && 
        lastMainTimerValueRef.current - mainTimerValue === 1) {
      
      setTimerStates(prevStates => {
        const newStates = { ...prevStates };

        Object.entries(stationCircuits).forEach(([stationIndex, config]) => {
          const currentState = newStates[stationIndex];
          if (!currentState || !currentState.isActive) return;

          // Increment elapsed seconds for this station
          elapsedSecondsRef.current[stationIndex] = (elapsedSecondsRef.current[stationIndex] || 0) + 1;

          let newTimeRemaining = currentState.timeRemaining - 1;
          let newPhase = currentState.phase;
          let newCurrentSet = currentState.currentSet;
          let isActive = currentState.isActive;

          // Handle phase transitions
          if (newTimeRemaining <= 0) {
            if (currentState.phase === 'WORK') {
              // Transition to REST
              newPhase = 'REST';
              newTimeRemaining = config.restDuration;
            } else {
              // REST phase ended
              if (currentState.currentSet < config.sets) {
                // Start next set
                newPhase = 'WORK';
                newTimeRemaining = config.workDuration;
                newCurrentSet = currentState.currentSet + 1;
              } else {
                // All sets completed
                isActive = false;
                newTimeRemaining = 0;
              }
            }
          }

          newStates[stationIndex] = {
            ...currentState,
            phase: newPhase,
            timeRemaining: Math.max(0, newTimeRemaining),
            currentSet: newCurrentSet,
            isActive
          };
        });

        return newStates;
      });
    }

    lastMainTimerValueRef.current = mainTimerValue;
  }, [stationCircuits, isPaused, isActive, mainTimerValue]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer display for a specific station
  const getStationTimerDisplay = (stationIndex: number): { phase: string; time: string; isActive: boolean; currentSet: number; totalSets: number } | null => {
    
    const state = timerStates[stationIndex.toString()];
    
    if (!state) {
      return null;
    }

    const result = {
      phase: state.phase,
      time: formatTime(state.timeRemaining),
      isActive: state.isActive,
      currentSet: state.currentSet,
      totalSets: state.totalSets
    };
    
    return result;
  };

  return {
    timerStates,
    getStationTimerDisplay
  };
}