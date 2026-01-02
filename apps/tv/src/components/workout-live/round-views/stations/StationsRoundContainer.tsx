import React from 'react';
import { View, Text } from 'react-native';
import {
  StationsRoundPreview,
  StationsExerciseView,
  StationsRestView
} from '../../../workout-round';
import { RoundData, CircuitExercise } from '../../types';
import type { CircuitConfig } from '@acme/db';
import { useStationCircuitTimers } from '../../../../hooks/useStationCircuitTimers';

interface StationsRoundContainerProps {
  state: any; // Will be typed more specifically later
  currentRound: RoundData;
  currentRoundIndex: number;
  totalRounds: number;
  currentExerciseIndex: number;
  roundDuration: number;
  repeatTimes: number;
  restDuration: number;
  workDuration: number;
  circuitConfig: CircuitConfig;
}

export function StationsRoundContainer({
  state,
  currentRound,
  currentRoundIndex,
  totalRounds,
  currentExerciseIndex,
  roundDuration,
  repeatTimes,
  restDuration,
  workDuration,
  circuitConfig
}: StationsRoundContainerProps) {
  console.log('[StationsRoundContainer] Component render');
  console.log('[StationsRoundContainer] currentRoundIndex:', currentRoundIndex);
  console.log('[StationsRoundContainer] currentExerciseIndex:', currentExerciseIndex);
  console.log('[StationsRoundContainer] state.value:', state.value);
  console.log('[StationsRoundContainer] circuitConfig available:', !!circuitConfig);
  
  // Get station circuits configuration for current round
  const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
    rt => rt.roundNumber === currentRoundIndex + 1 // roundNumber is 1-based
  );
  console.log('[StationsRoundContainer] roundTemplate found:', !!roundTemplate);
  console.log('[StationsRoundContainer] roundTemplate:', roundTemplate);
  
  const stationCircuits = roundTemplate?.template?.stationCircuits;
  console.log('[StationsRoundContainer] stationCircuits:', stationCircuits);

  // Use the station circuit timers hook
  const { getStationTimerDisplay } = useStationCircuitTimers({
    stationCircuits,
    isPaused: state.context.isPaused,
    isActive: state.value === 'exercise', // Only active during exercise phase
    currentStationIndex: currentExerciseIndex,
    mainTimerValue: state.context.timeRemaining, // Pass main timer value to sync
    currentSetNumber: state.context.currentSetNumber, // Pass set number to detect resets
    currentRoundIndex: currentRoundIndex, // Pass round index to detect round changes
    stateValue: state.value // Pass state value to detect state transitions
  });
  if (state.value === 'roundPreview') {
    return (
      <StationsRoundPreview 
        currentRound={currentRound}
        currentRoundIndex={currentRoundIndex}
        totalRounds={totalRounds}
        roundDuration={roundDuration}
        repeatTimes={repeatTimes}
        timeRemaining={state.context.timeRemaining}
        isTimerActive={state.context.currentRoundIndex > 0}
      />
    );
  }

  if (state.value === 'exercise') {
    console.log('[StationsRoundContainer] Exercise state:', {
      currentExerciseIndex,
      totalExercises: currentRound.exercises.length,
      currentExercise: currentRound.exercises[currentExerciseIndex],
      allExercises: currentRound.exercises.map(ex => ({
        id: ex.id,
        name: ex.exercise?.name || 'Unknown',
        orderIndex: ex.orderIndex,
        stationIndex: ex.stationIndex
      })),
      stationCircuits: stationCircuits,
      hasGetStationTimerDisplay: !!getStationTimerDisplay,
    });
    
    return (
      <>
        <StationsExerciseView 
          currentRound={currentRound}
          currentExercise={currentRound.exercises[currentExerciseIndex]}
          currentExerciseIndex={currentExerciseIndex}
          timeRemaining={state.context.timeRemaining}
          isPaused={state.context.isPaused}
          workDuration={workDuration}
          getStationTimerDisplay={getStationTimerDisplay}
          stationCircuits={stationCircuits}
        />
      </>
    );
  }

  if (state.value === 'rest') {
    return (
      <StationsRestView 
        currentRound={currentRound}
        currentExerciseIndex={currentExerciseIndex}
        timeRemaining={state.context.timeRemaining}
        isPaused={state.context.isPaused}
        isSetBreak={currentExerciseIndex === currentRound.exercises.length - 1 && state.context.currentSetNumber < repeatTimes}
        restDuration={restDuration}
        workDuration={workDuration}
      />
    );
  }

  return null;
}