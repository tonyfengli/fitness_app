import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps } from '@acme/ui-shared';
import { supabase } from '../lib/supabase';
import { useStartWorkout } from '../hooks/useStartWorkout';

// Design tokens - matching other screens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
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

// Matte panel helper component - matching other screens
function MattePanel({
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

interface CircuitExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  groupName: string; // "Round 1", "Round 2", etc.
}

interface RoundData {
  roundName: string;
  exercises: CircuitExercise[];
}

// Helper function to format time in 12-hour format with AM/PM
function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

// Component to render round content with exercise overflow handling
function RoundContent({ round, isCompact }: { 
  round: RoundData; 
  isCompact: boolean;
}) {
  const maxExercises = 6;
  const hasOverflow = round.exercises.length > maxExercises;
  const exercisesToShow = hasOverflow ? round.exercises.slice(0, maxExercises) : round.exercises;
  const overflowCount = round.exercises.length - maxExercises;
  
  // For compact mode (4-6+ rounds), use columns if 4+ exercises
  const shouldUseColumns = isCompact && exercisesToShow.length >= 4;
  
  // Adjust font sizes based on compact mode
  const getTitleSize = () => isCompact ? 20 : 28;
  const getExerciseSize = () => isCompact ? 16 : 20;
  
  // Render exercises in columns for compact mode with 4+ exercises
  const renderExercises = () => {
    if (shouldUseColumns) {
      const midPoint = Math.ceil(exercisesToShow.length / 2);
      const leftColumn = exercisesToShow.slice(0, midPoint);
      const rightColumn = exercisesToShow.slice(midPoint);
      
      return (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {/* Left column */}
          <View style={{ flex: 1, gap: 12 }}>
            {leftColumn.map((exercise) => (
              <Text 
                key={exercise.id} 
                style={{ 
                  fontSize: getExerciseSize(),
                  color: TOKENS.color.text,
                  lineHeight: getExerciseSize() * 1.2,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {exercise.exerciseName}
              </Text>
            ))}
          </View>
          
          {/* Right column */}
          <View style={{ flex: 1, gap: 12 }}>
            {rightColumn.map((exercise) => (
              <Text 
                key={exercise.id} 
                style={{ 
                  fontSize: getExerciseSize(),
                  color: TOKENS.color.text,
                  lineHeight: getExerciseSize() * 1.2,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {exercise.exerciseName}
              </Text>
            ))}
          </View>
        </View>
      );
    }
    
    // Single column for 1-3 exercises or non-compact mode
    return (
      <View style={{ gap: isCompact ? 12 : 20 }}>
        {exercisesToShow.map((exercise) => (
          <Text 
            key={exercise.id} 
            style={{ 
              fontSize: getExerciseSize(),
              color: TOKENS.color.text,
              lineHeight: getExerciseSize() * 1.2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {exercise.exerciseName}
          </Text>
        ))}
      </View>
    );
  };
  
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ 
        fontSize: getTitleSize(), 
        fontWeight: '700', 
        color: TOKENS.color.text,
        marginBottom: isCompact ? 16 : 24
      }}>
        {round.roundName}
      </Text>
      
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {renderExercises()}
        
        {hasOverflow && (
          <View style={{ 
            marginTop: isCompact ? 12 : 16,
            paddingTop: isCompact ? 12 : 16,
            borderTopWidth: 1,
            borderTopColor: TOKENS.color.borderGlass,
          }}>
            <Text style={{ 
              fontSize: isCompact ? 15 : 16,
              color: TOKENS.color.muted,
              fontStyle: 'italic'
            }}>
              ... and {overflowCount} more
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function CircuitWorkoutOverviewScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const queryClient = useQueryClient();
  const [lastSwapTime, setLastSwapTime] = useState<Date | null>(null);
  const { startWorkout, isGenerating, error: startWorkoutError, setError } = useStartWorkout();
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // Local state for exercises organized by round
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  
  // Get circuit config for timing display
  const { data: circuitConfig } = useQuery(
    sessionId ? api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }) : {
      enabled: false,
      queryKey: ['disabled-circuit-config'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Get session data to check template type
  const { data: sessionData, isLoading: sessionLoading } = useQuery(
    sessionId ? api.trainingSession.getById.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session-circuit-overview'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Use real-time exercise swap updates (for future use)
  const { isConnected: swapUpdatesConnected } = useRealtimeExerciseSwaps({
    sessionId: sessionId || '',
    supabase,
    onSwapUpdate: (swap) => {
      console.log('[TV CircuitWorkoutOverview] Exercise swap detected:', swap);
      setLastSwapTime(new Date());
      
      // Refetch exercise data
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as any[];
          return queryKey[0] && 
                 Array.isArray(queryKey[0]) && 
                 queryKey[0][0] === 'workoutSelections' && 
                 queryKey[0][1] === 'getSelections';
        }
      });
    },
    onError: (error) => {
      console.error('[TV CircuitWorkoutOverview] Real-time swap error:', error);
    }
  });
  
  // Set up polling for exercise selections (10 second interval)
  // For circuits, we can query without clientId to get all, then deduplicate
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading, error: selectionsError } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });
  
  // Process selections into rounds
  useEffect(() => {
    if (selections && selections.length > 0) {
      console.log('[CircuitWorkoutOverview] Processing selections:', selections.length);
      console.log('[CircuitWorkoutOverview] Raw selections:', selections);
      
      // For circuits, we should get exercises from just ONE client since they're all shared
      // Group exercises by exerciseId + groupName to eliminate duplicates
      const exerciseMap = new Map<string, CircuitExercise>();
      
      selections.forEach((selection) => {
        // Use exerciseId + groupName as unique key
        const key = `${selection.exerciseId}-${selection.groupName}`;
        
        // Only add if we haven't seen this exercise+round combination
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            id: selection.id,
            exerciseId: selection.exerciseId,
            exerciseName: selection.exerciseName,
            orderIndex: selection.orderIndex || 0,
            groupName: selection.groupName || 'Round 1',
          });
        }
      });
      
      console.log('[CircuitWorkoutOverview] Unique exercises found:', exerciseMap.size);
      
      // Group by round
      const roundsMap = new Map<string, CircuitExercise[]>();
      exerciseMap.forEach((exercise) => {
        const round = exercise.groupName;
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(exercise);
      });
      
      console.log('[CircuitWorkoutOverview] Rounds found:', Array.from(roundsMap.keys()));
      
      // Sort exercises within each round and create final structure
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => ({
          roundName,
          exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex)
        }))
        .sort((a, b) => {
          // Extract round numbers for sorting
          const aNum = parseInt(a.roundName.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.roundName.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
      
      // If repeat is enabled, only show the first half of rounds
      // (backend creates Round 1-4, then Round 5-8 for repeat)
      if (circuitConfig?.config?.repeatRounds) {
        const baseRoundCount = Math.floor(rounds.length / 2);
        rounds = rounds.slice(0, baseRoundCount);
        console.log('[CircuitWorkoutOverview] Repeat mode: showing only first', baseRoundCount, 'rounds');
      }
      
      console.log('[CircuitWorkoutOverview] Final rounds structure:', rounds);
      
      setRoundsData(rounds);
      setConnectionState('connected');
      setLastSuccessfulFetch(new Date());
    }
  }, [selections, circuitConfig]);
  
  // Update connection state based on errors
  useEffect(() => {
    if (selectionsError && !selectionsLoading) {
      console.log('[TV CircuitWorkoutOverview] Fetch error detected:', selectionsError);
      setConnectionState('error');
    }
  }, [selectionsError, selectionsLoading]);
  
  const handleStartCircuit = async () => {
    console.log('[CircuitWorkoutOverview] Starting circuit workout');
    // For circuit workouts, we don't need the complex workout generation
    // Just navigate to the live workout screen
    navigation.navigate('CircuitWorkoutLive', { sessionId });
  };
  
  if (sessionLoading || selectionsLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading circuit workout...</Text>
      </View>
    );
  }
  

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      {/* Top Bar with Back and Start buttons */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 16
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
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
              <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Back</Text>
            </MattePanel>
          )}
        </Pressable>
        
        <Pressable
          onPress={handleStartCircuit}
          focusable
          disabled={isGenerating || roundsData.length === 0}
        >
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 32,
                paddingVertical: 12,
                backgroundColor: focused ? 'rgba(124,255,181,0.2)' : TOKENS.color.card,
                borderColor: focused ? TOKENS.color.accent : TOKENS.color.borderGlass,
                borderWidth: 1,
                transform: focused ? [{ translateY: -1 }] : [],
                opacity: roundsData.length === 0 ? 0.5 : 1
              }}
            >
              <Text style={{ 
                color: focused ? TOKENS.color.accent : TOKENS.color.text, 
                fontSize: 18,
                fontWeight: focused ? '600' : '400'
              }}>
                {isGenerating ? 'Starting...' : 'Start Circuit'}
              </Text>
            </MattePanel>
          )}
        </Pressable>
      </View>
      
      {/* Main Content - Conditional Grid Layout */}
      <View style={{ flex: 1, paddingHorizontal: 48, paddingVertical: 24 }}>
        {(() => {
          const totalRounds = roundsData.length;
          
          // Handle more than 6 rounds
          if (totalRounds > 6) {
            return (
              <View style={{ flex: 1, flexDirection: 'column', gap: 24 }}>
                {/* First Row - Rounds 1-3 */}
                <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(0, 3).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                </View>
                
                {/* Second Row - Rounds 4-6 */}
                <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(3, 6).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                  
                  {/* Ellipsis card for remaining rounds */}
                  <MattePanel style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, color: TOKENS.color.muted }}>
                      ... and {totalRounds - 6} more
                    </Text>
                  </MattePanel>
                </View>
              </View>
            );
          }
          
          // Handle 4-6 rounds (two rows)
          if (totalRounds >= 4) {
            const topRowCount = totalRounds === 5 ? 3 : Math.ceil(totalRounds / 2);
            const bottomRowCount = totalRounds - topRowCount;
            
            return (
              <View style={{ flex: 1, flexDirection: 'column', gap: 24 }}>
                {/* Top Row */}
                <View style={{ flex: 1.05, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(0, topRowCount).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                </View>
                
                {/* Bottom Row */}
                <View style={{ flex: 1.05, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(topRowCount, topRowCount + bottomRowCount).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                  
                  {/* Add empty spacers if needed for alignment */}
                  {bottomRowCount < topRowCount && Array.from({ length: topRowCount - bottomRowCount }).map((_, index) => (
                    <View key={`spacer-${index}`} style={{ flex: 1 }} />
                  ))}
                </View>
              </View>
            );
          }
          
          // Handle 1-3 rounds (single row, maximized)
          return (
            <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
              {roundsData.map((round) => (
                <MattePanel key={round.roundName} style={{ flex: 1, padding: 24 }}>
                  <RoundContent round={round} isCompact={false} />
                </MattePanel>
              ))}
            </View>
          );
        })()}
      </View>
      
      {/* Bottom Bar - Connection Status and Repeat Indicator */}
      <View style={{ 
        paddingHorizontal: 48,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View 
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginRight: 2,
              backgroundColor: connectionState === 'connecting' ? '#9ca3af' :
                            connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowColor: connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }} 
          />
          <Text style={{ fontSize: 15, color: TOKENS.color.muted }}>
            {connectionState === 'connecting' ? 'Connecting...' :
             connectionState === 'connected' ? `Live - ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'connecting'}` :
             `Disconnected`}
          </Text>
        </View>
        
        {/* Repeat Indicator */}
        {circuitConfig?.config?.repeatRounds && (
          <Text style={{
            fontSize: 18,
            color: TOKENS.color.text,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.9,
          }}>
            REPEAT 2×
          </Text>
        )}
      </View>
      
      {/* Error Modal - Simple version */}
      {showErrorModal && startWorkoutError && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48
        }}>
          <MattePanel style={{ padding: 32, maxWidth: 600 }}>
            <Text style={{ fontSize: 24, color: TOKENS.color.text, marginBottom: 16 }}>
              Error Starting Workout
            </Text>
            <Text style={{ fontSize: 18, color: TOKENS.color.muted, marginBottom: 24 }}>
              {startWorkoutError}
            </Text>
            <Pressable
              onPress={() => setShowErrorModal(false)}
              focusable
            >
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    paddingHorizontal: 32,
                    paddingVertical: 12,
                    alignSelf: 'center'
                  }}
                >
                  <Text style={{ color: TOKENS.color.text, fontSize: 18 }}>OK</Text>
                </MattePanel>
              )}
            </Pressable>
          </MattePanel>
        </View>
      )}
    </View>
  );
}