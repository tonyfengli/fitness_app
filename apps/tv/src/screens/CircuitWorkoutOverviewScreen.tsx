import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeExerciseSwaps, useRealtimeCircuitConfig, useRealtimeCircuitExercises } from '@acme/ui-shared';
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
  stationIndex?: number; // For grouping exercises at same station
}

interface RoundData {
  roundName: string;
  exercises: CircuitExercise[];
  roundType?: 'circuit_round' | 'stations_round' | 'amrap_round' | 'warmup_round';
  workDuration?: number;
  restDuration?: number;
  totalDuration?: number; // For AMRAP
  repeatTimes?: number; // For circuit/stations rounds
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

// Helper to group exercises by station for station rounds
function groupExercisesByStation(exercises: CircuitExercise[]): Map<number, CircuitExercise[]> {
  const stationMap = new Map<number, CircuitExercise[]>();
  
  exercises.forEach(exercise => {
    // Group by orderIndex - exercises with same orderIndex belong to same station
    const stationKey = exercise.orderIndex;
    if (!stationMap.has(stationKey)) {
      stationMap.set(stationKey, []);
    }
    stationMap.get(stationKey)!.push(exercise);
  });
  
  // Sort stations by their key and exercises within each station by stationIndex
  const sortedStationMap = new Map(
    Array.from(stationMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([key, exercises]) => [
        key,
        exercises.sort((a, b) => {
          // Sort by stationIndex within each station
          const aIndex = a.stationIndex ?? 0;
          const bIndex = b.stationIndex ?? 0;
          return aIndex - bIndex;
        })
      ])
  );
  
  console.log('[TV-CircuitOverview] Station groups after grouping:', {
    stationCount: sortedStationMap.size,
    stations: Array.from(sortedStationMap.entries()).map(([orderIndex, exercises]) => ({
      orderIndex,
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => ({
        name: ex.exerciseName,
        stationIndex: ex.stationIndex,
        orderIndex: ex.orderIndex
      }))
    }))
  });
  
  return sortedStationMap;
}

// Component to render round content with exercise overflow handling
function RoundContent({ round, isCompact }: { 
  round: RoundData; 
  isCompact: boolean;
}) {
  const maxExercises = 6;
  
  // For non-compact mode, show all exercises (no limit)
  // For compact mode, limit to maxExercises
  const hasOverflow = isCompact && round.exercises.length > maxExercises;
  const exercisesToShow = hasOverflow ? round.exercises.slice(0, maxExercises) : round.exercises;
  const overflowCount = round.exercises.length - maxExercises;
  
  // Column logic:
  // - Compact mode: use columns if 4+ exercises (existing logic)
  // - Non-compact mode: use columns if >6 exercises (new edge case)
  const shouldUseColumns = (isCompact && exercisesToShow.length >= 4) || 
                          (!isCompact && exercisesToShow.length > 6);
  
  
  // Adjust font sizes based on compact mode
  const getTitleSize = () => isCompact ? 20 : 24;
  const getExerciseSize = () => isCompact ? 15 : 18;
  
  // Special handling for station rounds
  const isStationRound = round.roundType === 'stations_round';
  const stationGroups = isStationRound ? groupExercisesByStation(round.exercises) : null;
  
  
  // Render exercises in columns for compact mode with 4+ exercises
  const renderExercises = () => {
    // For station rounds, show grouped display
    if (isStationRound && stationGroups) {
      const stations = Array.from(stationGroups.entries()).sort((a, b) => a[0] - b[0]);
      
      console.log(`[TV-CircuitOverview] Rendering stations for ${round.roundName}:`, {
        totalStations: stations.length,
        stations: stations.map(([orderIndex, exercises], idx) => ({
          stationNumber: idx + 1,
          orderIndex,
          exerciseCount: exercises.length,
          exercises: exercises.map(ex => ({
            name: ex.exerciseName,
            orderIndex: ex.orderIndex,
            stationIndex: ex.stationIndex
          }))
        }))
      });
      
      const maxStations = 4;
      const stationsToShow = stations.slice(0, maxStations);
      const hasStationOverflow = stations.length > maxStations;
      
      // Always use single column for stations (max 4)
      const shouldUseStationColumns = false;
      
      // Base font size - will be adjusted per-station based on line usage
      const stationCount = stationsToShow.length;
      const getStationFontSize = () => {
        if (!isCompact) return 17; // Decreased by 3% from 18 (net 15% reduction from original 20)
        if (stationCount <= 3) return 16;
        return 14; // Base size for 4 stations
      };
      
      const getStationGap = () => {
        if (!isCompact) return 20;
        if (stationCount <= 3) return 12;
        return 8; // Tighter spacing for 4 stations
      };
      
      // Helper function to truncate exercise name based on exercise count
      const truncateExerciseName = (name: string, exerciseCount: number): string => {
        let maxLength: number;
        
        // More generous limits for non-compact (one-row) layout
        if (!isCompact) {
          switch (exerciseCount) {
            case 1:
              maxLength = 50; // Very generous for single exercise
              break;
            case 2:
              maxLength = 25; // Good space for two exercises
              break;
            case 3:
              maxLength = 18; // Reasonable for three
              break;
            default:
              maxLength = 14; // Still workable for 4+
          }
        } else {
          // Original limits for compact mode
          switch (exerciseCount) {
            case 1:
              maxLength = 35;
              break;
            case 2:
              maxLength = 18;
              break;
            case 3:
              maxLength = 12;
              break;
            default:
              maxLength = 10;
          }
        }
        
        if (name.length <= maxLength) return name;
        
        // Find the last space before or at maxLength
        const truncated = name.substring(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        
        // If we found a space, cut at the word boundary
        if (lastSpaceIndex > 0) {
          return name.substring(0, lastSpaceIndex);
        }
        
        // If no space found (single long word), try to fit more by looking ahead
        const nextSpaceIndex = name.indexOf(' ', maxLength);
        if (nextSpaceIndex === -1 || nextSpaceIndex > maxLength + 3) {
          // If next space is far away or doesn't exist, just return what we have
          return truncated;
        }
        
        // If the next word is short (≤3 chars), include it
        const nextWord = name.substring(maxLength, nextSpaceIndex);
        if (nextWord.length <= 3) {
          return name.substring(0, nextSpaceIndex);
        }
        
        return truncated;
      };
      
      // Helper function to render a single station
      const renderStation = ([stationIndex, stationExercises]: [number, CircuitExercise[]], idx: number) => {
        const stationNumber = idx + 1; // Use the array index for sequential numbering
        const exerciseCount = stationExercises.length;
        
        // Truncate each exercise name individually
        const truncatedNames = stationExercises.map(e => 
          truncateExerciseName(e.exerciseName, exerciseCount)
        );
        const exerciseNames = truncatedNames.join(', ');
        const fullText = `S${stationNumber}: ${exerciseNames}`;
        
        // Determine if text would wrap to 2 lines
        // This is a heuristic based on character count and typical TV screen width
        const estimatedCharsPerLine = isCompact ? 40 : 65; // More chars for one-row layout
        const wouldWrap = fullText.length > estimatedCharsPerLine;
        
        // Use smaller font size only if text would actually use 2 lines
        const fontSize = wouldWrap && !isCompact ? getStationFontSize() * 0.85 : getStationFontSize();
        
        return (
          <Text
            key={stationIndex}
            style={{
              fontSize,
              color: TOKENS.color.text,
              lineHeight: fontSize * 1.4, // Proportional line height
            }}
            numberOfLines={isCompact ? 1 : 2} // Allow 2 lines in non-compact mode
            ellipsizeMode="tail"
          >
            {fullText}
          </Text>
        );
      };
      
      if (shouldUseStationColumns) {
        // Split stations into two columns
        const midPoint = Math.ceil(stationsToShow.length / 2);
        const leftColumnStations = stationsToShow.slice(0, midPoint);
        const rightColumnStations = stationsToShow.slice(midPoint);
        
        return (
          <View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {/* Left column */}
              <View style={{ flex: 1, gap: 12 }}>
                {leftColumnStations.map((station, idx) => renderStation(station, idx))}
              </View>
              
              {/* Right column */}
              <View style={{ flex: 1, gap: 12 }}>
                {rightColumnStations.map((station, idx) => renderStation(station, leftColumnStations.length + idx))}
              </View>
            </View>
            
            {hasStationOverflow && (
              <Text style={{
                fontSize: isCompact ? 15 : 16,
                color: TOKENS.color.muted,
                fontStyle: 'italic',
                marginTop: isCompact ? 12 : 16,
              }}>
                ... and {stations.length - maxStations} more stations
              </Text>
            )}
          </View>
        );
      } else {
        // Always single column layout for stations
        return (
          <View style={{ gap: getStationGap() }}>
            {stationsToShow.map((station, idx) => renderStation(station, idx))}
            {hasStationOverflow && (
              <Text style={{
                fontSize: isCompact ? 15 : 16,
                color: TOKENS.color.muted,
                fontStyle: 'italic',
              }}>
                ... and {stations.length - maxStations} more stations
              </Text>
            )}
          </View>
        );
      }
    }
    
    if (shouldUseColumns) {
      const midPoint = Math.ceil(exercisesToShow.length / 2);
      const leftColumn = exercisesToShow.slice(0, midPoint);
      const rightColumn = exercisesToShow.slice(midPoint);
      
      // Use different spacing for non-compact mode
      const columnGap = isCompact ? 16 : 24;
      const exerciseGap = isCompact ? 12 : 20;
      
      return (
        <View style={{ flexDirection: 'row', gap: columnGap }}>
          {/* Left column */}
          <View style={{ flex: 1, gap: exerciseGap }}>
            {leftColumn.map((exercise) => (
              <Text 
                key={exercise.id} 
                style={{ 
                  fontSize: getExerciseSize(),
                  color: TOKENS.color.text,
                  lineHeight: getExerciseSize() * 1.2,
                  textAlign: isCompact ? 'left' : 'center',
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {exercise.exerciseName}
              </Text>
            ))}
          </View>
          
          {/* Right column */}
          <View style={{ flex: 1, gap: exerciseGap }}>
            {rightColumn.map((exercise) => (
              <Text 
                key={exercise.id} 
                style={{ 
                  fontSize: getExerciseSize(),
                  color: TOKENS.color.text,
                  lineHeight: getExerciseSize() * 1.2,
                  textAlign: isCompact ? 'left' : 'center',
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
      <View style={{ gap: isCompact ? 12 : 20, alignItems: 'center' }}>
        {exercisesToShow.map((exercise) => (
          <Text 
            key={exercise.id} 
            style={{ 
              fontSize: getExerciseSize(),
              color: TOKENS.color.text,
              lineHeight: getExerciseSize() * 1.2,
              textAlign: 'center',
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
  
  // Format round type info - returns object with type and timing
  const getRoundTypeInfo = () => {
    if (!round.roundType) return null;
    
    switch (round.roundType) {
      case 'circuit_round':
        return {
          type: 'Circuit',
          timing: `${round.workDuration ?? 45}/${round.restDuration ?? 15}s`
        };
      case 'stations_round':
        return {
          type: 'Stations',
          timing: `${round.workDuration ?? 60}/${round.restDuration ?? 15}s`
        };
      case 'amrap_round':
        const minutes = round.totalDuration ? Math.floor(round.totalDuration / 60) : 5;
        return {
          type: 'AMRAP',
          timing: `${minutes}min`
        };
      case 'warmup_round':
        return {
          type: 'Warmup',
          timing: `${round.workDuration ?? 30}s`
        };
      default:
        return null;
    }
  };
  
  const roundInfo = getRoundTypeInfo();
  
  return (
    <View style={{ flex: 1 }}>
        <View style={{ 
          position: 'relative',
          marginBottom: isCompact ? 16 : 16,
          paddingTop: isCompact ? 0 : 28,
          alignItems: isCompact && round.roundType !== 'warmup_round' && !round.roundName.toLowerCase().includes('warm') ? 'flex-start' : 'center',
          paddingRight: isCompact && round.roundType !== 'warmup_round' && !round.roundName.toLowerCase().includes('warm') ? 50 : 0,
        }}>
        <Text style={{ 
          fontSize: getTitleSize(), 
          fontWeight: '700', 
          color: TOKENS.color.text,
        }}>
          {round.roundName}
        </Text>
        {roundInfo && round.roundType !== 'warmup_round' && !round.roundName.toLowerCase().includes('warm') && (
          <View style={{ 
            position: 'absolute',
            right: -8,
            top: -8,
            backgroundColor: TOKENS.color.accent + '15',
            borderWidth: 1,
            borderColor: TOKENS.color.accent + '30',
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
          }}>
            <Text style={{ 
              fontSize: isCompact ? 10 : 11, 
              color: TOKENS.color.accent,
              fontWeight: '600',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {roundInfo.type}
            </Text>
            <Text style={{ 
              fontSize: isCompact ? 12 : 13, 
              color: TOKENS.color.accent,
              fontWeight: '700',
            }}>
              {roundInfo.timing}
            </Text>
          </View>
        )}
      </View>
      
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {renderExercises()}
        
        {hasOverflow && !isStationRound && (
          <View style={{ 
            marginTop: isCompact ? 12 : 16,
            paddingTop: isCompact ? 12 : 16,
            borderTopWidth: 1,
            borderTopColor: TOKENS.color.borderGlass,
            alignItems: 'center',
          }}>
            <Text style={{ 
              fontSize: isCompact ? 15 : 16,
              color: TOKENS.color.muted,
              fontStyle: 'italic',
              textAlign: 'center',
            }}>
              ... and {overflowCount} more
            </Text>
          </View>
        )}
      </View>
      
      {/* Repeat indicator for circuit/stations rounds */}
      {(round.roundType === 'circuit_round' || round.roundType === 'stations_round') && 
       round.repeatTimes && round.repeatTimes > 1 && (
        <View style={{
          position: 'absolute',
          right: isCompact ? -12 : -12, // Moved right by 5% (from 0 to -12)
          bottom: isCompact ? -22 : -12, // Moved down by 5% (from 0 to -12)
          backgroundColor: TOKENS.color.accent2 + '15',
          borderWidth: 1,
          borderColor: TOKENS.color.accent2 + '30',
          borderRadius: isCompact ? 4 : 6,
          paddingHorizontal: isCompact ? 8 : 14,
          paddingVertical: isCompact ? 3 : 6,
        }}>
          <Text style={{
            fontSize: isCompact ? 11 : 16,
            color: TOKENS.color.accent2,
            fontWeight: '700',
            letterSpacing: 0.5,
          }}>
            {round.repeatTimes}×
          </Text>
        </View>
      )}
    </View>
  );
}

export function CircuitWorkoutOverviewScreen() {
  // DEBUG: Log when this screen mounts to see if other realtime works
  useEffect(() => {
    console.log('[CircuitWorkoutOverviewScreen] Component mounted, checking realtime connections...');
    const channels = supabase.getChannels();
    console.log('[CircuitWorkoutOverviewScreen] Active channels:', {
      count: channels.length,
      channels: channels.map(ch => ({
        topic: ch.topic,
        state: ch.state
      }))
    });
  }, []);
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const isStartedOverride = navigation.getParam('isStartedOverride') || false;
  
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
      // Exercise swap detected
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
    }
  });
  
  // Real-time circuit config updates
  useRealtimeCircuitConfig({
    sessionId: sessionId || '',
    supabase,
    onConfigUpdate: (update) => {
      // Invalidate the circuit config query to refetch latest data
      queryClient.invalidateQueries({
        queryKey: api.circuitConfig.getBySession.queryOptions({ 
          sessionId: sessionId || '' 
        }).queryKey
      });
    },
    onError: (error) => {
      console.error('[CircuitWorkoutOverviewScreen] Real-time circuit config error:', error);
    }
  });
  
  // Real-time circuit exercise updates (including deletions)
  const { isConnected: exerciseUpdatesConnected } = useRealtimeCircuitExercises({
    sessionId: sessionId || '',
    supabase,
    onExerciseUpdate: (update) => {
      // Invalidate the selections query to refetch latest data
      queryClient.invalidateQueries({
        queryKey: api.workoutSelections.getSelections.queryOptions({ 
          sessionId: sessionId || '' 
        }).queryKey
      });
      
      // Update connection state to show activity
      setLastSuccessfulFetch(new Date());
    },
    onError: (error) => {
      console.error('[CircuitWorkoutOverviewScreen] Real-time exercise error:', error);
    }
  });
  
  // Set up polling for exercise selections (10 second interval)
  // For circuits, we can query without clientId to get all, then deduplicate
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading, error: selectionsError, dataUpdatedAt } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
    onSuccess: (data) => {
      console.log('[TV-CircuitOverview] Selections query success:', {
        timestamp: new Date().toISOString(),
        dataUpdatedAt: new Date(dataUpdatedAt).toISOString(),
        selectionsCount: data?.length || 0
      });
    }
  });
  
  // Process selections into rounds
  useEffect(() => {
    if (selections && selections.length > 0) {
      // Processing workout selections
      console.log('[TV-CircuitOverview] Raw selections from backend:', {
        totalCount: selections.length,
        selections: selections.map(sel => ({
          id: sel.id.slice(-8),
          exerciseName: sel.exerciseName,
          orderIndex: sel.orderIndex,
          stationIndex: sel.stationIndex,
          groupName: sel.groupName,
          clientId: sel.clientId ? sel.clientId.slice(-8) : null
        }))
      });
      
      // Process all exercises without deduplication to allow duplicates
      const allExercises: CircuitExercise[] = [];
      
      selections.forEach((selection) => {
        allExercises.push({
          id: selection.id,
          exerciseId: selection.exerciseId,
          exerciseName: selection.exerciseName,
          orderIndex: selection.orderIndex || 0,
          groupName: selection.groupName || 'Round 1',
          stationIndex: selection.stationIndex,
        });
      });
      
      // Processing exercises into rounds
      
      // Group by round
      const roundsMap = new Map<string, CircuitExercise[]>();
      allExercises.forEach((exercise) => {
        const round = exercise.groupName;
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(exercise);
      });
      
      // Organizing rounds
      
      // Sort exercises within each round and create final structure
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => {
          // Extract round number
          const roundNum = parseInt(roundName.match(/\d+/)?.[0] || '1');
          
          // Find the round template for this round
          const roundTemplate = circuitConfig?.config?.roundTemplates?.find(
            rt => rt.roundNumber === roundNum
          );
          
          const isStationsRound = roundTemplate?.template?.type === 'stations_round';
          
          console.log(`[TV-CircuitOverview] Processing ${roundName}:`, {
            roundNum,
            roundType: roundTemplate?.template?.type,
            isStationsRound,
            exerciseCount: exercises.length,
            exercises: exercises.map(ex => ({
              name: ex.exerciseName,
              orderIndex: ex.orderIndex,
              stationIndex: ex.stationIndex,
              id: ex.id.slice(-8)
            }))
          });
          
          // Extract timing information based on round type
          let roundData: RoundData = {
            roundName,
            exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex),
            roundType: roundTemplate?.template?.type as any
          };
          
          // Add timing info based on round type
          if (roundTemplate?.template) {
            const template = roundTemplate.template as any;
            if (template.type === 'circuit_round' || template.type === 'stations_round') {
              roundData.workDuration = template.workDuration ?? circuitConfig?.config?.workDuration;
              roundData.restDuration = template.restDuration ?? circuitConfig?.config?.restDuration;
              roundData.repeatTimes = template.repeatTimes;
              
            } else if (template.type === 'amrap_round') {
              roundData.totalDuration = template.totalDuration;
            }
          }
          
          return roundData;
        })
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
        // Repeat mode: showing only base rounds
      }
      
      // Rounds organized successfully
      
      
      setRoundsData(rounds);
      setConnectionState('connected');
      setLastSuccessfulFetch(new Date());
    }
  }, [selections, circuitConfig]);
  
  // Update connection state based on errors
  useEffect(() => {
    if (selectionsError && !selectionsLoading) {
      // Connection error detected
      setConnectionState('error');
    }
  }, [selectionsError, selectionsLoading]);
  
  const handleStartCircuit = async () => {
    // For circuit workouts, we don't need the complex workout generation
    // Just navigate to the live workout screen with isStarted override
    navigation.navigate('CircuitWorkoutLive', { sessionId, isStartedOverride });
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
            onPress={() => {
              navigation.navigate('SessionLobby', { sessionId });
            }}
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
                borderColor: focused ? 'rgba(124,255,181,0.6)' : TOKENS.color.borderGlass,
                borderWidth: focused ? 1 : 1,
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
          
          // Handle empty state - no workout selections yet
          if (totalRounds === 0) {
            return (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 32, color: TOKENS.color.muted, textAlign: 'center' }}>
                  No workout created yet
                </Text>
              </View>
            );
          }
          
          // Handle more than 6 rounds
          if (totalRounds > 6) {
            return (
              <View style={{ flex: 1, flexDirection: 'column', gap: 24 }}>
                {/* First Row - Rounds 1-3 */}
                <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(0, 3).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20, paddingBottom: 28 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                </View>
                
                {/* Second Row - Rounds 4-6 */}
                <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(3, 6).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20, paddingBottom: 28 }}>
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
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20, paddingBottom: 28 }}>
                      <RoundContent round={round} isCompact={true} />
                    </MattePanel>
                  ))}
                </View>
                
                {/* Bottom Row */}
                <View style={{ flex: 1.05, flexDirection: 'row', gap: 24 }}>
                  {roundsData.slice(topRowCount, topRowCount + bottomRowCount).map((round) => (
                    <MattePanel key={round.roundName} style={{ flex: 1, padding: 20, paddingBottom: 28 }}>
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