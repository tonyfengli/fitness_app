import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface StationsRestViewProps {
  currentRound: RoundData;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
  isSetBreak?: boolean;
  restDuration?: number;
  workDuration?: number;
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
  isPaused,
  isSetBreak = false,
  restDuration = 15,
  workDuration = 45
}: StationsRestViewProps) {
  // Use actual number of exercises as stations
  const exerciseCount = currentRound.exercises.length;
  
  // Use only as many teams as there are stations
  const activeTeams = TEAMS.slice(0, exerciseCount);
  
  // Next exercise index (what we're transitioning to)
  // For the last exercise, there's no "next" - we're going to round preview
  // But for set breaks, we're transitioning to the first exercise of the next set
  const isLastExercise = currentExerciseIndex === exerciseCount - 1 && !isSetBreak;
  const nextExerciseIndex = isLastExercise ? 0 : (currentExerciseIndex + 1) % exerciseCount;
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Horizontal Columns Layout - Same as preview/work */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
        paddingTop: 40,
        flexDirection: 'row',
        gap: 2, // Minimal gap for connected feel
      }}>
        {currentRound.exercises.map((exercise, idx) => {
          const stationNumber = idx + 1;
          
          // Current team (what's leaving this station)
          const safeCurrentIndex = Math.min(Math.max(0, currentExerciseIndex), exerciseCount - 1);
          const currentTeamIndex = (idx - safeCurrentIndex + activeTeams.length) % activeTeams.length;
          const currentTeam = activeTeams[currentTeamIndex];
          
          // Next team (what's coming to this station)
          const nextTeamIndex = (idx - nextExerciseIndex + activeTeams.length) % activeTeams.length;
          const nextTeam = activeTeams[nextTeamIndex];
          
          // Safety check
          if (!currentTeam || !nextTeam) {
            console.error('[StationsRestView] Team calculation error:', {
              currentExerciseIndex,
              safeCurrentIndex,
              exerciseCount,
              activeTeams: activeTeams.length,
              currentTeamIndex,
              nextTeamIndex
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
                borderTopLeftRadius: stationNumber === 1 ? 16 : 0,
                borderBottomLeftRadius: stationNumber === 1 ? 16 : 0,
                borderTopRightRadius: stationNumber === exerciseCount ? 16 : 0,
                borderBottomRightRadius: stationNumber === exerciseCount ? 16 : 0,
                overflow: 'hidden',
              }}
            >
              {/* Team Color Bar - Shows NEXT team color */}
              <View style={{
                height: 6,
                backgroundColor: nextTeam.color,
              }} />
              
              {/* Content */}
              <View style={{ 
                flex: 1,
                padding: 20,
                paddingTop: 24,
              }}>
                {/* Team Transition Badge */}
                <View style={{ marginBottom: 24 }}>
                  {isLastExercise ? (
                    // For last exercise, show "Round Complete"
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: TOKENS.color.accent,
                      }} />
                      <Text style={{ 
                        color: TOKENS.color.accent, 
                        fontWeight: '800',
                        fontSize: 14,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                      }}>
                        Round Complete
                      </Text>
                    </View>
                  ) : (
                    // Show team transition
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {/* Old Team - Faded */}
                      <Text style={{ 
                        color: currentTeam.color, 
                        fontWeight: '600',
                        fontSize: 12,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        textDecorationLine: 'line-through',
                        opacity: 0.4,
                      }}>
                        {currentTeam.name}
                      </Text>
                      
                      {/* Arrow */}
                      <Text style={{ 
                        fontSize: 14, 
                        color: TOKENS.color.muted,
                        opacity: 0.6,
                      }}>
                        →
                      </Text>
                      
                      {/* New Team */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <View style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: nextTeam.color,
                        }} />
                        <Text style={{ 
                          color: nextTeam.color, 
                          fontWeight: '800',
                          fontSize: 14,
                          letterSpacing: 0.3,
                          textTransform: 'uppercase',
                        }}>
                          {nextTeam.name}
                        </Text>
                      </View>
                    </View>
                  )}
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
                    <Text style={{ 
                      fontSize: exerciseCount === 1 ? 16 : 14, 
                      fontWeight: '600',
                      color: nextTeam.color,
                      letterSpacing: 0.5,
                    }}>
                      {exercise.repsPlanned ? `${exercise.repsPlanned} ${exercise.repsPlanned === 1 ? 'rep' : 'reps'}` : `${workDuration} seconds`}
                    </Text>
                    
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
                            <Text style={{ 
                              fontSize: exerciseCount === 1 ? 16 : 14, 
                              fontWeight: '600',
                              color: nextTeam.color,
                              letterSpacing: 0.5,
                            }}>
                              {stationEx.repsPlanned ? `${stationEx.repsPlanned} ${stationEx.repsPlanned === 1 ? 'rep' : 'reps'}` : `${workDuration} seconds`}
                            </Text>
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