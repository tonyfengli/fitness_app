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
  workDuration = 45,
  getStationTimerDisplay,
  stationCircuits
}: StationsExerciseViewProps) {
  // Use actual number of exercises as stations
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  // Calculate dynamic positioning for timer based on current station
  // Account for container padding (48px on each side) in the flex layout
  // Each station occupies equal width within the padded container
  const containerPadding = 48;
  const contentWidthPercent = 100 - ((containerPadding * 2) / 1920 * 100); // Assuming TV width ~1920px
  const paddingPercent = (containerPadding / 1920) * 100;
  
  // Position timer at center of current station within the content area
  const stationCenterPercent = paddingPercent + (((currentExerciseIndex + 0.5) / exerciseCount) * contentWidthPercent);
  
  // Get all station timers (not just current)
  const getStationCircuitTimers = () => {
    console.log('[StationsExerciseView] getStationCircuitTimers called');
    console.log('[StationsExerciseView] stationCircuits:', stationCircuits);
    console.log('[StationsExerciseView] getStationTimerDisplay available:', !!getStationTimerDisplay);
    
    if (!stationCircuits || !getStationTimerDisplay) {
      console.log('[StationsExerciseView] Early return - missing stationCircuits or getStationTimerDisplay');
      return {};
    }
    
    const timers: Record<string, any> = {};
    Object.keys(stationCircuits).forEach(stationIndex => {
      const stationIdx = parseInt(stationIndex);
      console.log('[StationsExerciseView] Processing station index:', stationIndex);
      console.log('[StationsExerciseView] Station index as number:', stationIdx);
      console.log('[StationsExerciseView] Exercise count (max stations):', exerciseCount);
      
      // Safety check: only process stations that actually exist
      if (stationIdx >= exerciseCount) {
        console.log('[StationsExerciseView] SKIPPING station', stationIdx, '- exceeds exercise count', exerciseCount);
        return;
      }
      
      const timer = getStationTimerDisplay(stationIdx);
      console.log('[StationsExerciseView] Timer for station', stationIndex, ':', timer);
      if (timer) {
        timers[stationIndex] = timer;
      }
    });
    console.log('[StationsExerciseView] Final timers object:', timers);
    return timers;
  };
  
  const allStationTimers = getStationCircuitTimers();
  
  return (
    <View style={{ flex: 1, width: '100%', position: 'relative' }}>
      {/* Floating Circuit Timers - Show for ALL stations with circuit config */}
      {Object.entries(allStationTimers).map(([stationIndex, timer]) => {
        const stationIdx = parseInt(stationIndex);
        const stationPosition = paddingPercent + (((stationIdx + 0.5) / exerciseCount) * contentWidthPercent);
        const isCurrentStation = stationIdx === currentExerciseIndex;
        
        console.log('[StationsExerciseView] Rendering timer for station:', stationIndex);
        console.log('[StationsExerciseView] - stationIdx:', stationIdx);
        console.log('[StationsExerciseView] - stationPosition:', stationPosition);
        console.log('[StationsExerciseView] - isCurrentStation:', isCurrentStation);
        console.log('[StationsExerciseView] - currentExerciseIndex:', currentExerciseIndex);
        console.log('[StationsExerciseView] - exerciseCount:', exerciseCount);
        console.log('[StationsExerciseView] - timer data:', timer);
        
        return (
          <View 
            key={`circuit-timer-${stationIndex}`}
            style={{
              position: 'absolute',
              bottom: -38,
              left: `${stationPosition}%`,
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

      {/* Horizontal Columns Layout - Same as preview */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        paddingTop: 29,
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