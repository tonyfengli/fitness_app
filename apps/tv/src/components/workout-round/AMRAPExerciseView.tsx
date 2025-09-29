import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface AMRAPExerciseViewProps {
  currentRound: RoundData;
  currentExercise: CircuitExercise;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
}

export function AMRAPExerciseView({ 
  currentRound, 
  currentExercise,
  currentExerciseIndex,
  timeRemaining,
  isPaused 
}: AMRAPExerciseViewProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const exerciseCount = currentRound.exercises.length;
  const useColumns = exerciseCount > 4;
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Exercises List - Same layout as preview */}
      <View style={{ 
        flex: 1,
        paddingHorizontal: 48,
        paddingTop: 55,
      }}>
        <View style={{ 
          flexDirection: useColumns ? 'row' : 'column',
          flexWrap: useColumns ? 'wrap' : 'nowrap',
          gap: 8,
          justifyContent: useColumns ? 'space-between' : 'flex-start',
        }}>
          {currentRound.exercises.map((exercise, idx) => (
            <MattePanel 
              key={exercise.id} 
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 10,
                gap: 12,
                width: useColumns ? '48%' : '100%',
              }}
            >
              {/* Exercise Number */}
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: TOKENS.color.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '900',
                  color: TOKENS.color.bg,
                }}>
                  {idx + 1}
                </Text>
              </View>
              
              {/* Exercise Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '700',
                  color: TOKENS.color.text,
                }}>
                  {exercise.exerciseName}
                </Text>
                {exercise.repsPlanned && (
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: TOKENS.color.muted,
                    marginTop: 2,
                  }}>
                    {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                  </Text>
                )}
              </View>
            </MattePanel>
          ))}
        </View>
        
        {/* Loop Connection - Same as preview */}
        <View style={{ 
          marginTop: 12,
          paddingHorizontal: 0,
        }}>
          <View style={{
            height: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              flex: 1,
              height: 2,
              backgroundColor: TOKENS.color.accent + '20',
              marginRight: -1,
            }} />
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: TOKENS.color.accent + '30',
              backgroundColor: TOKENS.color.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                fontSize: 20,
                color: TOKENS.color.accent,
              }}>
                ↻
              </Text>
            </View>
            <View style={{
              flex: 1,
              height: 2,
              backgroundColor: TOKENS.color.accent + '20',
              marginLeft: -1,
            }} />
          </View>
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: TOKENS.color.muted,
            textAlign: 'center',
            marginTop: 4,
            opacity: 0.7,
          }}>
            LOOP BACK TO #1
          </Text>
        </View>
      </View>
    </View>
  );
}