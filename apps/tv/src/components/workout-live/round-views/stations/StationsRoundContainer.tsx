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
        
        {/* Repeat Progress Indicator */}
        {repeatTimes > 1 && (
          <View style={{
            position: 'absolute',
            top: -8,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}>
            <View style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              gap: 5,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,179,102,0.15)',
              borderColor: '#ffb366',
              borderWidth: 1,
              borderRadius: 999,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#ffb366',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
                Set
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '800',
                color: '#ffb366',
                marginLeft: 2,
              }}>
                {state.context.currentSetNumber}
              </Text>
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#ffb366',
                marginHorizontal: 3,
              }}>
                of
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '800',
                color: '#ffb366',
              }}>
                {repeatTimes}
              </Text>
            </View>
          </View>
        )}
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