import React from 'react';
import { View, Text } from 'react-native';
import {
  StationsRoundPreview,
  StationsExerciseView,
  StationsRestView
} from '../../../workout-round';
import { RoundData, CircuitExercise } from '../../types';

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
  workDuration
}: StationsRoundContainerProps) {
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
    return (
      <>
        <StationsExerciseView 
          currentRound={currentRound}
          currentExerciseIndex={currentExerciseIndex}
          timeRemaining={state.context.timeRemaining}
          isPaused={state.context.isPaused}
          workDuration={workDuration}
          currentSetNumber={state.context.currentSetNumber}
          totalSets={repeatTimes}
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