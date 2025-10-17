import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
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
          // Group exercises by orderIndex (station number)
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
          
          Array.from(stationGroups.entries())
            .sort(([a], [b]) => a - b) // Sort by orderIndex (station number)
            .forEach(([orderIndex, stationExercises]) => {
              // Sort exercises within station by stationIndex
              const sorted = stationExercises.sort((a, b) => {
                const aIdx = a.stationIndex ?? 0;
                const bIdx = b.stationIndex ?? 0;
                return aIdx - bIdx;
              });
              
              // Primary exercise (stationIndex 0 or lowest)
              const primary = { ...sorted[0]! };
              // Add secondary exercises (stationIndex > 0) as stationExercises array
              primary.stationExercises = sorted.slice(1);
              nestedExercises.push(primary);
            });
          
          console.log('[CircuitWorkoutLiveScreen] Stations grouping:', {
            totalExercises: sortedExercises.length,
            numberOfStations: nestedExercises.length,
            stationsDetail: nestedExercises.map((ex, idx) => ({
              station: idx + 1,
              primary: ex.exerciseName,
              secondaryCount: ex.stationExercises?.length || 0,
              orderIndex: ex.orderIndex,
              exercises: [ex.exerciseName, ...(ex.stationExercises?.map(e => e.exerciseName) || [])]
            }))
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
              disabled={false}
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
                    opacity: 1,
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
          <WorkoutHeader
            state={state}
            currentRound={currentRound}
            currentRoundType={currentRoundType}
          />
        )}
        
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
      <WorkoutContent 
        state={state}
        circuitConfig={circuitConfig}
        getRoundTiming={getRoundTiming}
      />

      {/* Bottom Controls */}
      <WorkoutControls state={state} send={send} />
    </View>
  );
}