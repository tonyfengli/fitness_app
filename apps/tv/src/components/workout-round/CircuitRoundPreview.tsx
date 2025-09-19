import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface CircuitRoundPreviewProps {
  currentRound: RoundData;
}

export function CircuitRoundPreview({ currentRound }: CircuitRoundPreviewProps) {
  // Calculate grid layout based on number of exercises
  const exerciseCount = currentRound.exercises.length;
  let columns = 4; // Default to 4 columns
  
  if (exerciseCount <= 2) {
    columns = exerciseCount; // 1-2 exercises: show in single row
  } else if (exerciseCount === 3) {
    columns = 2; // 3 exercises: 2 on top, 1 on bottom
  } else if (exerciseCount === 6) {
    columns = 3; // 6 exercises: 3x2 grid
  } else if (exerciseCount === 5) {
    columns = 3; // 5 exercises: 3 on top, 2 on bottom
  } else if (exerciseCount === 7) {
    columns = 4; // 7 exercises: 4 on top, 3 on bottom
  } else if (exerciseCount === 8) {
    columns = 4; // 8 exercises: 4x2 grid
  }
  
  // Calculate rows to determine if we need to scale down
  const rows = Math.ceil(exerciseCount / columns);
  const needsScaling = rows > 1; // Scale for ANY multi-row layout
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Exercise Grid */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center',
        paddingTop: needsScaling ? 60 : 0, // Add padding when more than 1 row
      }}>
        <View style={{ 
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginHorizontal: -10,
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            // Fixed width for cards - scale down by 5% if more than 1 row
            const baseCardWidth = 380;
            const cardWidth = needsScaling ? baseCardWidth * 0.95 : baseCardWidth;
            
            // Adjust vertical padding when scaled
            const verticalPadding = needsScaling ? 8 : 10;
            
            return (
              <View key={exercise.id} style={{ 
                width: cardWidth,
                paddingHorizontal: 10,
                paddingVertical: verticalPadding,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                {/* Number outside the card */}
                <Text style={{ 
                  fontSize: needsScaling ? 46 : 48, 
                  fontWeight: '900',
                  color: TOKENS.color.muted,
                  marginRight: needsScaling ? 14 : 16,
                  opacity: 0.3,
                  minWidth: needsScaling ? 57 : 60,
                  textAlign: 'right'
                }}>
                  {idx + 1}
                </Text>
                
                <MattePanel style={{ 
                  flex: 1,
                  paddingHorizontal: needsScaling ? 22 : 24,
                  paddingVertical: needsScaling ? 18 : 20,
                  height: needsScaling ? 114 : 120,
                  justifyContent: 'center',
                }}>
                  {/* Exercise Name */}
                  <Text style={{ 
                    fontSize: needsScaling ? 22 : 24, 
                    fontWeight: '900',
                    color: TOKENS.color.text,
                    lineHeight: needsScaling ? 26 : 28,
                    marginBottom: 4,
                    minHeight: needsScaling ? 26 : 28, // Ensures at least one line height
                  }} numberOfLines={2}>
                    {exercise.exerciseName}
                  </Text>
                  
                  {/* Equipment or default text */}
                  <Text style={{ 
                    fontSize: needsScaling ? 15 : 16, 
                    fontWeight: '600',
                    color: '#9ca3af',
                  }}>
                    {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                      ? exercise.equipment.join(', ') 
                      : 'bodyweight'}
                  </Text>
                </MattePanel>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}