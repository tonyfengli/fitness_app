import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsRoundPreviewProps {
  currentRound: RoundData;
  repeatTimes?: number;
}

// Team configuration - supports up to 6 teams
const TEAMS = [
  { name: 'Team 1', color: '#ef4444' },
  { name: 'Team 2', color: '#3b82f6' },
  { name: 'Team 3', color: '#22c55e' },
  { name: 'Team 4', color: '#f59e0b' },
  { name: 'Team 5', color: '#a855f7' },
  { name: 'Team 6', color: '#14b8a6' },
];

export function StationsRoundPreviewColumns({ currentRound, repeatTimes = 1 }: StationsRoundPreviewProps) {
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Header Section */}
      <View style={{ 
        paddingTop: 0,
        paddingBottom: 20,
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

      {/* Horizontal Columns Layout */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        flexDirection: 'row',
        gap: 2, // Minimal gap for connected feel
      }}>
        {currentRound.exercises.map((exercise, idx) => {
          const stationNumber = idx + 1;
          const team = activeTeams[idx % activeTeams.length];
          
          return (
            <View 
              key={exercise.id} 
              style={{ 
                flex: 1,
                backgroundColor: TOKENS.color.cardGlass,
                borderRadius: stationNumber === 1 ? '16 0 0 16' : stationNumber === exerciseCount ? '0 16 16 0' : 0,
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
                paddingTop: 16,
              }}>
                {/* Station Header */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: TOKENS.color.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    marginBottom: 4,
                  }}>
                    Station {stationNumber}
                  </Text>
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
                </View>
                
                {/* Exercises - Vertical List */}
                <View style={{ flex: 1, gap: 16 }}>
                  {/* Show different layouts based on station */}
                  {stationNumber === 1 && (
                    <>
                      <View>
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '700',
                          color: TOKENS.color.text,
                          marginBottom: 6,
                        }}>
                          Kettlebell Swings
                        </Text>
                        <View style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 16,
                          backgroundColor: TOKENS.color.bg,
                          borderWidth: 1,
                          borderColor: TOKENS.color.border + '20',
                        }}>
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: '600',
                            color: TOKENS.color.text + 'CC',
                          }}>
                            20 reps
                          </Text>
                        </View>
                      </View>
                      
                      <View>
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '700',
                          color: TOKENS.color.text,
                          marginBottom: 6,
                        }}>
                          Goblet Squats
                        </Text>
                        <View style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 16,
                          backgroundColor: TOKENS.color.bg,
                          borderWidth: 1,
                          borderColor: TOKENS.color.border + '20',
                        }}>
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: '600',
                            color: TOKENS.color.text + 'CC',
                          }}>
                            15 reps
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                  
                  {stationNumber === 2 && (
                    <>
                      <View>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600',
                          color: TOKENS.color.text,
                          marginBottom: 4,
                        }}>
                          1. Box Jumps
                        </Text>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '500',
                          color: TOKENS.color.text + '99',
                        }}>
                          10 reps
                        </Text>
                      </View>
                      
                      <View>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600',
                          color: TOKENS.color.text,
                          marginBottom: 4,
                        }}>
                          2. Step-Ups
                        </Text>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '500',
                          color: TOKENS.color.text + '99',
                        }}>
                          16 total
                        </Text>
                      </View>
                      
                      <View>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600',
                          color: TOKENS.color.text,
                          marginBottom: 4,
                        }}>
                          3. Jump Squats
                        </Text>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '500',
                          color: TOKENS.color.text + '99',
                        }}>
                          12 reps
                        </Text>
                      </View>
                    </>
                  )}
                  
                  {stationNumber === 3 && (
                    <View style={{ 
                      flex: 1, 
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Text style={{ 
                        fontSize: 24, 
                        fontWeight: '800',
                        color: TOKENS.color.text,
                        marginBottom: 12,
                        textAlign: 'center',
                      }}>
                        Battle Ropes
                      </Text>
                      <View style={{
                        paddingHorizontal: 20,
                        paddingVertical: 8,
                        borderRadius: 24,
                        backgroundColor: team.color + '15',
                        borderWidth: 2,
                        borderColor: team.color + '30',
                      }}>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '700',
                          color: team.color,
                          letterSpacing: 1,
                        }}>
                          45 SECONDS
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {stationNumber > 3 && (
                    <>
                      <View>
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '700',
                          color: TOKENS.color.text,
                          marginBottom: 6,
                        }}>
                          Burpees
                        </Text>
                        <View style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 16,
                          backgroundColor: TOKENS.color.bg,
                          borderWidth: 1,
                          borderColor: TOKENS.color.border + '20',
                        }}>
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: '600',
                            color: TOKENS.color.text + 'CC',
                          }}>
                            12 reps
                          </Text>
                        </View>
                      </View>
                      
                      <View>
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '700',
                          color: TOKENS.color.text,
                          marginBottom: 6,
                        }}>
                          Mountain Climbers
                        </Text>
                        <View style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 16,
                          backgroundColor: TOKENS.color.bg,
                          borderWidth: 1,
                          borderColor: TOKENS.color.border + '20',
                        }}>
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: '600',
                            color: TOKENS.color.text + 'CC',
                          }}>
                            30 sec
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
      
      {/* Repeat Indicator - Bottom Center */}
      {repeatTimes > 1 && (
        <View style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}>
          <View style={{
            paddingHorizontal: 24,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: TOKENS.color.bg,
            borderWidth: 2,
            borderColor: TOKENS.color.accent,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: TOKENS.color.accent,
            }} />
            <Text style={{
              fontSize: 14,
              fontWeight: '700',
              color: TOKENS.color.accent,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              {repeatTimes} Rounds Total
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}