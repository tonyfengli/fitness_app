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
  getStationTimerDisplay?: (stationIndex: number) => { phase: string; time: string; isActive: boolean } | null;
  stationCircuits?: Record<string, any>;
}

// Team configuration - supports up to 12 teams
const TEAMS = [
  { name: 'Team 1', color: '#ef4444' },
  { name: 'Team 2', color: '#3b82f6' },
  { name: 'Team 3', color: '#22c55e' },
  { name: 'Team 4', color: '#f59e0b' },
  { name: 'Team 5', color: '#a855f7' },
  { name: 'Team 6', color: '#14b8a6' },
  { name: 'Team 7', color: '#fb923c' },
  { name: 'Team 8', color: '#06b6d4' },
  { name: 'Team 9', color: '#ec4899' },
  { name: 'Team 10', color: '#84cc16' },
  { name: 'Team 11', color: '#6366f1' },
  { name: 'Team 12', color: '#f97316' },
];

export function StationsExerciseView({ 
  currentRound, 
  currentExercise,
  currentExerciseIndex,
  timeRemaining,
  isPaused,
  workDuration = 45,
  getStationTimerDisplay,
  stationCircuits
}: StationsExerciseViewProps) {
  
  // Use actual number of exercises as stations
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  // Calculate dynamic positioning for timer based on current station
  // Account for container padding (24px on each side) in the flex layout
  // Each station occupies equal width within the padded container
  const containerPadding = 24;
  const contentWidthPercent = 100 - ((containerPadding * 2) / 1920 * 100); // Assuming TV width ~1920px
  const paddingPercent = (containerPadding / 1920) * 100;
  
  // Position timer at center of current station within the content area
  const stationCenterPercent = paddingPercent + (((currentExerciseIndex + 0.5) / exerciseCount) * contentWidthPercent);
  
  // Get all station timers (not just current)
  const getStationCircuitTimers = () => {
    
    if (!stationCircuits || !getStationTimerDisplay) {
      return {};
    }
    
    const timers: Record<string, any> = {};
    Object.keys(stationCircuits).forEach(stationIndex => {
      const stationIdx = parseInt(stationIndex);
      
      // Safety check: only process stations that actually exist
      if (stationIdx >= exerciseCount) {
        return;
      }
      
      const timer = getStationTimerDisplay(stationIdx);
      if (timer) {
        timers[stationIndex] = timer;
      }
    });
    return timers;
  };
  
  const allStationTimers = getStationCircuitTimers();
  
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
  
  return (
    <View style={{ flex: 1, width: '100%', position: 'relative' }}>
      {/* Floating Circuit Timers - Show for ALL stations with circuit config */}
      {Object.entries(allStationTimers).map(([stationIndex, timer]) => {
        const stationIdx = parseInt(stationIndex);
        
        // Calculate grid position for timer
        let timerPosition;
        if (isMultiRow) {
          const stationsInFirstRow = exerciseCount === 5 ? 3 : cols;
          const isInFirstRow = stationIdx < stationsInFirstRow;
          const positionInRow = isInFirstRow ? stationIdx : stationIdx - stationsInFirstRow;
          const stationsInCurrentRow = isInFirstRow ? stationsInFirstRow : exerciseCount - stationsInFirstRow;
          
          timerPosition = paddingPercent + (((positionInRow + 0.5) / stationsInCurrentRow) * contentWidthPercent);
        } else {
          timerPosition = paddingPercent + (((stationIdx + 0.5) / exerciseCount) * contentWidthPercent);
        }
        
        const isCurrentStation = stationIdx === currentExerciseIndex;
        
        // Calculate which row this station is in for bottom positioning
        const stationsInFirstRow = exerciseCount === 5 ? 3 : cols;
        const isInFirstRow = isMultiRow ? stationIdx < stationsInFirstRow : true;
        const timerBottom = isMultiRow ? (isInFirstRow ? '52%' : 20) : 20;
        
        
        return (
          <View 
            key={`circuit-timer-${stationIndex}`}
            style={{
              position: 'absolute',
              bottom: timerBottom,
              left: `${timerPosition}%`,
              transform: [{ translateX: -50 }],
              zIndex: isCurrentStation ? 25 : 20,
              paddingHorizontal: 15,
              paddingVertical: 4,
              backgroundColor: 'rgba(0,0,0,0.9)',
              borderColor: timer.phase === 'WORK' ? '#f59e0b' : '#5de1ff',
              borderWidth: 1,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              elevation: isCurrentStation ? 10 : 8,
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: isCurrentStation ? 16 : 12,
              shadowOffset: { width: 0, height: 4 },
              opacity: timer.isActive ? 1 : 0.6,
            }}>
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: timer.phase === 'WORK' ? '#f59e0b' : '#5de1ff',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              {timer.phase}
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: '900',
              color: '#ffffff',
              letterSpacing: 0.2,
              fontVariant: ['tabular-nums'],
            }}>
              {timer.time}
            </Text>
            
            {/* Elegant set progress indicator */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              marginLeft: 2,
            }}>
              <View style={{
                width: 1,
                height: 12,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }} />
              <View style={{
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}>
                {timer.totalSets && (() => {
                  const totalSets = timer.totalSets;
                  const cols = Math.ceil(totalSets / 2);
                  const topRow = [];
                  const bottomRow = [];
                  
                  for (let col = 0; col < cols; col++) {
                    // Top row dot (set index: col * 2)
                    const topSetIndex = col * 2;
                    if (topSetIndex < totalSets) {
                      topRow.push(
                        <View
                          key={`top-${col}`}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 4,
                            backgroundColor: topSetIndex < timer.currentSet 
                              ? (timer.phase === 'WORK' ? '#f59e0b' : '#5de1ff')
                              : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      );
                    }
                    
                    // Bottom row dot (set index: col * 2 + 1)
                    const bottomSetIndex = col * 2 + 1;
                    if (bottomSetIndex < totalSets) {
                      bottomRow.push(
                        <View
                          key={`bottom-${col}`}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 4,
                            backgroundColor: bottomSetIndex < timer.currentSet 
                              ? (timer.phase === 'WORK' ? '#f59e0b' : '#5de1ff')
                              : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      );
                    }
                  }
                  
                  return (
                    <>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {topRow}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {bottomRow}
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
          </View>
        );
      })}

      {/* Responsive Grid Layout */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 24,
        paddingTop: 0,
        flexDirection: 'column',
        gap: 2,
      }}>
        {stationRows.map((row, rowIndex) => (
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
          
          // Calculate which team is at this station
          // Teams rotate clockwise as currentExerciseIndex increases
          // Use double modulo to handle negative values correctly
          const teamIndex = ((idx - currentExerciseIndex) % activeTeams.length + activeTeams.length) % activeTeams.length;
          const team = activeTeams[teamIndex];
          
          if (!team) {
          }
          
          return (
            <View 
              key={`station-${idx}`} 
              style={{ 
                flex: 1,
                backgroundColor: 'rgba(15,8,3,0.55)', // Much more opaque dark brown overlay
                borderColor: 'rgba(15,8,3,0.65)',     // Much more opaque dark brown border
                borderWidth: 1,
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
                paddingTop: isMultiRow ? 12 : 24,
                position: 'relative',
              }}>
                {/* Team Badge with Station Badge aligned */}
                <View style={{ marginBottom: isMultiRow ? 12 : 24 }}>
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
                      {exerciseCount <= 8 && (
                        <View style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: team.color,
                        }} />
                      )}
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
        ))}
      </View>
    </View>
  );
}