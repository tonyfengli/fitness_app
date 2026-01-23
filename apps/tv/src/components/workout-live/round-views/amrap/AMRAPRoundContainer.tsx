import React from 'react';
import {
  AMRAPRoundPreview,
  AMRAPExerciseView
} from '../../../workout-round';
import { RoundData } from '../../types';

interface AMRAPRoundContainerProps {
  state: any; // Will be typed more specifically later
  currentRound: RoundData;
  currentRoundIndex: number;
  totalRounds: number;
  totalDuration: number;
  displayState?: string; // Visual state override (prevents flash during countdown)
}

export function AMRAPRoundContainer({
  state,
  currentRound,
  currentRoundIndex,
  totalRounds,
  totalDuration,
  displayState,
}: AMRAPRoundContainerProps) {
  // Use displayState for rendering if provided, otherwise fall back to state.value
  const renderState = displayState ?? state.value;

  if (renderState === 'roundPreview') {
    return (
      <AMRAPRoundPreview 
        currentRound={currentRound}
        timeRemaining={state.context.timeRemaining}
        isTimerActive={state.context.currentRoundIndex > 0}
      />
    );
  }

  if (renderState === 'exercise') {
    return (
      <AMRAPExerciseView 
        currentRound={currentRound}
        timeRemaining={state.context.timeRemaining}
        isPaused={state.context.isPaused}
        totalDuration={totalDuration}
      />
    );
  }

  // AMRAP doesn't have a separate rest state
  return null;
}