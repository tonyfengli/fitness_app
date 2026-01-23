import React from 'react';
import { View } from 'react-native';
import { 
  CircuitRoundContainer, 
  StationsRoundContainer, 
  AMRAPRoundContainer 
} from './round-views';
import { SetBreakView } from './SetBreakView';
import { RoundData, CircuitExercise } from './types';
import type { CircuitConfig } from '@acme/db';

interface WorkoutContentProps {
  state: any; // Will be typed more specifically later
  circuitConfig: CircuitConfig;
  getRoundTiming: (roundIndex: number) => any;
  visualState?: string; // Override for visual rendering (prevents flash during countdown)
}

export function WorkoutContent({ state, circuitConfig, getRoundTiming, visualState }: WorkoutContentProps) {
  // Use visualState for rendering decisions if provided, otherwise fall back to state.value
  const displayState = visualState ?? state.value;
  // Get current round data
  const currentRound: RoundData | undefined = state.context.rounds[state.context.currentRoundIndex];
  const currentExercise: CircuitExercise | undefined = currentRound?.exercises[state.context.currentExerciseIndex];
  
  // Get round timing info
  const currentRoundTiming = getRoundTiming(state.context.currentRoundIndex);
  const currentRoundType = currentRoundTiming.roundType;
  const currentRepeatTimes = currentRoundTiming.repeatTimes || 1;

  // Handle set break state (common across round types)
  // Use displayState to prevent flash during countdown
  if (displayState === 'setBreak' && currentRound) {
    return (
      <SetBreakView
        timeRemaining={state.context.timeRemaining}
        currentSetNumber={state.context.currentSetNumber}
        totalSets={currentRepeatTimes}
        currentRound={currentRound}
        roundType={currentRoundType}
      />
    );
  }

  // Route to appropriate round container
  return (
    <View style={{ flex: 1 }}>
      {currentRound && (
        <>
          {currentRoundType === 'circuit_round' && (
            <CircuitRoundContainer
              state={state}
              currentRound={currentRound}
              currentRoundIndex={state.context.currentRoundIndex}
              totalRounds={state.context.rounds.length}
              currentExercise={currentExercise}
              currentExerciseIndex={state.context.currentExerciseIndex}
              roundDuration={currentRoundTiming.workDuration * currentRound.exercises.length}
              restDuration={currentRoundTiming.restDuration}
              repeatTimes={currentRepeatTimes}
              circuitConfig={circuitConfig}
              displayState={displayState}
            />
          )}

          {currentRoundType === 'stations_round' && (
            <StationsRoundContainer
                state={state}
                currentRound={currentRound}
                currentRoundIndex={state.context.currentRoundIndex}
                totalRounds={state.context.rounds.length}
                currentExerciseIndex={state.context.currentExerciseIndex}
                roundDuration={currentRoundTiming.workDuration}
                repeatTimes={currentRepeatTimes}
                restDuration={currentRoundTiming.restDuration}
                workDuration={currentRoundTiming.workDuration}
                circuitConfig={circuitConfig}
                displayState={displayState}
              />
          )}

          {currentRoundType === 'amrap_round' && (
            <AMRAPRoundContainer
              state={state}
              currentRound={currentRound}
              currentRoundIndex={state.context.currentRoundIndex}
              totalRounds={state.context.rounds.length}
              totalDuration={currentRoundTiming.workDuration}
              displayState={displayState}
            />
          )}
        </>
      )}
    </View>
  );
}