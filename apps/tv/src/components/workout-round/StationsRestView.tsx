import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsRestViewProps {
  currentRound: RoundData;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
}

// Team configuration - matches the preview
const TEAMS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Orange', color: '#f59e0b' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Teal', color: '#14b8a6' },
];

export function StationsRestView({ 
  currentRound, 
  currentExerciseIndex,
  timeRemaining,
  isPaused 
}: StationsRestViewProps) {
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
  
  // Next exercise index (what we're transitioning to)
  const nextExerciseIndex = currentExerciseIndex + 1;
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Stations Grid - Exact same layout as exercise view */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 28,
        paddingTop: 60,
      }}>
        <View style={{ 
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            const stationNumber = idx + 1;
            
            // Current team (what's leaving this station)
            const currentTeamIndex = (idx - currentExerciseIndex + activeTeams.length) % activeTeams.length;
            const currentTeam = activeTeams[currentTeamIndex];
            
            // Next team (what's coming to this station)
            const nextTeamIndex = (idx - nextExerciseIndex + activeTeams.length) % activeTeams.length;
            const nextTeam = activeTeams[nextTeamIndex];
            
            return (
              <MattePanel 
                key={exercise.id} 
                style={{ 
                  width: cardWidth,
                  padding: 16,
                  gap: 10,
                }}
              >
                {/* Exercise Name */}
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '900',
                  color: TOKENS.color.text,
                  marginBottom: 4,
                }}>
                  {exercise.exerciseName}
                </Text>
                
                {/* Station Number */}
                <Text style={{ 
                  fontSize: 12, 
                  fontWeight: '700',
                  color: TOKENS.color.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}>
                  STATION {stationNumber}
                </Text>
                
                {/* Team Transition */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  gap: 10,
                }}>
                  {/* Old Team - Crossed Out */}
                  <View style={{ 
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: `${currentTeam.color}08`,
                    borderWidth: 1,
                    borderColor: `${currentTeam.color}30`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    opacity: 0.4,
                  }}>
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      backgroundColor: currentTeam.color,
                      opacity: 0.3,
                    }} />
                    <Text style={{ 
                      color: currentTeam.color, 
                      fontWeight: '800',
                      fontSize: 14,
                      letterSpacing: 0.3,
                      textDecorationLine: 'line-through',
                      opacity: 0.6,
                    }}>
                      {currentTeam.name} Team
                    </Text>
                  </View>
                  
                  {/* Arrow */}
                  <Text style={{ 
                    fontSize: 16, 
                    color: TOKENS.color.muted,
                    opacity: 0.6,
                  }}>
                    →
                  </Text>
                  
                  {/* New Team */}
                  <View style={{ 
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: `${nextTeam.color}15`,
                    borderWidth: 1,
                    borderColor: nextTeam.color,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      backgroundColor: nextTeam.color,
                    }} />
                    <Text style={{ 
                      color: nextTeam.color, 
                      fontWeight: '800',
                      fontSize: 14,
                      letterSpacing: 0.3,
                    }}>
                      {nextTeam.name} Team
                    </Text>
                  </View>
                </View>
                
              </MattePanel>
            );
          })}
        </View>
      </View>
    </View>
  );
}