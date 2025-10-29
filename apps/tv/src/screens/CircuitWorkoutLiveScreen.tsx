import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, TVFocusGuideView } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import type { CircuitConfig } from '@acme/db';

// Import extracted components
import { TOKENS, CircuitExercise, RoundData } from '../components/workout-live/types';
import { MattePanel } from '../components/workout-live/MattePanel';
import { WorkoutHeader } from '../components/workout-live/WorkoutHeader';
import { WorkoutControls } from '../components/workout-live/WorkoutControls';
import { WorkoutContent } from '../components/workout-live/WorkoutContent';
import { useWorkoutMachine } from '../components/workout-live/hooks/useWorkoutMachine';

// Re-export MattePanel for backward compatibility
export { MattePanel } from '../components/workout-live/MattePanel';

export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const componentInstanceId = useRef(Date.now());
  const [isTeamsModalVisible, setIsTeamsModalVisible] = useState(false);
  const closeButtonRef = useRef<any>(null);

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
        
        // If it's a stations round, group exercises by orderIndex
        if (isStationsRound) {
          // Group exercises by orderIndex (exercises with same orderIndex belong to same station)
          const stationGroups = new Map<number, CircuitExercise[]>();
          
          sortedExercises.forEach(exercise => {
            const stationKey = exercise.orderIndex;
            if (!stationGroups.has(stationKey)) {
              stationGroups.set(stationKey, []);
            }
            stationGroups.get(stationKey)!.push(exercise);
          });
          
          // Convert to nested structure
          const nestedExercises: CircuitExercise[] = [];
          
          // Process station groups
          const stationEntries = Array.from(stationGroups.entries())
            .sort(([a], [b]) => a - b); // Sort by orderIndex
            
          stationEntries.forEach(([orderIndex, stationExercises]) => {
              // Sort exercises within station by stationIndex (position within station)
              const sorted = stationExercises.sort((a, b) => {
                const aIndex = a.stationIndex ?? 0;
                const bIndex = b.stationIndex ?? 0;
                return aIndex - bIndex;
              });
              
              // The first exercise becomes the primary
              const primary = { ...sorted[0]! };
              // Add remaining exercises as stationExercises array
              primary.stationExercises = sorted.slice(1);
              nestedExercises.push(primary);
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

  // Use the workout machine hook
  const { state, send, getRoundTiming } = useWorkoutMachine({
    circuitConfig,
    roundsData,
    selections,
    onWorkoutComplete: () => navigation.goBack()
  });

  const currentRoundTiming = getRoundTiming(state.context.currentRoundIndex);
  const currentRoundType = currentRoundTiming.roundType;
  const currentRound = state.context.rounds[state.context.currentRoundIndex];

  const handleStartWorkout = () => {
    send({ type: 'START_WORKOUT' });
  };

  // Auto-focus close button when modal opens
  useEffect(() => {
    if (isTeamsModalVisible && closeButtonRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    }
  }, [isTeamsModalVisible]);

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

  // Dynamic background color function
  const getBackgroundColor = () => {
    if (state.value === 'exercise' && currentRoundType === 'stations_round') {
      return '#2d1508'; // Reddish-brown background for stations work
    }
    return TOKENS.color.bg; // Default background for all other states
  };

  return (
    <View style={{ flex: 1, backgroundColor: getBackgroundColor(), paddingTop: 40 }}>
      {state.value === 'roundPreview' ? (
        /* ROUND PREVIEW LAYOUT - Matches old implementation exactly */
        <>
          {/* Header with controls */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 48,
            paddingTop: 20,
            paddingBottom: 20,
            position: 'relative'
          }}>
            {/* LEFT SIDE: Back/Skip Navigation */}
            <View style={{ 
              flexDirection: 'column',
              gap: 12,
            }}>
              {/* Back/Skip Pair */}
              <View style={{ 
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 32,
                padding: 6,
                gap: 4,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
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
                disabled={state.context.currentRoundIndex >= roundsData.length - 1}
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
                      opacity: state.context.currentRoundIndex >= roundsData.length - 1 ? 0.4 : 1,
                      backgroundColor: focused ? 
                        'rgba(255,255,255,0.15)' : 
                        state.context.currentRoundIndex >= roundsData.length - 1 ? 'transparent' : 'rgba(255,255,255,0.08)',
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
              
              {/* Teams Button - Secondary action */}
              <Pressable
                onPress={() => setIsTeamsModalVisible(true)}
                focusable
              >
                {({ focused }) => (
                  <MattePanel 
                    focused={focused}
                    radius={22}
                    style={{ 
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      backgroundColor: focused ? 
                        'rgba(255,255,255,0.08)' : 
                        'rgba(255,255,255,0.03)',
                      borderColor: focused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                      borderWidth: focused ? 1 : 0.5,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      elevation: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon name="groups" size={14} color={TOKENS.color.muted} />
                      <Text style={{ 
                        color: TOKENS.color.muted, 
                        fontSize: 11, 
                        fontWeight: '600',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase'
                      }}>
                        TEAMS
                      </Text>
                    </View>
                  </MattePanel>
                )}
              </Pressable>
            </View>

            {/* CENTER: Round Header */}
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

            {/* RIGHT SIDE: Start Button, Triple Controls for AMRAP/Circuit, or Spacer */}
            {state.context.currentRoundIndex === 0 && !state.context.isStarted ? (
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
            ) : (currentRoundType === 'amrap_round' || currentRoundType === 'circuit_round' || currentRoundType === 'stations_round') ? (
              // Triple button controls for AMRAP, Circuit, and Stations round preview
              <View style={{ 
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 32,
                padding: 6,
                gap: 4,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                zIndex: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}>
                {/* Pause/Play */}
                <Pressable onPress={() => send(state.context.isPaused ? { type: 'RESUME' } : { type: 'PAUSE' })} focusable>
                  {({ focused }) => (
                    <MattePanel 
                      focused={focused}
                      radius={26}
                      style={{ 
                        width: 56,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                        borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                        borderWidth: focused ? 1.5 : 0,
                      }}
                    >
                      <Icon 
                        name={state.context.isPaused ? "play-arrow" : "pause"} 
                        size={26}
                        color={TOKENS.color.text}
                      />
                    </MattePanel>
                  )}
                </Pressable>
                
                {/* Start Round (was Skip Forward) */}
                <Pressable onPress={() => send({ type: 'START_WORKOUT' })} focusable>
                  {({ focused }) => (
                    <MattePanel 
                      focused={focused}
                      radius={26}
                      style={{ 
                        width: 52,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                        borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                        borderWidth: focused ? 1.5 : 0,
                      }}
                    >
                      <Icon 
                        name="skip-next" 
                        size={22} 
                        color={TOKENS.color.text}
                      />
                    </MattePanel>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ width: 60 }} />
            )}
          </View>

          {/* Main Content Area */}
          <View style={{ flex: 1, paddingHorizontal: 48, paddingBottom: 48 }}>
            <WorkoutContent 
              state={state}
              circuitConfig={circuitConfig}
              getRoundTiming={getRoundTiming}
            />
          </View>
        </>
      ) : (
        /* EXERCISE/REST LAYOUT - Match old implementation structure */
        <>
          {/* Header with controls - matches old layout */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 48,
            paddingTop: 20,
            paddingBottom: 20,
            position: 'relative'
          }}>
            {/* LEFT SIDE: Round Info */}
            <WorkoutHeader 
              state={state} 
              currentRound={currentRound}
              currentRoundType={currentRoundType}
            />

            {/* CENTER: Timer (absolute positioned) */}
            {(state.value === 'exercise' || state.value === 'rest' || state.value === 'setBreak') && (currentRoundType === 'stations_round' || currentRoundType === 'amrap_round') ? (
              <Text style={{ 
                fontSize: 120, 
                fontWeight: '900', 
                color: state.value === 'exercise' ? (currentRoundType === 'stations_round' ? '#fff5e6' : TOKENS.color.text) : TOKENS.color.accent, // Different colors for different round types
                letterSpacing: -2,
                position: 'absolute',
                top: -15,
                left: 0,
                right: 0,
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                {Math.floor(state.context.timeRemaining / 60)}:{(state.context.timeRemaining % 60).toString().padStart(2, '0')}
              </Text>
            ) : null}

            {/* RIGHT SIDE: Control Buttons */}
            <WorkoutControls 
              state={state}
              send={send}
              currentRoundType={currentRoundType}
            />
          </View>

          {/* Sets Badge for Stations (positioned above timer) */}
          {currentRoundType === 'stations_round' && currentRoundTiming.repeatTimes > 1 && (state.value === 'exercise' || state.value === 'rest') && (
            <View style={{
              position: 'absolute',
              top: 159,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 10,
            }}>
              <View style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                gap: 5,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: state.value === 'exercise' 
                  ? 'rgba(255,179,102,0.15)'  // Orange for exercise
                  : TOKENS.color.accent + '15', // Cyan for rest and setBreak (#5de1ff15)
                borderColor: state.value === 'exercise' 
                  ? '#ffb366'  // Orange for exercise
                  : TOKENS.color.accent, // Cyan for rest and setBreak (#5de1ff)
                borderWidth: 1,
                borderRadius: 999,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: state.value === 'exercise' 
                    ? '#ffb366'  // Orange for exercise
                    : TOKENS.color.accent, // Cyan for rest and setBreak (#5de1ff)
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}>
                  Set
                </Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: state.value === 'exercise' 
                    ? '#ffb366'  // Orange for exercise
                    : TOKENS.color.accent, // Cyan for rest and setBreak (#5de1ff)
                  marginLeft: 2,
                }}>
                  {state.value === 'setBreak' ? state.context.currentSetNumber : state.context.currentSetNumber}
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: state.value === 'exercise' 
                    ? '#ffb366'  // Orange for exercise
                    : TOKENS.color.accent, // Cyan for rest and setBreak (#5de1ff)
                  marginHorizontal: 3,
                }}>
                  of
                </Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: state.value === 'exercise' 
                    ? '#ffb366'  // Orange for exercise
                    : TOKENS.color.accent, // Cyan for rest and setBreak (#5de1ff)
                }}>
                  {currentRoundTiming.repeatTimes}
                </Text>
              </View>
            </View>
          )}

          {/* Main Content Area */}
          <View style={{ flex: 1, paddingHorizontal: 48, paddingBottom: 48 }}>
            <WorkoutContent 
              state={state}
              circuitConfig={circuitConfig}
              getRoundTiming={getRoundTiming}
            />
          </View>
        </>
      )}

      {/* Teams Assignment Modal */}
      {isTeamsModalVisible && (
        <TVFocusGuideView 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          trapFocusUp={true}
          trapFocusDown={true}
          trapFocusLeft={true}
          trapFocusRight={true}
        >
          <MattePanel style={{
            width: 800,
            maxHeight: 600,
            backgroundColor: TOKENS.color.card,
            borderColor: TOKENS.color.borderGlass,
            borderWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 12,
            padding: 32,
          }}>
            {/* Content - Station Grid */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
              justifyContent: 'center',
            }}>
              {/* Mock station assignments - using established container patterns */}
              {[
                { station: 1, team: 'Team 1', color: '#ef4444', clients: ['Alex M.', 'Sarah K.'] },
                { station: 2, team: 'Team 2', color: '#3b82f6', clients: ['Mike R.', 'Lisa P.'] },
                { station: 3, team: 'Team 3', color: '#22c55e', clients: ['David L.', 'Emma W.'] },
                { station: 4, team: 'Team 4', color: '#f59e0b', clients: ['Chris B.', 'Nina S.'] },
                { station: 5, team: 'Team 5', color: '#a855f7', clients: ['Ryan T.'] },
                { station: 6, team: 'Team 6', color: '#14b8a6', clients: ['Jenna M.', 'Tom H.'] },
              ].map((assignment) => (
                <View 
                  key={assignment.station}
                  style={{
                    width: 220,
                    backgroundColor: TOKENS.color.cardGlass,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  {/* Team Color Bar */}
                  <View style={{
                    height: 6,
                    backgroundColor: assignment.color,
                  }} />
                  
                  {/* Content */}
                  <View style={{ 
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
                            backgroundColor: assignment.color,
                          }} />
                          <Text style={{ 
                            color: assignment.color, 
                            fontWeight: '800',
                            fontSize: 14,
                            letterSpacing: 0.3,
                            textTransform: 'uppercase',
                          }}>
                            {assignment.team}
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
                            color: TOKENS.color.text,
                            letterSpacing: 0.2,
                          }}>
                            S{assignment.station}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    {/* Client List */}
                    <View style={{ gap: 8 }}>
                      {assignment.clients.map((client, index) => (
                        <Text 
                          key={index}
                          style={{
                            fontSize: 18,
                            fontWeight: '700',
                            color: TOKENS.color.text,
                          }}
                        >
                          {client}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Single Auto-Focused Close Button */}
            <View style={{
              alignItems: 'center',
              marginTop: 32,
            }}>
              <Pressable
                ref={closeButtonRef}
                onPress={() => setIsTeamsModalVisible(false)}
                focusable
                hasTVPreferredFocus
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
                    <Text style={{ 
                      color: TOKENS.color.text, 
                      fontSize: 13, 
                      fontWeight: '700',
                      letterSpacing: 0.3,
                      textTransform: 'uppercase'
                    }}>
                      CLOSE
                    </Text>
                  </MattePanel>
                )}
              </Pressable>
            </View>
          </MattePanel>
        </TVFocusGuideView>
      )}
    </View>
  );
}