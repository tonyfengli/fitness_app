import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, RoundData, CircuitExercise } from './types';

interface SetBreakViewProps {
  timeRemaining: number;
  currentSetNumber: number;
  totalSets: number;
  currentRound: RoundData;
  roundType: string;
}

// Team configuration - matches the preview/rest views
const TEAMS = [
  { name: 'Team 1', color: '#ef4444' },
  { name: 'Team 2', color: '#3b82f6' },
  { name: 'Team 3', color: '#22c55e' },
  { name: 'Team 4', color: '#f59e0b' },
  { name: 'Team 5', color: '#a855f7' },
  { name: 'Team 6', color: '#14b8a6' },
  { name: 'Team 7', color: '#fb923c' },
  { name: 'Team 8', color: '#06b6d4' },
];

export function SetBreakView({ timeRemaining, currentSetNumber, totalSets, currentRound, roundType }: SetBreakViewProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Circuit Round Set Break - Similar to CircuitRestView
  if (roundType === 'circuit_round') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 }}>
        {/* Main Timer */}
        <Text style={{ 
          fontSize: 180, 
          fontWeight: '900', 
          color: TOKENS.color.accent,
          marginBottom: 40,
          letterSpacing: -2
        }}>
          {formatTime(timeRemaining)}
        </Text>
        
        {/* Set Break Label */}
        <Text style={{ 
          fontSize: 48, 
          fontWeight: '700', 
          color: TOKENS.color.text, 
          marginBottom: 12,
          textAlign: 'center'
        }}>
          Set Break
        </Text>
        
        {/* Set Progress */}
        <Text style={{ 
          fontSize: 20, 
          fontWeight: '500',
          color: TOKENS.color.muted,
          opacity: 0.7
        }}>
          Set {currentSetNumber} of {totalSets} complete
        </Text>
      </View>
    );
  }

  // Stations Round Set Break - Original implementation
  // Use actual number of exercises as stations
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Responsive Grid Layout */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        paddingTop: 20,
        flexDirection: 'column',
        gap: 2,
      }}>
        {(() => {
          // Calculate responsive grid layout
          const getGridLayout = (stationCount: number) => {
            if (stationCount <= 4) {
              return { rows: 1, cols: stationCount };
            } else if (stationCount === 5) {
              return { rows: 2, cols: 3 }; // 3 top, 2 bottom
            } else if (stationCount === 6) {
              return { rows: 2, cols: 3 }; // 3-3
            } else if (stationCount === 7) {
              return { rows: 2, cols: 4 }; // 4 top, 3 bottom
            } else if (stationCount === 8) {
              return { rows: 2, cols: 4 }; // 4-4
            }
            return { rows: 2, cols: 4 }; // Default for 8+ stations
          };

          const { rows, cols } = getGridLayout(exerciseCount);
          const isMultiRow = rows > 1;
          
          // Group stations into rows
          const getStationRows = () => {
            if (!isMultiRow) {
              return [currentRound.exercises];
            }
            
            const stationsInFirstRow = exerciseCount === 5 ? 3 : cols;
            const firstRow = currentRound.exercises.slice(0, stationsInFirstRow);
            const secondRow = currentRound.exercises.slice(stationsInFirstRow);
            
            return [firstRow, secondRow];
          };

          const stationRows = getStationRows();
          
          return stationRows.map((row, rowIndex) => (
            <View 
              key={`row-${rowIndex}`}
              style={{ 
                flex: isMultiRow ? 1 : 1,
                flexDirection: 'row',
                gap: 2,
              }}
            >
              {row.map((exercise, colIndex) => {
                const idx = rowIndex === 0 ? colIndex : (exerciseCount === 5 ? 3 : cols) + colIndex;
                const stationNumber = idx + 1;
                
                // Teams reset to original positions (Team 1 at Station 1, etc.)
                const team = activeTeams[idx % activeTeams.length];
                
                // Safety check
                if (!team) {
                  console.error('[SetBreakView] Team calculation error:', {
                    exerciseCount,
                    activeTeams: activeTeams.length,
                    idx
                  });
                  return null;
                }
                
                return (
                  <View 
                    key={`station-${idx}`} 
                    style={{ 
                      flex: 1,
                      backgroundColor: TOKENS.color.cardGlass,
                      borderRadius: 0,
                      // Grid corner radius logic
                      borderTopLeftRadius: (rowIndex === 0 && colIndex === 0) ? 16 : 0,
                      borderTopRightRadius: (rowIndex === 0 && colIndex === row.length - 1) ? 16 : 0,
                      borderBottomLeftRadius: (rowIndex === stationRows.length - 1 && colIndex === 0) ? 16 : 0,
                      borderBottomRightRadius: (rowIndex === stationRows.length - 1 && colIndex === row.length - 1) ? 16 : 0,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Team Color Bar - Cyan theme for set break */}
                    <View style={{
                      height: 6,
                      backgroundColor: team.color,
                    }} />
                    
                    {/* Content */}
                    <View style={{ 
                      flex: 1,
                      padding: 20,
                      paddingTop: 24,
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
                            backgroundColor: 'rgba(255, 255, 255, 0.20)',
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                            borderWidth: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{
                              fontSize: 14,
                              fontWeight: '800',
                              color: '#ffffff',
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
                            color: TOKENS.color.text,
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
                                    color: TOKENS.color.text,
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
          ));
        })()}
      </View>
    </View>
  );
}