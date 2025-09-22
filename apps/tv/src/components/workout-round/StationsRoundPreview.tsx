import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsRoundPreviewProps {
  currentRound: RoundData;
  repeatTimes?: number;
}

// Team configuration - supports up to 6 teams
const TEAMS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Orange', color: '#f59e0b' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Teal', color: '#14b8a6' },
];

export function StationsRoundPreview({ currentRound, repeatTimes = 1 }: StationsRoundPreviewProps) {
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  // Calculate grid columns based on number of stations
  const getGridColumns = () => {
    if (exerciseCount <= 3) return exerciseCount;
    if (exerciseCount <= 6) return 3;
    if (exerciseCount <= 8) return 4;
    return 5;
  };
  
  const columns = getGridColumns();
  const cardWidth = columns <= 3 ? 380 : columns === 4 ? 300 : 260;
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Header Section */}
      <View style={{ 
        paddingTop: 0,
        paddingBottom: 30,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '800',
          color: TOKENS.color.muted,
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 8,
        }}>
          ROTATE THROUGH {exerciseCount} STATIONS
        </Text>
      </View>

      {/* Stations Grid */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 28,
      }}>
        <View style={{ 
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            const stationNumber = idx + 1;
            const team = activeTeams[idx % activeTeams.length];
            
            return (
              <MattePanel 
                key={exercise.id} 
                style={{ 
                  width: cardWidth,
                  padding: 16,
                  gap: 10,
                }}
              >
                {/* Station Title */}
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '900',
                  color: TOKENS.color.text,
                  marginBottom: 4,
                }}>
                  Station {stationNumber} — {exercise.exerciseName}
                </Text>
                
                {/* Equipment */}
                <Text style={{ 
                  fontSize: 12, 
                  fontWeight: '700',
                  color: TOKENS.color.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}>
                  {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                    ? exercise.equipment.join(', ') 
                    : 'bodyweight'}
                </Text>
                
                {/* Team Badge */}
                <View style={{ 
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
                  backgroundColor: `${team.color}15`,
                  borderWidth: 1,
                  borderColor: team.color,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <View style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: team.color,
                  }} />
                  <Text style={{ 
                    color: team.color, 
                    fontWeight: '800',
                    fontSize: 14,
                    letterSpacing: 0.3,
                  }}>
                    {team.name} Team
                  </Text>
                </View>
                
              </MattePanel>
            );
          })}
        </View>
      </View>
      
      {/* Repeat Indicator - Bottom Right */}
      {repeatTimes > 1 && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          right: 48,
        }}>
          <MattePanel style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 6,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${TOKENS.color.cardGlass}`,
            borderColor: TOKENS.color.accent + '30',
            borderWidth: 1,
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '700',
              color: TOKENS.color.muted,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}>
              Repeat
            </Text>
            <Text style={{
              fontSize: 22,
              fontWeight: '800',
              color: TOKENS.color.accent,
            }}>
              {repeatTimes}×
            </Text>
          </MattePanel>
        </View>
      )}

    </View>
  );
}