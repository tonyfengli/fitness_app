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
import { useWorkoutMachineWithLighting } from '../components/workout-live/hooks/useWorkoutMachineWithLighting';
import { useLightingControl } from '../hooks/useLightingControl';
import { useAudio } from '../hooks/useAudio';
import { useMusicPlayer } from '../hooks/useMusicPlayer';

// Re-export MattePanel for backward compatibility
export { MattePanel } from '../components/workout-live/MattePanel';

// Helper function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper function to distribute clients across teams
function distributeClientsToTeams(clients: any[], teamCount: number): Map<number, any[]> {
  const distribution = new Map<number, any[]>();
  
  // Initialize empty teams
  for (let i = 0; i < teamCount; i++) {
    distribution.set(i, []);
  }
  
  if (!clients || clients.length === 0) {
    return distribution;
  }
  
  // Shuffle clients for random distribution
  const shuffledClients = shuffleArray(clients);
  
  // Calculate base clients per team and how many teams get extra
  const baseClientsPerTeam = Math.floor(clients.length / teamCount);
  const teamsWithExtra = clients.length % teamCount;
  
  // Randomly select which teams get extra clients
  const teamIndices = Array.from({ length: teamCount }, (_, i) => i);
  const shuffledTeamIndices = shuffleArray(teamIndices);
  const teamsGettingExtra = new Set(shuffledTeamIndices.slice(0, teamsWithExtra));
  
  // Distribute clients
  let clientIndex = 0;
  for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
    const clientsForThisTeam = baseClientsPerTeam + (teamsGettingExtra.has(teamIdx) ? 1 : 0);
    const teamClients = shuffledClients.slice(clientIndex, clientIndex + clientsForThisTeam);
    distribution.set(teamIdx, teamClients);
    clientIndex += clientsForThisTeam;
  }
  
  return distribution;
}

export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const isStartedOverride = navigation.getParam('isStartedOverride') || false;
  const componentInstanceId = useRef(Date.now());
  const [isTeamsModalVisible, setIsTeamsModalVisible] = useState(false);
  const closeButtonRef = useRef<any>(null);
  const teamsButtonRef = useRef<any>(null);
  const backButtonRef = useRef<any>(null);
  const hasAttemptedLightingInit = useRef(false);
  const [shouldRestoreFocusToTeams, setShouldRestoreFocusToTeams] = useState(false);
  const [teamsDistribution, setTeamsDistribution] = useState<Map<number, any[]>>(new Map());
  const [isLightingEnabled, setIsLightingEnabled] = useState(isStartedOverride);

  // Component lifecycle tracking
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  // Initialize audio
  useAudio();

  // Initialize music player
  const { isEnabled: isMusicEnabled, currentTrack, toggle: toggleMusic, start: startMusic, stop: stopMusic } = useMusicPlayer();

  // Log music state for debugging
  useEffect(() => {
    console.log('[Music]', { isMusicEnabled, currentTrack: currentTrack?.name || 'none' });
  }, [isMusicEnabled, currentTrack]);

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

  // Get checked-in clients for the session
  const { data: checkedInClients } = useQuery(
    sessionId ? {
      ...api.trainingSession.getCheckedInClients.queryOptions({ sessionId }),
      refetchInterval: 5000 // Poll every 5 seconds
    } : {
      enabled: false,
      queryKey: ['disabled-checked-in-clients'],
      queryFn: () => Promise.resolve(null)
    }
  );

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

  // Initialize lighting control
  const { isLightingOn, turnOn, turnOff, activateScene, getSceneForPhase, setCurrentPhase, lightingConfig, bridgeAvailable } = useLightingControl({ sessionId });
  
  // Helper to check if any phase has lighting config for current round
  const hasLightingForAnyPhase = (roundIndex: number, phases: string[]) => {
    if (!lightingConfig) {
      console.log('[Lighting] No lightingConfig available');
      return false;
    }
    
    console.log('[Lighting] Checking phases for round', roundIndex, 'phases:', phases);
    console.log('[Lighting] lightingConfig:', lightingConfig);
    
    return phases.some(phase => {
      const scene = getSceneForPhase(roundIndex, phase);
      console.log(`[Lighting] Round ${roundIndex}, Phase ${phase}, Scene:`, scene);
      return scene !== null;
    });
  };
  
  // Sync lighting state with toggle - wait for lightingConfig AND bridgeAvailable
  useEffect(() => {
    // Only attempt initialization once when both lightingConfig and bridge are available
    if (isStartedOverride && lightingConfig && bridgeAvailable && !hasAttemptedLightingInit.current) {
      hasAttemptedLightingInit.current = true;
      if (!isLightingOn) {
        const previewScene = getSceneForPhase(0, 'preview');
        turnOn(previewScene || undefined).catch(console.error);
      }
    }
  }, [isStartedOverride, lightingConfig, bridgeAvailable, isLightingOn, getSceneForPhase, turnOn]);
  
  // Use the workout machine hook
  const { state, send, getRoundTiming } = useWorkoutMachineWithLighting({
    circuitConfig,
    roundsData,
    selections,
    sessionId,
    onWorkoutComplete: () => {
      // Clear current phase when workout completes
      setCurrentPhase(null, null);
      // Stop music when workout completes
      stopMusic();
      navigation.goBack();
    },
    isStartedOverride: false // Don't use automatic lighting in machine
  });
  
  // Handle phase changes manually
  useEffect(() => {
    // console.log('[CircuitLive] Phase change effect:', {
    //   stateValue: state.value,
    //   roundIndex: state.context.currentRoundIndex,
    //   isLightingOn,
    //   isLightingEnabled
    // });
    
    if (!isLightingOn || !isLightingEnabled) return;
    
    const roundTiming = getRoundTiming(state.context.currentRoundIndex);
    let phaseType = state.value;
    
    if (state.value === 'roundPreview') {
      phaseType = 'preview';
    } else if (state.value === 'exercise') {
      // For exercise state, include the exercise/station index in the phase type
      const roundTiming = getRoundTiming(state.context.currentRoundIndex);
      if (roundTiming.roundType === 'stations_round') {
        phaseType = `work-station-${state.context.currentExerciseIndex}`;
      } else if (roundTiming.roundType === 'amrap_round') {
        // AMRAP uses simple 'work' phase
        phaseType = 'work';
      } else {
        phaseType = `work-exercise-${state.context.currentExerciseIndex}`;
      }
    } else if (state.value === 'rest') {
      // For rest state, include the exercise/station index it's resting after
      const roundTiming = getRoundTiming(state.context.currentRoundIndex);
      if (roundTiming.roundType === 'stations_round') {
        phaseType = `rest-after-station-${state.context.currentExerciseIndex}`;
      } else if (roundTiming.roundType === 'amrap_round') {
        // AMRAP uses simple 'rest' phase
        phaseType = 'rest';
      } else {
        phaseType = `rest-after-exercise-${state.context.currentExerciseIndex}`;
      }
    } else if (state.value === 'setBreak') {
      phaseType = 'roundBreak';
    }
    
    // Update current phase for config change tracking
    setCurrentPhase(state.context.currentRoundIndex, phaseType);
    
    const sceneId = getSceneForPhase(state.context.currentRoundIndex, phaseType);
    // console.log('[CircuitLive] Phase scene:', { phaseType, sceneId });
    
    if (sceneId) {
      activateScene(sceneId).catch(console.error);
    }
  }, [state.value, state.context.currentRoundIndex, state.context.currentExerciseIndex, isLightingOn, isLightingEnabled, activateScene, getSceneForPhase, setCurrentPhase, getRoundTiming]);

  const currentRoundTiming = getRoundTiming(state.context.currentRoundIndex);
  const currentRoundType = currentRoundTiming.roundType;
  const currentRound = state.context.rounds[state.context.currentRoundIndex];

  const handleStartWorkout = () => {
    send({ type: 'START_WORKOUT' });
    // Start music when workout begins
    startMusic();
  };

  // Auto-focus close button when modal opens, restore focus when modal closes
  useEffect(() => {
    if (isTeamsModalVisible && closeButtonRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else if (!isTeamsModalVisible && shouldRestoreFocusToTeams && teamsButtonRef.current) {
      // Restore focus to TEAMS button when modal closes
      setTimeout(() => {
        if (teamsButtonRef.current?.requestTVFocus) {
          teamsButtonRef.current.requestTVFocus();
        } else {
          teamsButtonRef.current?.focus();
        }
        setShouldRestoreFocusToTeams(false); // Reset flag
      }, 150);
    }
  }, [isTeamsModalVisible, shouldRestoreFocusToTeams]);

  // Focus BACK button on initial navigation
  useEffect(() => {
    if (state.value === 'roundPreview' && backButtonRef.current) {
      setTimeout(() => {
        if (backButtonRef.current?.requestTVFocus) {
          backButtonRef.current.requestTVFocus();
        } else {
          backButtonRef.current?.focus();
        }
      }, 100);
    }
  }, [state.value]);

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
                ref={backButtonRef}
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

            {/* RIGHT SIDE: Teams/Start Pair, Triple Controls for AMRAP/Circuit, or Spacer */}
            {state.context.currentRoundIndex === 0 && !state.context.isStarted ? (
              <View style={{ position: 'relative' }}>
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
                {/* Start Button */}
                <Pressable
                  onPress={handleStartWorkout}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ 
                          color: TOKENS.color.text, 
                          fontSize: 13, 
                          fontWeight: '700',
                          letterSpacing: 0.3,
                          textTransform: 'uppercase'
                        }}>
                          START
                        </Text>
                        <Icon name="play-arrow" size={18} color={TOKENS.color.text} />
                      </View>
                    </MattePanel>
                  )}
                </Pressable>
                
                {/* Lights Button - Icon Only for stations round */}
                {currentRoundType === 'stations_round' && (
                  <Pressable
                    onPress={async () => {
                      const newState = !isLightingEnabled;
                      setIsLightingEnabled(newState);
                      
                      try {
                        if (newState) {
                          // Get appropriate scene for current state
                          const phaseType = state.value === 'roundPreview' ? 'preview' : 'work';
                          const sceneId = getSceneForPhase(state.context.currentRoundIndex, phaseType);
                          await turnOn(sceneId || undefined);
                        } else {
                          await turnOff();
                          setCurrentPhase(null, null);
                        }
                      } catch (error) {
                        console.error('[CircuitLive] Failed to control lights:', error);
                      }
                    }}
                    focusable
                  >
                    {({ focused }) => (
                      <MattePanel 
                        focused={focused}
                        radius={26}
                        style={{ 
                          width: 52,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isLightingEnabled ? 
                            (focused ? 'rgba(0,183,194,0.2)' : 'rgba(0,183,194,0.1)') :
                            (focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'),
                          borderColor: isLightingEnabled ? 
                            TOKENS.color.accent : 
                            (focused ? 'rgba(255,255,255,0.3)' : 'transparent'),
                          borderWidth: isLightingEnabled ? 1.5 : (focused ? 1.5 : 0),
                        }}
                      >
                        <Icon 
                          name={isLightingEnabled ? "lightbulb" : "lightbulb-outline"} 
                          size={22} 
                          color={isLightingEnabled ? TOKENS.color.accent : TOKENS.color.text}
                          style={{
                            shadowColor: isLightingEnabled ? TOKENS.color.accent : 'transparent',
                            shadowOpacity: isLightingEnabled ? 0.8 : 0,
                            shadowRadius: isLightingEnabled ? 15 : 0,
                            shadowOffset: { width: 0, height: 0 },
                          }}
                        />
                      </MattePanel>
                    )}
                  </Pressable>
                )}
                </View>
                {/* Lighting Config Badge */}
                {lightingConfig && currentRoundType === 'stations_round' && hasLightingForAnyPhase(0, ['preview']) && (
                  <View style={{
                    position: 'absolute',
                    bottom: -22,
                    right: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.7)',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                      AUTO
                    </Text>
                  </View>
                )}
              </View>
            ) : (currentRoundType === 'amrap_round' || currentRoundType === 'circuit_round' || currentRoundType === 'stations_round') ? (
              // Triple button controls for AMRAP, Circuit, and Stations round preview: TEAMS | PAUSE | SKIP
              <View style={{ position: 'relative' }}>
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
                
                {/* Lighting Control for AMRAP/Circuit preview */}
                <Pressable
                  onPress={async () => {
                    const newState = !isLightingEnabled;
                    setIsLightingEnabled(newState);
                    
                    try {
                      if (newState) {
                        const phaseType = 'preview';
                        const sceneId = getSceneForPhase(state.context.currentRoundIndex, phaseType);
                        await turnOn(sceneId || undefined);
                      } else {
                        await turnOff();
                        setCurrentPhase(null, null);
                      }
                    } catch (error) {
                      console.error('[CircuitLive] Failed to control lights:', error);
                    }
                  }}
                  focusable
                >
                  {({ focused }) => (
                    <MattePanel 
                      focused={focused}
                      radius={26}
                      style={{ 
                        width: 52,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isLightingEnabled ? 
                          (focused ? 'rgba(0,183,194,0.2)' : 'rgba(0,183,194,0.1)') :
                          (focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'),
                        borderColor: isLightingEnabled ? 
                          TOKENS.color.accent : 
                          (focused ? 'rgba(255,255,255,0.3)' : 'transparent'),
                        borderWidth: isLightingEnabled ? 1.5 : (focused ? 1.5 : 0),
                      }}
                    >
                      <Icon 
                        name={isLightingEnabled ? "lightbulb" : "lightbulb-outline"} 
                        size={22} 
                        color={isLightingEnabled ? TOKENS.color.accent : TOKENS.color.text}
                        style={{
                          shadowColor: isLightingEnabled ? TOKENS.color.accent : 'transparent',
                          shadowOpacity: isLightingEnabled ? 0.8 : 0,
                          shadowRadius: isLightingEnabled ? 15 : 0,
                          shadowOffset: { width: 0, height: 0 },
                        }}
                      />
                    </MattePanel>
                  )}
                </Pressable>
                </View>
                {/* Lighting Config Badge */}
                {lightingConfig && hasLightingForAnyPhase(state.context.currentRoundIndex, ['preview']) && (
                  <View style={{
                    position: 'absolute',
                    bottom: -22,
                    right: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.7)',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                      AUTO
                    </Text>
                  </View>
                )}
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
            paddingTop: currentRoundType === 'stations_round' ? 5 : 20,
            paddingBottom: currentRoundType === 'stations_round' ? 5 : 20,
            marginBottom: currentRoundType === 'stations_round' ? 30 : 0,
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
                top: currentRoundType === 'stations_round' ? -25 : -15,
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
              isLightingEnabled={isLightingEnabled}
              lightingConfig={lightingConfig}
              onToggleLighting={async () => {
                if (!lightingConfig) return;
                
                const newState = !isLightingEnabled;
                setIsLightingEnabled(newState);
                
                try {
                  if (newState) {
                    // Get appropriate scene for current state
                    const phaseType = state.value === 'exercise' ? 'work' : 
                                    state.value === 'rest' ? 'rest' : 
                                    state.value === 'setBreak' ? 'rest' : 'preview';
                    const sceneId = getSceneForPhase(state.context.currentRoundIndex, phaseType);
                    await turnOn(sceneId || undefined);
                  } else {
                    await turnOff();
                    setCurrentPhase(null, null);
                  }
                } catch (error) {
                  console.error('[CircuitLive] Failed to control lights:', error);
                }
              }}
              hasLightingForCurrentView={(() => {
                if (!lightingConfig) return false;
                
                // Get the current phase based on current state
                let currentPhase = state.value;
                
                if (state.value === 'roundPreview') {
                  currentPhase = 'preview';
                } else if (state.value === 'exercise') {
                  // For exercise state, handle different round types
                  const roundTiming = getRoundTiming(state.context.currentRoundIndex);
                  if (roundTiming.roundType === 'stations_round') {
                    currentPhase = `work-station-${state.context.currentExerciseIndex}`;
                  } else if (roundTiming.roundType === 'amrap_round') {
                    // AMRAP uses simple 'work' phase
                    currentPhase = 'work';
                  } else {
                    currentPhase = `work-exercise-${state.context.currentExerciseIndex}`;
                  }
                } else if (state.value === 'rest') {
                  // For rest state, handle different round types
                  const roundTiming = getRoundTiming(state.context.currentRoundIndex);
                  if (roundTiming.roundType === 'stations_round') {
                    currentPhase = `rest-after-station-${state.context.currentExerciseIndex}`;
                  } else if (roundTiming.roundType === 'amrap_round') {
                    // AMRAP uses simple 'rest' phase
                    currentPhase = 'rest';
                  } else {
                    currentPhase = `rest-after-exercise-${state.context.currentExerciseIndex}`;
                  }
                } else if (state.value === 'setBreak') {
                  currentPhase = 'roundBreak';
                }
                
                // Check if this specific phase has lighting configured
                const scene = getSceneForPhase(state.context.currentRoundIndex, currentPhase);
                console.log('[WorkoutControls] Checking lighting for phase:', currentPhase, 'scene:', scene);
                return scene !== null;
              })()}
            />
          </View>

          {/* Sets Badge for Stations (positioned at bottom) */}
          {currentRoundType === 'stations_round' && currentRoundTiming.repeatTimes > 1 && (state.value === 'exercise' || state.value === 'rest') && (
            <View style={{
              position: 'absolute',
              bottom: 12,
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
          <View style={{ flex: 1, paddingHorizontal: 48, paddingBottom: currentRoundType === 'stations_round' ? 24 : 48 }}>
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
            {(() => {
              // Get actual station count from current round  
              const stationCount = currentRound?.exercises 
                ? [...new Set(currentRound.exercises.map(ex => ex.orderIndex))].length 
                : 0;
              
              // Calculate responsive grid layout (same logic as StationsExerciseView)
              const getGridLayout = (count: number) => {
                if (count <= 4) {
                  return { rows: 1, cols: count };
                } else if (count === 5) {
                  return { rows: 2, cols: 3 }; // 3 top, 2 bottom
                } else if (count === 6) {
                  return { rows: 2, cols: 3 }; // 3-3
                } else if (count === 7) {
                  return { rows: 2, cols: 4 }; // 4 top, 3 bottom
                } else if (count === 8) {
                  return { rows: 2, cols: 4 }; // 4-4
                }
                return { rows: 2, cols: 4 }; // Default for 8+ stations
              };
              
              const { rows, cols } = getGridLayout(stationCount);
              const isMultiRow = rows > 1;
              
              return (
                <>
                  {/* Dynamic Station Grid with Beautiful Styling */}
                  <View style={{
                    paddingHorizontal: 48,
                  }}>
                    <View style={{ 
                      gap: 2, 
                      minHeight: 280,
                      justifyContent: isMultiRow ? 'flex-start' : 'center'
                    }}>
                      {(() => {
                        // Group stations into rows
                        const getStationRows = () => {
                  const stations = Array.from({ length: stationCount }, (_, i) => i + 1);
                  
                  if (!isMultiRow) {
                    return [stations];
                  }
                  
                  const stationsInFirstRow = stationCount === 5 ? 3 : cols;
                  const firstRow = stations.slice(0, stationsInFirstRow);
                  const secondRow = stations.slice(stationsInFirstRow);
                  
                  return [firstRow, secondRow];
                };
                
                const stationRows = getStationRows();
                
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
                
                // Use the pre-calculated distribution (set when modal opens)
                
                        return (
                          <View style={{ 
                            gap: 2, 
                            minHeight: 280,
                            justifyContent: isMultiRow ? 'flex-start' : 'center'
                          }}>
                            {stationRows.map((row, rowIndex) => (
                              <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: 2 }}>
                                {row.map((stationNumber, colIndex) => {
                          const team = TEAMS[stationNumber - 1];
                          const teamIndex = stationNumber - 1;
                          const teamClients = teamsDistribution.get(teamIndex) || [];
                          
                          // Calculate corner radius based on position
                          const isFirstRow = rowIndex === 0;
                          const isLastRow = rowIndex === stationRows.length - 1;
                          const isFirstCol = colIndex === 0;
                          const isLastCol = colIndex === row.length - 1;
                          
                          return (
                            <View 
                              key={stationNumber}
                              style={{
                                flex: 1,
                                backgroundColor: TOKENS.color.cardGlass,
                                borderTopLeftRadius: (isFirstRow && isFirstCol) ? 16 : 0,
                                borderTopRightRadius: (isFirstRow && isLastCol) ? 16 : 0,
                                borderBottomLeftRadius: (isLastRow && isFirstCol) ? 16 : 0,
                                borderBottomRightRadius: (isLastRow && isLastCol) ? 16 : 0,
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
                                padding: 16,
                                paddingTop: 20,
                              }}>
                                {/* Team Badge with Station Badge */}
                                <View style={{ marginBottom: 20 }}>
                                  <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}>
                                    {/* Team Badge */}
                                    <View style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}>
                                      <View style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 5,
                                        backgroundColor: team.color,
                                      }} />
                                      <Text style={{ 
                                        color: team.color, 
                                        fontWeight: '800',
                                        fontSize: 12,
                                        letterSpacing: 0.3,
                                        textTransform: 'uppercase',
                                      }}>
                                        {team.name}
                                      </Text>
                                    </View>
                                    
                                    {/* Station Badge */}
                                    <View style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                      backgroundColor: 'rgba(255, 255, 255, 0.20)',
                                      borderColor: 'rgba(255, 255, 255, 0.4)',
                                      borderWidth: 1,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                      <Text style={{
                                        fontSize: 12,
                                        fontWeight: '800',
                                        color: TOKENS.color.text,
                                        letterSpacing: 0.2,
                                      }}>
                                        S{stationNumber}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                                
                                {/* Client List */}
                                <View style={{ gap: 6 }}>
                                  {teamClients.length > 0 ? (
                                    teamClients.map((client: any, clientIndex: number) => (
                                      <Text 
                                        key={clientIndex}
                                        style={{
                                          fontSize: 14,
                                          fontWeight: '700',
                                          color: TOKENS.color.text,
                                        }}
                                      >
                                        {client.userName?.split(' ')[0] || client.userEmail?.split('@')[0] || 'Client'}
                                      </Text>
                                    ))
                                  ) : (
                                    <Text 
                                      style={{
                                        fontSize: 14,
                                        fontWeight: '600',
                                        color: TOKENS.color.muted,
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      No clients
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                                  );
                                })}
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Single Auto-Focused Close Button */}
                  <View style={{
                    alignItems: 'center',
                    marginTop: isMultiRow ? 32 : 24,
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
                </>
              );
            })()}
          </MattePanel>
        </TVFocusGuideView>
      )}
    </View>
  );
}