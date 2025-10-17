import React from 'react';
import { View, Text } from 'react-native';
import {
  CircuitRoundPreview,
  CircuitExerciseView
} from '../../../workout-round';
import { TimerDisplay } from '../../TimerDisplay';
import { TOKENS, RoundData, CircuitExercise } from '../../types';

interface CircuitRoundContainerProps {
  state: any; // Will be typed more specifically later
  currentRound: RoundData;
  currentRoundIndex: number;
  totalRounds: number;
  currentExercise?: CircuitExercise;
  currentExerciseIndex: number;
  roundDuration: number;
  restDuration: number;
  repeatTimes: number;
}

export function CircuitRoundContainer({
  state,
  currentRound,
  currentRoundIndex,
  totalRounds,
  currentExercise,
  currentExerciseIndex,
  roundDuration,
  restDuration,
  repeatTimes
}: CircuitRoundContainerProps) {
  if (state.value === 'roundPreview') {
    return (
      <CircuitRoundPreview 
        currentRound={currentRound}
        currentRoundIndex={currentRoundIndex}
        totalRounds={totalRounds}
        roundDuration={roundDuration}
      />
    );
  }

  if (state.value === 'exercise' && currentExercise) {
    return (
      <>
        <CircuitExerciseView 
          currentRound={currentRound}
          currentExercise={currentExercise}
          currentExerciseIndex={currentExerciseIndex}
          timeRemaining={state.context.timeRemaining}
          isPaused={state.context.isPaused}
          restDuration={restDuration}
        />
        
        {/* Repeat Progress Indicator */}
        {repeatTimes > 1 && (
          <View style={{
            position: 'absolute',
            top: -53,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}>
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 6,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: TOKENS.color.accent + '15',
              borderColor: TOKENS.color.accent,
              borderWidth: 1,
              borderRadius: 999,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: TOKENS.color.accent,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
                Set
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: TOKENS.color.accent,
                marginLeft: 2,
              }}>
                {state.context.currentSetNumber}
              </Text>
              <Text style={{
                fontSize: 13,
                fontWeight: '500',
                color: TOKENS.color.accent,
                marginHorizontal: 3,
              }}>
                of
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: TOKENS.color.accent,
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 }}>
        {/* Main Timer */}
        <TimerDisplay 
          timeRemaining={state.context.timeRemaining}
          size="xlarge"
          color={TOKENS.color.accent}
          style={{ marginBottom: 40 }}
        />
        
        {/* Rest Label */}
        <Text style={{ 
          fontSize: 48, 
          fontWeight: '700', 
          color: TOKENS.color.text, 
          marginBottom: 12,
          textAlign: 'center'
        }}>
          Rest
        </Text>
        
        {/* Next Exercise */}
        {(() => {
          const isLastExercise = currentExerciseIndex === currentRound.exercises.length - 1;
          const isSetBreak = isLastExercise && state.context.currentSetNumber < repeatTimes;
          
          if (!isSetBreak) {
            return (
              <Text style={{ 
                fontSize: 20, 
                fontWeight: '500',
                color: TOKENS.color.muted,
                opacity: 0.7
              }}>
                Next up: {currentRound?.exercises[currentExerciseIndex + 1]?.exerciseName || 'Complete'}
              </Text>
            );
          }
          return null;
        })()}
        
        {/* Repeat Progress Indicator for Rest */}
        {repeatTimes > 1 && (
          <View style={{
            position: 'absolute',
            top: -53,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}>
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              gap: 6,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: TOKENS.color.accent + '15',
              borderColor: TOKENS.color.accent,
              borderWidth: 1,
              borderRadius: 999,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: TOKENS.color.accent,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
                Set
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: TOKENS.color.accent,
                marginLeft: 2,
              }}>
                {state.context.currentSetNumber}
              </Text>
              <Text style={{
                fontSize: 13,
                fontWeight: '500',
                color: TOKENS.color.accent,
                marginHorizontal: 3,
              }}>
                of
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '800',
                color: TOKENS.color.accent,
              }}>
                {repeatTimes}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return null;
}