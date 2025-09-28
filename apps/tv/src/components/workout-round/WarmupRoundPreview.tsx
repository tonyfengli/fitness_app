import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, RoundData } from './shared';

interface WarmupRoundPreviewProps {
  currentRound: RoundData;
}

export function WarmupRoundPreview({ currentRound }: WarmupRoundPreviewProps) {
  const exerciseCount = currentRound.exercises.length;
  const useColumns = exerciseCount > 4;
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Exercises List */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        paddingTop: 80,
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
                  marginBottom: 2,
                }}>
                  {exercise.exerciseName}
                </Text>
                <Text style={{ 
                  fontSize: 11, 
                  fontWeight: '700',
                  color: TOKENS.color.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}>
                  {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                    ? exercise.equipment.join(', ') 
                    : ''}
                </Text>
              </View>
            </MattePanel>
          ))}
        </View>
      </View>
    </View>
  );
}