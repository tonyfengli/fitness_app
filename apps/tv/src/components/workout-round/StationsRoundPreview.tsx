import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsRoundPreviewProps {
  currentRound: RoundData;
}

export function StationsRoundPreview({ currentRound }: StationsRoundPreviewProps) {
  // For stations, we'll create a different layout
  // Show exercises as "stations" in a more visual layout
  const exerciseCount = currentRound.exercises.length;
  
  // For now, let's create a simple stations layout
  // We can enhance this with more visual elements later
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Station Layout Title */}
      <View style={{ 
        alignItems: 'center',
        marginBottom: 40,
        paddingTop: 40,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '600',
          color: TOKENS.color.accent2,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}>
          Station Circuit
        </Text>
        <Text style={{
          fontSize: 16,
          fontWeight: '500',
          color: TOKENS.color.muted,
          marginTop: 8,
        }}>
          {exerciseCount} Stations • Move through each station
        </Text>
      </View>

      {/* Stations Grid - Different layout than circuit */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center',
        paddingHorizontal: 40,
      }}>
        <View style={{ 
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 24,
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            // Create a more station-focused card design
            const stationNumber = idx + 1;
            
            return (
              <MattePanel 
                key={exercise.id} 
                style={{ 
                  width: 320,
                  height: 160,
                  padding: 24,
                  justifyContent: 'space-between',
                  borderWidth: 2,
                  borderColor: stationNumber === 1 ? TOKENS.color.accent2 : TOKENS.color.borderGlass,
                }}
              >
                {/* Station Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '700',
                    color: TOKENS.color.accent2,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    Station {stationNumber}
                  </Text>
                  {stationNumber === 1 && (
                    <View style={{
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      backgroundColor: TOKENS.color.accent2,
                      borderRadius: 12,
                    }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: TOKENS.color.bg,
                      }}>
                        START HERE
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Exercise Name */}
                <Text style={{ 
                  fontSize: 24, 
                  fontWeight: '800',
                  color: TOKENS.color.text,
                  lineHeight: 28,
                }} numberOfLines={2}>
                  {exercise.exerciseName}
                </Text>
                
                {/* Equipment */}
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: '600',
                  color: TOKENS.color.muted,
                }}>
                  {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                    ? exercise.equipment.join(', ') 
                    : 'Bodyweight'}
                </Text>
              </MattePanel>
            );
          })}
        </View>
      </View>

      {/* Station Instructions */}
      <View style={{
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: TOKENS.color.muted,
          textAlign: 'center',
        }}>
          Complete each station • Follow the numbered order
        </Text>
      </View>
    </View>
  );
}