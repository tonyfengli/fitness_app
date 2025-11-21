import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';
import { LightingDotWithTimestamp } from '../LightingDotWithTimestamp';
import { useLightingPreview } from '../../hooks/useLightingPreview';
import { useNavigation } from '../../App';

interface StationsRoundPreviewProps {
  currentRound: RoundData;
  repeatTimes?: number;
  workDuration?: number;
  timeRemaining?: number;
  isTimerActive?: boolean;
  roundNumber?: number;
}

// Team configuration - supports up to 6 teams
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

export function StationsRoundPreview({ currentRound, repeatTimes = 1, workDuration = 45, timeRemaining = 0, isTimerActive = false, roundNumber }: StationsRoundPreviewProps) {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Extract round number from round name if not provided
  const extractedRoundNumber = roundNumber || (() => {
    const match = currentRound.roundName?.match(/Round (\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  })();
  
  // Initialize lighting preview for this round
  useLightingPreview({
    sessionId: sessionId || '',
    roundNumber: extractedRoundNumber,
    enabled: !!sessionId
  });
  // Use actual number of exercises as stations
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
        {/* Timer or Stations Text */}
        {isTimerActive && timeRemaining > 0 ? (
          <Text style={{
            fontSize: 26,
            fontWeight: '800',
            color: TOKENS.color.muted,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 8,
          }}>
            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </Text>
        ) : null}
      </View>

      {/* Responsive Grid Layout */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
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
                const team = activeTeams[idx % activeTeams.length];
                
                return (
                  <View 
                    key={exercise.id} 
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
      
      {/* Repeat Indicator - Bottom Right */}
      {repeatTimes > 1 && (
        <View style={{
          position: 'absolute',
          bottom: -30, // Moved up by 10px (from -40 to -30)
          right: 360,  // Shifted right by another 50px (from 410 to 360)
        }}>
          <MattePanel style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 6,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: TOKENS.color.card,
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

      {/* Lighting Status Dot with Timestamp */}
      <LightingDotWithTimestamp position="absolute" roundNumber={extractedRoundNumber} />
    </View>
  );
}