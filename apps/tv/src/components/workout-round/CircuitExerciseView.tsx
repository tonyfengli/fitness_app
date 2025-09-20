import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, CircuitExercise, RoundData } from './shared';

interface CircuitExerciseViewProps {
  currentRound: RoundData;
  currentExercise: CircuitExercise;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
}

export function CircuitExerciseView({ 
  currentRound, 
  currentExercise,
  currentExerciseIndex,
  timeRemaining,
  isPaused 
}: CircuitExerciseViewProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
      {/* Main Timer - Primary Focus */}
      <Text style={{ 
        fontSize: 180, 
        fontWeight: '900', 
        color: TOKENS.color.accent,
        marginBottom: 40,
        letterSpacing: -2
      }}>
        {formatTime(timeRemaining)}
      </Text>
      
      {/* Exercise Name - Secondary Focus */}
      <Text style={{ 
        fontSize: 48, 
        fontWeight: '700', 
        color: TOKENS.color.text, 
        marginBottom: 12,
        textAlign: 'center'
      }} numberOfLines={1}>
        {currentExercise.exerciseName}
      </Text>
      
      {/* Progress Indicator - Tertiary */}
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '500',
        color: TOKENS.color.muted,
        opacity: 0.7
      }}>
        Exercise {currentExerciseIndex + 1} of {currentRound?.exercises.length}
      </Text>
    </View>
  );
}