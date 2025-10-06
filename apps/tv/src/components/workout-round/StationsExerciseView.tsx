import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsExerciseViewProps {
  currentRound: RoundData;
  currentExercise: CircuitExercise;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
  workDuration?: number;
}

// Team configuration - matches the preview
const TEAMS = [
  { name: 'Team 1', color: '#ef4444' },
  { name: 'Team 2', color: '#3b82f6' },
  { name: 'Team 3', color: '#22c55e' },
  { name: 'Team 4', color: '#f59e0b' },
  { name: 'Team 5', color: '#a855f7' },
  { name: 'Team 6', color: '#14b8a6' },
];

export function StationsExerciseView({ 
  currentRound, 
  currentExercise,
  currentExerciseIndex,
  timeRemaining,
  isPaused,
  workDuration = 45
}: StationsExerciseViewProps) {
  // Use actual number of exercises as stations
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Horizontal Columns Layout - Same as preview */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        paddingTop: 40,
        flexDirection: 'row',
        gap: 2, // Minimal gap for connected feel
      }}>
        {currentRound.exercises.map((exercise, idx) => {
          const stationNumber = idx + 1;
          
          // Calculate which team is at this station
          // Teams rotate clockwise as currentExerciseIndex increases
          const teamIndex = (idx - currentExerciseIndex + activeTeams.length) % activeTeams.length;
          const team = activeTeams[teamIndex];
          
          return (
            <View 
              key={`station-${idx}`} 
              style={{ 
                flex: 1,
                backgroundColor: 'rgba(15,8,3,0.55)', // Much more opaque dark brown overlay
                borderColor: 'rgba(15,8,3,0.65)',     // Much more opaque dark brown border
                borderWidth: 1,
                borderRadius: 0,
                borderTopLeftRadius: stationNumber === 1 ? 16 : 0,
                borderBottomLeftRadius: stationNumber === 1 ? 16 : 0,
                borderTopRightRadius: stationNumber === exerciseCount ? 16 : 0,
                borderBottomRightRadius: stationNumber === exerciseCount ? 16 : 0,
                overflow: 'hidden',
              }}
            >
              {/* Team Color Bar */}
              <View style={{
                height: 6,
                backgroundColor: team.color,
              }} />
              
              {/* Content */}
              <View style={{ 
                flex: 1,
                padding: 20,
                paddingTop: 24,
                position: 'relative',
              }}>
                {/* Team Badge with Station Badge aligned */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {/* Team Badge - Left side */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: team.color,
                      }} />
                      <Text style={{ 
                        color: team.color, 
                        fontWeight: '800',
                        fontSize: 14,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                      }}>
                        {team.name}
                      </Text>
                    </View>
                    
                    {/* Station Badge - Right side, aligned with team */}
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(255,200,150,0.1)',
                      borderColor: 'rgba(255,180,120,0.3)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: '#fff5e6',
                        letterSpacing: 0.2,
                      }}>
                        S{stationNumber}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Exercise Display */}
                <View style={{ flex: 1 }}>
                  <View>
                    <Text style={{ 
                      fontSize: exerciseCount === 1 ? 28 : 18, 
                      fontWeight: exerciseCount === 1 ? '800' : '700',
                      color: '#ffffff', // Clean white text
                      marginBottom: exerciseCount === 1 ? 12 : 6,
                    }}>
                      {exercise.exerciseName}
                    </Text>
                    {exercise.repsPlanned && (
                      <Text style={{ 
                        fontSize: exerciseCount === 1 ? 16 : 14, 
                        fontWeight: '600',
                        color: team.color,
                        letterSpacing: 0.5,
                      }}>
                        {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                      </Text>
                    )}
                    
                    {/* Additional exercises at this station */}
                    {exercise.stationExercises && exercise.stationExercises.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        {exercise.stationExercises.map((stationEx, idx) => (
                          <View key={stationEx.id} style={{ marginTop: idx > 0 ? 8 : 0 }}>
                            <Text style={{ 
                              fontSize: exerciseCount === 1 ? 28 : 18, 
                              fontWeight: exerciseCount === 1 ? '800' : '700',
                              color: '#ffffff', // Warm off-white with cream tint
                              marginBottom: exerciseCount === 1 ? 12 : 6,
                            }}>
                              {stationEx.exerciseName}
                            </Text>
                            {stationEx.repsPlanned && (
                              <Text style={{ 
                                fontSize: exerciseCount === 1 ? 16 : 14, 
                                fontWeight: '600',
                                color: team.color,
                                letterSpacing: 0.5,
                              }}>
                                {stationEx.repsPlanned} {stationEx.repsPlanned === 1 ? 'rep' : 'reps'}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}