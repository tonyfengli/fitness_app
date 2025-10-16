import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useMachine } from '@xstate/react';
import { workoutMachine } from '../machines/workoutMachine';
import type { CircuitConfig } from '@acme/db';
import { 
  CircuitRoundPreview, 
  StationsRoundPreview,
  AMRAPRoundPreview,
  CircuitExerciseView, 
  StationsExerciseView,
  AMRAPExerciseView,
  StationsRestView
} from '../components/workout-round';

// Design tokens
export const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#5de1ff',
    accent2: '#5de1ff',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    chip: 999,
  },
};

// Matte panel helper component
export function MattePanel({
  children,
  style,
  focused = false,
  radius = TOKENS.radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  focused?: boolean;
  radius?: number;
}) {
  const BASE_SHADOW = {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  };
  const FOCUS_SHADOW = {
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  };

  return (
    <View
      style={[
        {
          backgroundColor: TOKENS.color.card,
          borderColor: TOKENS.color.borderGlass,
          borderWidth: 1,
          borderRadius: radius,
        },
        focused ? FOCUS_SHADOW : BASE_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Types
interface CircuitExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  groupName: string;
  equipment?: string | null;
  repsPlanned?: number | null;
  stationIndex?: number | null;
  stationExercises?: CircuitExercise[];
}

interface RoundData {
  roundName: string;
  exercises: CircuitExercise[];
}

const formatTime = (seconds: number): string => {
  if (seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const componentInstanceId = useRef(Date.now());

  // Get circuit config with polling
  const { data: circuitConfig } = useQuery(
    sessionId ? {
      ...api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }),
      refetchInterval: 7000 // Poll every 7 seconds
    } : {
      enabled: false,
      queryKey: ['disabled-circuit-config'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Get saved selections with polling
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Process selections into rounds
  const roundsData = useMemo(() => {
    if (!selections || selections.length === 0) return [];
    
    const allExercises: CircuitExercise[] = [];
    
    selections.forEach((selection) => {
      // Skip if no valid group name
      if (!selection.groupName || selection.groupName === 'Warm-up') {
        return;
      }
      
      const exercise = {
        id: selection.id,
        exerciseId: selection.exerciseId,
        exerciseName: selection.exerciseName,
        orderIndex: selection.orderIndex || 0,
        groupName: selection.groupName || 'Round 1',
        equipment: selection.equipment,
        repsPlanned: selection.repsPlanned,
        stationIndex: (selection as any).stationIndex ?? null,
      };
      
      allExercises.push(exercise);
    });
    
    // Group by round
    const roundsMap = new Map<string, CircuitExercise[]>();
    allExercises.forEach((exercise) => {
      const round = exercise.groupName;
      if (!roundsMap.has(round)) {
        roundsMap.set(round, []);
      }
      roundsMap.get(round)!.push(exercise);
    });
    
    // Sort exercises within each round and create final structure
    let rounds: RoundData[] = Array.from(roundsMap.entries())
      .map(([roundName, exercises]) => {
        // First sort by orderIndex and stationIndex
        const sortedExercises = exercises.sort((a, b) => {
          if (a.orderIndex !== b.orderIndex) {
            return a.orderIndex - b.orderIndex;
          }
          // For same orderIndex, sort by stationIndex
          const aStation = a.stationIndex ?? 0;
          const bStation = b.stationIndex ?? 0;
          return aStation - bStation;
        });
        
        // Check if this is a stations round by looking at round templates
        const roundNum = parseInt(roundName.match(/\d+/)?.[0] || '0');
        const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
          rt => rt.roundNumber === roundNum
        );
        const isStationsRound = roundTemplate?.template?.type === 'stations_round';
        
        // If it's a stations round, group exercises by station
        if (isStationsRound) {
          const stationGroups = new Map<number, CircuitExercise[]>();
          
          // Group exercises by orderIndex (which represents the station)
          sortedExercises.forEach(exercise => {
            const stationKey = exercise.orderIndex;
            if (!stationGroups.has(stationKey)) {
              stationGroups.set(stationKey, []);
            }
            stationGroups.get(stationKey)!.push(exercise);
          });
          
          // Convert to nested structure
          const nestedExercises: CircuitExercise[] = [];
          
          Array.from(stationGroups.entries())
            .sort(([a], [b]) => a - b) // Sort by station number
            .forEach(([stationKey, stationExercises]) => {
              // Sort exercises within station by stationIndex
              const sorted = stationExercises.sort((a, b) => {
                const aIdx = a.stationIndex ?? 0;
                const bIdx = b.stationIndex ?? 0;
                return aIdx - bIdx;
              });
              
              // Primary exercise (stationIndex null or 0)
              const primary = sorted[0];
              if (primary) {
                // Add secondary exercises as stationExercises array
                primary.stationExercises = sorted.slice(1);
                nestedExercises.push(primary);
              }
            });
          
          return {
            roundName,
            exercises: nestedExercises
          };
        }
        
        // For non-stations rounds, return as-is
        return {
          roundName,
          exercises: sortedExercises
        };
      })
      .sort((a, b) => {
        const aNum = parseInt(a.roundName.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.roundName.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
    
    return rounds;
  }, [selections, circuitConfig]);

  // Initialize state machine
  const [state, send] = useMachine(workoutMachine, {
    context: {
      circuitConfig,
      timeRemaining: 0,
      isPaused: false,
      currentRoundIndex: 0,
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      rounds: roundsData,
      selections: selections || [],
      isStarted: false
    }
  });

  // Update machine context when data changes
  useEffect(() => {
    if (circuitConfig) {
      console.log('[XState] Config updated:', circuitConfig);
      send({ type: 'CONFIG_UPDATED', config: circuitConfig });
    }
  }, [circuitConfig, send]);

  useEffect(() => {
    if (roundsData.length > 0) {
      console.log('[XState] Rounds updated:', roundsData);
      send({ type: 'SELECTIONS_UPDATED', selections: roundsData });
    }
  }, [roundsData, send]);

  // Log state changes
  useEffect(() => {
    console.log('[XState] State changed:', {
      state: state.value,
      context: {
        timeRemaining: state.context.timeRemaining,
        isPaused: state.context.isPaused,
        currentRoundIndex: state.context.currentRoundIndex,
        currentExerciseIndex: state.context.currentExerciseIndex,
        currentSetNumber: state.context.currentSetNumber,
        hasConfig: !!state.context.circuitConfig,
        roundsCount: state.context.rounds.length
      }
    });
  }, [state]);

  // Timer management
  useEffect(() => {
    if (state.context.timeRemaining > 0 && !state.context.isPaused) {
      const interval = setInterval(() => {
        send({ type: 'TIMER_TICK' });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.context.timeRemaining, state.context.isPaused, send]);

  // Timer complete handling
  useEffect(() => {
    if (state.context.timeRemaining === 0 && (state.value === 'exercise' || state.value === 'rest' || state.value === 'setBreak')) {
      const timeoutId = setTimeout(() => {
        send({ type: 'TIMER_COMPLETE' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [state.context.timeRemaining, state.value, send]);

  // Helper functions
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRoundTiming = useCallback((roundIndex: number) => {
    const config = state.context.circuitConfig?.config;
    const roundTemplates = config?.roundTemplates;
    
    if (!roundTemplates || !config) {
      return {
        workDuration: config?.workDuration || 45,
        restDuration: config?.restDuration || 15,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const,
        repeatTimes: 1
      };
    }
    
    const currentTemplate = roundTemplates.find(
      rt => rt.roundNumber === roundIndex + 1
    );
    
    if (!currentTemplate) {
      return {
        workDuration: config.workDuration || 45,
        restDuration: config.restDuration || 15,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const,
        repeatTimes: 1
      };
    }
    
    const template = currentTemplate.template;
    if (template.type === 'circuit_round') {
      return {
        workDuration: template.workDuration ?? config.workDuration ?? 45,
        restDuration: template.restDuration ?? config.restDuration ?? 15,
        restBetweenSets: (template as any).restBetweenSets ?? 30,
        roundType: 'circuit_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'stations_round') {
      return {
        workDuration: (template as any).workDuration ?? config.workDuration ?? 60,
        restDuration: (template as any).restDuration ?? config.restDuration ?? 15,
        restBetweenSets: (template as any).restBetweenSets ?? 30,
        roundType: 'stations_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'amrap_round') {
      const totalDuration = (template as any).totalDuration || 300;
      return {
        workDuration: totalDuration,
        restDuration: 0,
        roundType: 'amrap_round' as const,
        repeatTimes: 1
      };
    }
    
    return {
      workDuration: config.workDuration || 45,
      restDuration: config.restDuration || 15,
      restBetweenSets: 30,
      roundType: 'circuit_round' as const,
      repeatTimes: 1
    };
  }, [state.context.circuitConfig]);

  const currentRoundTiming = getRoundTiming(state.context.currentRoundIndex);
  const currentRoundType = currentRoundTiming.roundType;
  const currentRepeatTimes = currentRoundTiming.repeatTimes || 1;
  const currentRound = state.context.rounds[state.context.currentRoundIndex];
  const currentExercise = currentRound?.exercises[state.context.currentExerciseIndex];

  const handleStartWorkout = () => {
    send({ type: 'START_WORKOUT' });
  };

  const handleSkip = () => {
    send({ type: 'SKIP' });
  };

  const handleBack = () => {
    send({ type: 'BACK' });
  };

  const handlePause = () => {
    if (state.context.isPaused) {
      send({ type: 'RESUME' });
    } else {
      send({ type: 'PAUSE' });
    }
  };

  // Loading state
  if (selectionsLoading || !circuitConfig) {
    return (
      <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
      </View>
    );
  }

  // No selections
  if (!selections || selections.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: TOKENS.color.text, fontSize: 18 }}>No exercises found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      {/* Header Controls */}
      <View style={{ 
        position: 'absolute', 
        top: 60, 
        left: 60, 
        right: 60, 
        zIndex: 10,
        alignItems: 'center' 
      }}>
        {state.value === 'roundPreview' && state.context.currentRoundIndex > 0 ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 8,
            gap: 8,
          }}>
            {/* Back Round */}
            <Pressable
              onPress={() => {
                if (state.context.currentRoundIndex === 0) {
                  navigation.goBack();
                } else {
                  send({ type: 'BACK' });
                }
              }}
              focusable
            >
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  radius={26}
                  style={{ 
                    width: 94,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: focused ? 
                      'rgba(255,255,255,0.15)' : 
                      'rgba(255,255,255,0.08)',
                    borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                    borderWidth: focused ? 1.5 : 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="navigate-before" size={18} color={TOKENS.color.text} />
                    <Text style={{ 
                      color: TOKENS.color.text, 
                      fontSize: 13, 
                      fontWeight: '700',
                      letterSpacing: 0.3,
                      textTransform: 'uppercase'
                    }}>
                      BACK
                    </Text>
                  </View>
                </MattePanel>
              )}
            </Pressable>

            {/* Skip Round */}
            <Pressable
              onPress={() => send({ type: 'SKIP' })}
              focusable
              disabled={state.context.currentRoundIndex >= state.context.rounds.length - 1}
            >
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  radius={26}
                  style={{ 
                    width: 94,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: state.context.currentRoundIndex >= state.context.rounds.length - 1 ? 0.4 : 1,
                    backgroundColor: focused ? 
                      'rgba(255,255,255,0.15)' : 
                      'rgba(255,255,255,0.08)',
                    borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                    borderWidth: focused ? 1.5 : 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ 
                      color: TOKENS.color.text, 
                      fontSize: 13, 
                      fontWeight: '700',
                      letterSpacing: 0.3,
                      textTransform: 'uppercase'
                    }}>
                      SKIP
                    </Text>
                    <Icon name="navigate-next" size={18} color={TOKENS.color.text} />
                  </View>
                </MattePanel>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={{ alignItems: 'center', position: 'relative' }}>
            {/* Main Round Info */}
            <Text style={{ 
              fontSize: 40, 
              fontWeight: '900', 
              color: currentRoundType === 'stations_round' && state.value === 'exercise' ? '#fff5e6' : TOKENS.color.text,
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              {currentRound?.roundName || `Round ${state.context.currentRoundIndex + 1}`}
            </Text>
            
            {/* AMRAP Rest Label */}
            {state.value === 'round-preview' && currentRoundType === 'amrap_round' && (
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '700',
                color: TOKENS.color.muted,
                opacity: 0.8,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                marginTop: 4,
              }}>
                Rest
              </Text>
            )}
            
            {/* Stations Round Progress */}
            {currentRoundType === 'stations_round' && currentRound && (
              <View style={{ 
                height: 24, 
                marginTop: 8,
                justifyContent: 'center',
              }}>
                {state.value === 'exercise' ? (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 12, 
                  }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      gap: 6, 
                    }}>
                      {currentRound.exercises.map((_, index) => (
                        <View
                          key={index}
                          style={{
                            width: index === state.context.currentExerciseIndex ? 8 : 6,
                            height: index === state.context.currentExerciseIndex ? 8 : 6,
                            borderRadius: 4,
                            backgroundColor: index === state.context.currentExerciseIndex 
                              ? '#ffb366'
                              : index < state.context.currentExerciseIndex 
                                ? 'rgba(255, 179, 102, 0.6)'
                                : 'rgba(255, 179, 102, 0.25)',
                            transform: index === state.context.currentExerciseIndex ? [{ scale: 1.2 }] : [],
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '900',
                        color: '#fff5e6',
                        fontStyle: 'normal',
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        textShadowColor: 'rgba(255, 179, 102, 0.8)',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 6,
                      }}>
                        Let's Go!
                      </Text>
                    </View>
                  </View>
                ) : state.value === 'rest' ? (
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: TOKENS.color.muted,
                    opacity: 0.8,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    Switch Stations
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}
        
        {/* Timer Display for specific cases */}
        {(state.value === 'exercise' || state.value === 'rest') && currentRoundType === 'stations_round' ? (
          <Text style={{ 
            fontSize: 120, 
            fontWeight: '900', 
            color: state.value === 'exercise' ? '#fff5e6' : TOKENS.color.accent,
            letterSpacing: -2,
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            {formatTime(state.context.timeRemaining)}
          </Text>
        ) : state.value === 'exercise' && currentRoundType === 'amrap_round' ? (
          <Text style={{ 
            fontSize: 120, 
            fontWeight: '900', 
            color: TOKENS.color.accent,
            letterSpacing: -2,
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            {formatTime(state.context.timeRemaining)}
          </Text>
        ) : state.value === 'roundPreview' ? (
          <Text style={{ 
            fontSize: 80, 
            fontWeight: '900', 
            color: TOKENS.color.text,
            letterSpacing: 1,
            textTransform: 'uppercase',
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            {currentRound?.roundName || `Round ${state.context.currentRoundIndex + 1}`}
          </Text>
        ) : null}
        
        {/* Start Button */}
        {state.value === 'roundPreview' && state.context.currentRoundIndex === 0 && !state.context.isStarted && (
          <Pressable
            onPress={handleStartWorkout}
            focusable
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: focused ? 1 : 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Start</Text>
              </MattePanel>
            )}
          </Pressable>
        )}
      </View>

      {/* Main Content Area */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 60, paddingTop: 120 }}>
        {state.value === 'roundPreview' && currentRound && (
          <>
            {currentRoundType === 'circuit_round' && (
              <CircuitRoundPreview 
                currentRound={currentRound}
                currentRoundIndex={state.context.currentRoundIndex}
                totalRounds={state.context.rounds.length}
                roundDuration={currentRoundTiming.workDuration * currentRound.exercises.length}
              />
            )}
            {currentRoundType === 'stations_round' && (
              <StationsRoundPreview 
                currentRound={currentRound}
                currentRoundIndex={state.context.currentRoundIndex}
                totalRounds={state.context.rounds.length}
                roundDuration={currentRoundTiming.workDuration}
                repeatTimes={currentRepeatTimes}
              />
            )}
            {currentRoundType === 'amrap_round' && (
              <AMRAPRoundPreview 
                currentRound={currentRound}
                currentRoundIndex={state.context.currentRoundIndex}
                totalRounds={state.context.rounds.length}
                totalDuration={currentRoundTiming.workDuration}
              />
            )}
          </>
        )}

        {state.value === 'exercise' && currentRound && (
          <>
            {currentRoundType === 'circuit_round' && (
              <CircuitExerciseView 
                currentRound={currentRound}
                currentExerciseIndex={state.context.currentExerciseIndex}
                timeRemaining={state.context.timeRemaining}
                isPaused={state.context.isPaused}
                workDuration={currentRoundTiming.workDuration}
              />
            )}
            {currentRoundType === 'stations_round' && (
              <StationsExerciseView 
                currentRound={currentRound}
                currentExerciseIndex={state.context.currentExerciseIndex}
                timeRemaining={state.context.timeRemaining}
                isPaused={state.context.isPaused}
                workDuration={currentRoundTiming.workDuration}
                currentSetNumber={state.context.currentSetNumber}
                totalSets={currentRepeatTimes}
              />
            )}
            {currentRoundType === 'amrap_round' && (
              <AMRAPExerciseView 
                currentRound={currentRound}
                timeRemaining={state.context.timeRemaining}
                isPaused={state.context.isPaused}
                totalDuration={currentRoundTiming.workDuration}
              />
            )}
            
            {/* Repeat Progress Indicator */}
            {(currentRoundType === 'stations_round' || currentRoundType === 'circuit_round') && currentRepeatTimes > 1 && (
              <View style={{
                position: 'absolute',
                top: currentRoundType === 'circuit_round' ? -8 : -8,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 10,
              }}>
                <View style={{
                  paddingHorizontal: currentRoundType === 'circuit_round' ? 16 : 14,
                  paddingVertical: currentRoundType === 'circuit_round' ? 8 : 7,
                  gap: currentRoundType === 'circuit_round' ? 6 : 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: currentRoundType === 'stations_round' ? 'rgba(255,179,102,0.15)' : TOKENS.color.accent + '15',
                  borderColor: currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                }}>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '700',
                    color: currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    Set
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent,
                    marginLeft: 2,
                  }}>
                    {state.context.currentSetNumber}
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '500',
                    color: currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent,
                    marginHorizontal: 3,
                  }}>
                    of
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent,
                  }}>
                    {currentRepeatTimes}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {state.value === 'rest' && currentRound && (
          <>
            {currentRoundType === 'stations_round' ? (
              <StationsRestView 
                currentRound={currentRound}
                currentExerciseIndex={state.context.currentExerciseIndex}
                timeRemaining={state.context.timeRemaining}
                isPaused={state.context.isPaused}
                isSetBreak={state.context.currentExerciseIndex === currentRound.exercises.length - 1 && state.context.currentSetNumber < currentRepeatTimes}
                restDuration={currentRoundTiming.restDuration}
                workDuration={currentRoundTiming.workDuration}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
                {/* Main Timer */}
                <Text style={{ 
                  fontSize: 180, 
                  fontWeight: '900', 
                  color: TOKENS.color.accent,
                  marginBottom: 40,
                  letterSpacing: -2
                }}>
                  {formatTime(state.context.timeRemaining)}
                </Text>
                
                {/* Rest Label */}
                <Text style={{ 
                  fontSize: 48, 
                  fontWeight: '700', 
                  color: TOKENS.color.text, 
                  marginBottom: 12,
                  textAlign: 'center'
                }}>
                  Rest
                </Text>
                
                {/* Next Exercise */}
                {(() => {
                  const isLastExercise = state.context.currentExerciseIndex === currentRound.exercises.length - 1;
                  const isSetBreak = isLastExercise && state.context.currentSetNumber < currentRepeatTimes;
                  
                  if (!isSetBreak) {
                    return (
                      <Text style={{ 
                        fontSize: 20, 
                        fontWeight: '500',
                        color: TOKENS.color.muted,
                        opacity: 0.7
                      }}>
                        Next up: {currentRound?.exercises[state.context.currentExerciseIndex + 1]?.exerciseName || 'Complete'}
                      </Text>
                    );
                  }
                  return null;
                })()}
              </View>
            )}
            
            {/* Repeat Progress Indicator for Rest */}
            {(currentRoundType === 'stations_round' || currentRoundType === 'circuit_round') && currentRepeatTimes > 1 && (
              <View style={{
                position: 'absolute',
                top: currentRoundType === 'circuit_round' ? -48 : -8,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 10,
              }}>
                <View style={{
                  paddingHorizontal: currentRoundType === 'circuit_round' ? 16 : 14,
                  paddingVertical: currentRoundType === 'circuit_round' ? 8 : 7,
                  gap: currentRoundType === 'circuit_round' ? 6 : 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: TOKENS.color.accent + '15',
                  borderColor: TOKENS.color.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                }}>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '700',
                    color: TOKENS.color.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    Set
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: TOKENS.color.accent,
                    marginLeft: 2,
                  }}>
                    {state.context.currentSetNumber}
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '500',
                    color: TOKENS.color.accent,
                    marginHorizontal: 3,
                  }}>
                    of
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: TOKENS.color.accent,
                  }}>
                    {currentRepeatTimes}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {state.value === 'setBreak' && currentRound && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
            {/* Main Timer */}
            <Text style={{ 
              fontSize: 180, 
              fontWeight: '900', 
              color: TOKENS.color.accent2,
              marginBottom: 40,
              letterSpacing: -2
            }}>
              {formatTime(state.context.timeRemaining)}
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
            
            {/* Next Set Info */}
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '500',
              color: TOKENS.color.muted,
              opacity: 0.7
            }}>
              Next: Set {state.context.currentSetNumber} of {currentRepeatTimes}
            </Text>
            
            {/* Repeat Progress Indicator for Set Break */}
            <View style={{
              position: 'absolute',
              top: -48,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 10,
            }}>
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                gap: 6,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: TOKENS.color.accent + '15',
                borderColor: TOKENS.color.accent,
                borderWidth: 1,
                borderRadius: 999,
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: TOKENS.color.accent,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}>
                  Completing Set
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: TOKENS.color.accent,
                  marginLeft: 2,
                }}>
                  {state.context.currentSetNumber - 1}
                </Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: TOKENS.color.accent,
                  marginHorizontal: 3,
                }}>
                  of
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: TOKENS.color.accent,
                }}>
                  {currentRepeatTimes}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={{ 
        position: 'absolute', 
        bottom: 60, 
        left: 0, 
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        paddingHorizontal: 60
      }}>
        {(state.value === 'exercise' || state.value === 'rest' || state.value === 'setBreak') && (
          <>
            <Pressable onPress={handleBack} focusable>
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  }}
                >
                  <Text style={{ color: TOKENS.color.text, fontSize: 16 }}>Back</Text>
                </MattePanel>
              )}
            </Pressable>
            
            <Pressable onPress={handlePause} focusable>
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  }}
                >
                  <Icon 
                    name={state.context.isPaused ? 'play-arrow' : 'pause'} 
                    size={24} 
                    color={TOKENS.color.text} 
                  />
                </MattePanel>
              )}
            </Pressable>
            
            <Pressable onPress={handleSkip} focusable>
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  }}
                >
                  <Text style={{ color: TOKENS.color.text, fontSize: 16 }}>Skip</Text>
                </MattePanel>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}