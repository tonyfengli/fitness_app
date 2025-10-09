import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { 
  setHueLights, 
  getPresetForEvent, 
  startHealthCheck, 
  stopHealthCheck,
  startDriftAnimation,
  startBreatheAnimation,
  setPauseState,
  stopAnimation
} from '../lib/lighting';
import { getColorForPreset, getHuePresetForColor } from '../lib/lighting/colorMappings';
import { useSpotifySync } from '../hooks/useSpotifySync';
import type { CircuitConfig } from '@acme/db';
import { playCountdownSound } from '../lib/sound/countdown-sound';
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

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

interface CircuitExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  groupName: string;
  equipment?: string[] | null;
}

interface RoundData {
  roundName: string;
  exercises: CircuitExercise[];
}

type ScreenType = 'round-preview' | 'exercise' | 'rest';

export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Generate unique component instance ID
  const componentInstanceId = useRef(`cwl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  
  
  // State for rounds and navigation
  const [roundsData, setRoundsDataInternal] = useState<RoundData[]>([]);
  
  const setRoundsData = setRoundsDataInternal;
  
  const [currentRoundIndex, setCurrentRoundIndexInternal] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndexInternal] = useState(0);
  const [currentScreen, setCurrentScreenInternal] = useState<ScreenType>('round-preview');
  const [currentSetNumber, setCurrentSetNumber] = useState(1); // Track current set for stations rounds
  
  const setCurrentRoundIndex = setCurrentRoundIndexInternal;
  const setCurrentExerciseIndex = setCurrentExerciseIndexInternal;
  const setCurrentScreen = setCurrentScreenInternal;
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[CircuitWorkoutLive] Component unmounting:', {
        currentScreen,
        currentRoundIndex,
        instanceId: componentInstanceId.current
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  
  // Lighting state
  const [lastLightingEvent, setLastLightingEvent] = useState<string>('');
  const [isStarted, setIsStarted] = useState(false);
  
  
  // Ref to store current values for timer without causing re-renders
  const timerStateRef = useRef({
    currentScreen,
    currentRoundIndex,
    currentExerciseIndex,
    currentSetNumber,
    isPaused,
    setlist: null as any,
    playTrackAtPosition: null as any,
    roundsData: [] as RoundData[],
  });
  
  // Get circuit config for timing and Spotify device
  const { data: circuitConfig } = useQuery(
    sessionId ? api.circuitConfig.getBySession.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-circuit-config-live'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Helper function to get round-specific timing
  const getRoundTiming = useCallback((roundIndex: number) => {
    if (!circuitConfig?.config) {
      return {
        workDuration: 45,
        restDuration: 15,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const
      };
    }
    
    const { roundTemplates, workDuration = 45, restDuration = 15 } = circuitConfig.config;
    
    // If no roundTemplates, use legacy timing
    if (!roundTemplates || roundTemplates.length === 0) {
      return {
        workDuration,
        restDuration,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const
      };
    }
    
    // Find template for current round (roundTemplates are 1-indexed)
    const roundTemplate = roundTemplates.find(rt => rt.roundNumber === roundIndex + 1);
    
    
    if (!roundTemplate) {
      // Fallback to legacy timing
      return {
        workDuration,
        restDuration,
        restBetweenSets: 30,
        roundType: 'circuit_round' as const
      };
    }
    
    // Return round-specific timing
    const template = roundTemplate.template;
    if (template.type === 'circuit_round') {
      return {
        workDuration: template.workDuration ?? workDuration,
        restDuration: template.restDuration ?? restDuration,
        restBetweenSets: (template as any).restBetweenSets ?? 30, // Default 30s for set breaks
        roundType: 'circuit_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'stations_round') {
      // Stations now have their own timing
      return {
        workDuration: (template as any).workDuration ?? workDuration,
        restDuration: (template as any).restDuration ?? restDuration,
        roundType: 'stations_round' as const,
        repeatTimes: (template as any).repeatTimes || 1
      };
    } else if (template.type === 'amrap_round') {
      // AMRAP uses totalDuration from template
      const totalDuration = (template as any).totalDuration || 300; // Default 5 minutes
      return {
        workDuration: totalDuration,
        restDuration: 0,   // No rest in AMRAP
        roundType: 'amrap_round' as const
      };
    }
    
    // Default fallback
    return {
      workDuration,
      restDuration,
      roundType: 'circuit_round' as const
    };
  }, [circuitConfig]);
  
  // Get current round type and repeat times
  const currentRoundTiming = getRoundTiming(currentRoundIndex);
  const currentRoundType = currentRoundTiming.roundType;
  const currentRepeatTimes = currentRoundTiming.repeatTimes || 1;
  
  // Calculate which repeat we're currently on for circuit/stations rounds
  const getCurrentRepeatNumber = useCallback(() => {
    if ((currentRoundType !== 'stations_round' && currentRoundType !== 'circuit_round') || currentRepeatTimes <= 1) {
      return 1;
    }
    return currentSetNumber;
  }, [currentRoundType, currentRepeatTimes, currentSetNumber]);
  
  const currentRepeatNumber = getCurrentRepeatNumber();
  
  
  // Spotify integration with pre-selected device (auto-play disabled since music already playing from preferences screen)
  const { playTrackAtPosition, prefetchSetlistTracks, setlist, isConnected: spotifyConnectionState, refetchDevices } = useSpotifySync(sessionId, circuitConfig?.config?.spotifyDeviceId, { autoPlay: false });
  
  // Update ref when values change
  useEffect(() => {
    timerStateRef.current = {
      currentScreen,
      currentRoundIndex,
      currentExerciseIndex,
      currentSetNumber,
      isPaused,
      setlist,
      playTrackAtPosition,
      roundsData,
    };
  }, [currentScreen, currentRoundIndex, currentExerciseIndex, currentSetNumber, isPaused, setlist, playTrackAtPosition, roundsData]);
  
  // Get saved selections
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading, error: selectionsError } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    refetchInterval: 3000, // Poll every 3 seconds for reps_planned updates
    onError: (error) => {
      console.error('[CircuitWorkoutLive] Failed to load selections:', {
        error,
        sessionId,
        instanceId: componentInstanceId.current
      });
    }
  });
  
  
  // Prefetch tracks when setlist is available
  useEffect(() => {
    if (setlist && prefetchSetlistTracks) {
      prefetchSetlistTracks();
    }
  }, [setlist, prefetchSetlistTracks]);
  
  // Process selections into rounds
  useEffect(() => {
    if (selections && selections.length > 0) {
      
      // Process all exercises without deduplication to allow duplicates
      const allExercises: CircuitExercise[] = [];
      
      
      selections.forEach((selection, index) => {
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
          
          // For non-stations rounds, use regular sorting
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
      
      
      setRoundsData(rounds);
    }
  }, [selections, circuitConfig, getRoundTiming]);

  // Start health check on mount and cleanup on unmount
  useEffect(() => {
    startHealthCheck();
    return () => {
      stopHealthCheck();
      stopAnimation(); // Stop any running animations
      // Apply App Start color when leaving the workout screen
      getColorForPreset('app_start').then(color => {
        const preset = getHuePresetForColor(color);
        setHueLights(preset);
      });
    };
  }, []);

  
  // Handle phase changes for lighting and Spotify
  useEffect(() => {
    
    // Map current state to lighting event
    let lightingEvent = '';
    
    // Check for round preview (applies to all rounds)
    if (currentScreen === 'round-preview') {
      lightingEvent = 'round_preview';  // Round Preview lighting
    } else if (currentScreen === 'exercise') {
      lightingEvent = 'work';
      
    } else if (currentScreen === 'rest') {
      lightingEvent = 'rest';
    } else if (timeRemaining === 0 && isStarted && currentRoundIndex === roundsData.length - 1 && currentScreen === 'exercise') {
      // Only mark as complete when the last exercise finishes
      lightingEvent = 'cooldown';
    }
    
    
    // Only trigger if event changed
    if (lightingEvent && lightingEvent !== lastLightingEvent) {
      
      // Apply static preset (no animations)
      stopAnimation(); // Always stop any running animation
      getPresetForEvent('circuit', lightingEvent).then(preset => {
        if (preset) {
          setHueLights(preset);
        }
      });
      
      
      setLastLightingEvent(lightingEvent);
    }
  }, [currentScreen, timeRemaining, isStarted, lastLightingEvent, currentRoundIndex, roundsData.length, currentExerciseIndex]);


  // Handle pause state lighting
  useEffect(() => {
    if (isPaused) {
      setPauseState();
    }
  }, [isPaused]);

  // Timer management - optimized to prevent restarts
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Only start interval if time remaining and not paused
    if (timeRemaining > 0 && !timerStateRef.current.isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer reached 0, advance to next screen
            handleTimerComplete();
            return 0;
          }
          
          // Use ref values to avoid dependencies
          const { currentScreen: screen, currentRoundIndex: roundIdx, currentExerciseIndex: exerciseIdx } = timerStateRef.current;
          
          // Play countdown sound for rest periods when about to show 3 seconds
          if (screen === 'rest' && prev === 5) {
            // Trigger at 5 but play 250ms before 3 appears
            setTimeout(() => {
              playCountdownSound().catch(error => {
                console.error('[CircuitWorkoutLive] Failed to play countdown sound:', error);
              });
            }, 750); // Play 250ms before the display changes to 3
          }
          
          // Play countdown sound for round 2+ previews at 0:03
          if (screen === 'round-preview' && roundIdx > 0 && prev === 4) {
            // Play immediately when timer shows 3
            playCountdownSound().catch(error => {
              console.error('[CircuitWorkoutLive] Failed to play countdown sound:', error);
            });
          }
          
          // Start music early for round previews at 0:06
          if (screen === 'round-preview' && roundIdx > 0 && prev === 7) {
            
            // Get values from ref
            const { setlist: currentSetlist, playTrackAtPosition: playTrack } = timerStateRef.current;
            
            if (currentSetlist && playTrack) {
              const currentRoundMusic = currentSetlist.rounds?.[roundIdx];
              const hypeTrack = currentRoundMusic?.track1;
              
              if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
                // Calculate seek position: hype moment - 6 seconds
                const seekPositionMs = Math.max(0, (hypeTrack.hypeTimestamp - 6) * 1000);
                playTrack(hypeTrack.spotifyId, seekPositionMs);
              }
            }
          }
          
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRemaining > 0]); // Only restart when timer starts/stops
  
  // Handle pause/resume separately
  useEffect(() => {
    if (intervalRef.current && isPaused) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (!intervalRef.current && timeRemaining > 0 && !isPaused) {
      // Restart the interval
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          
          const { currentScreen: screen, currentRoundIndex: roundIdx } = timerStateRef.current;
          
          if (screen === 'rest' && prev === 5) {
            // Trigger at 5 but play 50ms before 3 appears
            setTimeout(() => {
              playCountdownSound().catch(error => {
                console.error('[CircuitWorkoutLive] Failed to play countdown sound:', error);
              });
            }, 950); // Play 50ms before the display changes to 3
          }
          
          // Play countdown sound for round 2+ previews at 0:03 (pause/resume effect)
          if (screen === 'round-preview' && roundIdx > 0 && prev === 4) {
            // Play immediately when timer shows 3
            playCountdownSound().catch(error => {
              console.error('[CircuitWorkoutLive] Failed to play countdown sound:', error);
            });
          }
          
          // Start music early for round previews at 0:06 (pause/resume effect)
          if (screen === 'round-preview' && roundIdx > 0 && prev === 7) {
            console.log('[MUSIC-DEBUG] Starting music early at 0:06 (pause timer)', {
              screen,
              roundIdx,
              timestamp: new Date().toISOString()
            });
            
            // Get values from ref
            const { setlist: currentSetlist, playTrackAtPosition: playTrack } = timerStateRef.current;
            
            if (currentSetlist && playTrack) {
              const currentRoundMusic = currentSetlist.rounds?.[roundIdx];
              const hypeTrack = currentRoundMusic?.track1;
              
              if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
                // Calculate seek position: hype moment - 6 seconds
                const seekPositionMs = Math.max(0, (hypeTrack.hypeTimestamp - 6) * 1000);
                playTrack(hypeTrack.spotifyId, seekPositionMs);
              }
            }
          }
          
          return prev - 1;
        });
      }, 1000);
    }
  }, [isPaused]);

  const handleTimerComplete = useCallback(() => {
    console.log('[CircuitWorkoutLive] Timer complete:', {
      currentScreen: timerStateRef.current.currentScreen,
      timeRemaining,
      instanceId: componentInstanceId.current
    });
    // Auto-advance to next screen (not a manual skip)
    handleNext(false);
  }, []);

  // Start Round 1 immediately
  const startRound1Immediately = useCallback(() => {
    setIsStarted(true); // Mark workout as started
    setCurrentScreen('exercise');
    const { workDuration } = getRoundTiming(0); // Round 1
    startTimer(workDuration);
    
    // Get values from ref
    const { setlist: currentSetlist, playTrackAtPosition: playTrack } = timerStateRef.current;
    
    // Start music immediately at hype timestamp
    if (currentSetlist && playTrack) {
      const currentRoundMusic = currentSetlist.rounds?.[0]; // Round 1
      const hypeTrack = currentRoundMusic?.track1;
      
      if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
        const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
        playTrack(hypeTrack.spotifyId, seekPositionMs);
      }
    }
  }, [getRoundTiming, startTimer]);

  // Start the first exercise with music
  const startFirstExercise = useCallback(() => {
    // Get values from ref to avoid stale closure issues
    const { 
      currentRoundIndex: roundIdx,
      setlist: currentSetlist,
      playTrackAtPosition: playTrack
    } = timerStateRef.current;
    
    // Sync music with exercise start using setlist
    if (currentSetlist && playTrack) {
      // Get the track for the current round
      const currentRoundMusic = currentSetlist.rounds?.[roundIdx];
      const hypeTrack = currentRoundMusic?.track1;
      
      
      if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
        // Start at the hype moment (music should already be playing from 0:06)
        // Only play if we're on round 1 (round 2+ starts early at 0:06)
        if (roundIdx === 0) {
          const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
          playTrack(hypeTrack.spotifyId, seekPositionMs);
        }
      } else {
      }
    } else {
    }
    
    // Check round type
    const { roundType, workDuration } = getRoundTiming(roundIdx);
    
    if (roundType === 'amrap_round') {
      // For AMRAP, just start the single long work timer
      setCurrentScreen('exercise');
      startTimer(workDuration);
      return;
    }
    
    
    // For Circuit/Stations rounds
    // For Round 1, use countdown instead
    if (roundIdx === 0) {
      startRound1Immediately();
      return;
    }
    
    // For Round 2+, music should already be playing from 0:06
    // Just start the exercise
    setCurrentScreen('exercise');
    startTimer(workDuration);
  }, [getRoundTiming, startRound1Immediately]);

  const startTimer = (duration: number) => {
    
    setTimeRemaining(duration);
    // Don't set isStarted here - it should only be set when actual workout rounds begin
  };

  const getCurrentRound = () => roundsData[currentRoundIndex];
  const getCurrentExercise = () => {
    const round = getCurrentRound();
    return round?.exercises[currentExerciseIndex];
  };

  const getTotalRounds = () => roundsData.length;

  const handleNext = useCallback((isManualSkip = true) => {
    // Get ALL values from ref to avoid stale closures
    const { 
      currentScreen: screen, 
      currentRoundIndex: roundIdx, 
      currentExerciseIndex: exerciseIdx,
      roundsData: rounds,
      setlist: currentSetlist,
      playTrackAtPosition: playTrack
    } = timerStateRef.current;
    
    
    const currentRound = rounds[roundIdx];
    if (!currentRound) {
      return;
    }

    // Reset lighting event to force re-application when navigating
    setLastLightingEvent('');

    if (screen === 'round-preview') {
      
      const currentRoundType = getRoundTiming(roundIdx).roundType;
      
      // For Round 2+, when MANUALLY skipping from preview, go directly to hype moment
      if (roundIdx > 0 && isManualSkip) {
        // Play hype track at the exact hype moment
        const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
        if (currentRoundMusic && playTrack) {
          const hypeTrack = currentRoundMusic.track1;
          if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
            const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
            playTrack(hypeTrack.spotifyId, seekPositionMs);
          }
        }
        
        // Start the exercise
        setCurrentScreen('exercise');
        const { workDuration } = getRoundTiming(roundIdx);
        startTimer(workDuration);
      } else {
        // Round 1 or natural timer progression - use the normal flow
        startFirstExercise();
      }
    } else if (screen === 'exercise') {
      const currentRoundType = getRoundTiming(roundIdx).roundType;
      
      if (currentRoundType === 'amrap_round') {
        // For AMRAP, when timer completes, go directly to next round or finish
        if (roundIdx < rounds.length - 1) {
          setCurrentRoundIndex(roundIdx + 1);
          setCurrentExerciseIndex(0);
          
          // Move to next round preview
          setCurrentScreen('round-preview');
          const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || 60;
          startTimer(restBetweenRounds);
        } else {
          // Workout complete
          getColorForPreset('app_start').then(color => {
            const preset = getHuePresetForColor(color);
            setHueLights(preset);
            console.log('[CircuitWorkoutLive] AMRAP complete, navigating back:', {
              instanceId: componentInstanceId.current  
            });
            navigation.goBack();
          });
        }
      } else {
        // Circuit or Stations round - normal exercise progression
        // Check if this is the last exercise in the round
        if (exerciseIdx === currentRound.exercises.length - 1) {
          // Last exercise of the round
          const roundTiming = getRoundTiming(roundIdx);
          const isStationsRound = roundTiming.roundType === 'stations_round';
          const isCircuitRound = roundTiming.roundType === 'circuit_round';
          const repeatTimes = roundTiming.repeatTimes || 1;
          const currentSet = timerStateRef.current.currentSetNumber;
          
          // Check if this is a stations or circuit round with more sets to do
          if ((isStationsRound || isCircuitRound) && currentSet < repeatTimes) {
            // More sets to do - go to rest screen for set break
            
            // Move to rest screen for set break
            setCurrentScreen('rest');
            const { restDuration, restBetweenSets } = roundTiming;
            
            // Use restBetweenSets for circuit set breaks, restDuration for stations (for now)
            const setBreakDuration = isCircuitRound && restBetweenSets ? restBetweenSets : restDuration;
            startTimer(setBreakDuration);
            
            // Keep the same music playing for the next set
            return;
          }
          
          // All sets complete for this round (or not a stations round)
          // Reset set number for next round
          setCurrentSetNumber(1);
          
          // Play REST track at round end
          const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
          if (currentRoundMusic && playTrack) {
            const restTrack = currentRoundMusic.track3;
            if (restTrack) {
              playTrack(restTrack.spotifyId, 0);
            } else {
            }
          }
          
          if (roundIdx < rounds.length - 1) {
            setCurrentRoundIndex(roundIdx + 1);
            setCurrentExerciseIndex(0);
            
            // Move to next round preview
            setCurrentScreen('round-preview');
            // Use round-specific rest between rounds if available, otherwise default
            const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || 60;
            startTimer(restBetweenRounds);
          } else {
            // Workout complete - apply App Start color
            getColorForPreset('app_start').then(color => {
              const preset = getHuePresetForColor(color);
              setHueLights(preset);
              console.log('[CircuitWorkoutLive] All rounds complete, navigating back:', {
                instanceId: componentInstanceId.current
              });
              navigation.goBack();
            });
          }
        } else {
          // Not the last exercise - check if we should go to rest or next exercise
          const { restDuration } = getRoundTiming(roundIdx);
          
          if (restDuration === 0) {
            // Skip rest and go directly to next exercise
            setCurrentExerciseIndex(exerciseIdx + 1);
            setCurrentScreen('exercise');
            const { workDuration } = getRoundTiming(roundIdx);
            startTimer(workDuration);
            
            // Play BRIDGE track at start of exercise 2
            if (exerciseIdx + 1 === 1) { // Exercise 2 (0-indexed)
              const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
              if (currentRoundMusic && playTrack) {
                const bridgeTrack = currentRoundMusic.track2;
                if (bridgeTrack) {
                  playTrack(bridgeTrack.spotifyId, 0);
                }
              }
            }
          } else {
            // Go to rest as normal
            setCurrentScreen('rest');
            startTimer(restDuration);
          }
        }
      }
    } else if (screen === 'rest') {
      // Check if this is a set break (last exercise of a stations or circuit round with more sets to do)
      const roundTiming = getRoundTiming(roundIdx);
      const isStationsRound = roundTiming.roundType === 'stations_round';
      const isCircuitRound = roundTiming.roundType === 'circuit_round';
      const repeatTimes = roundTiming.repeatTimes || 1;
      const currentSet = timerStateRef.current.currentSetNumber;
      const isLastExercise = exerciseIdx === currentRound.exercises.length - 1;
      
      if ((isStationsRound || isCircuitRound) && isLastExercise && currentSet < repeatTimes) {
        // This is a set break - start next set from first exercise
        
        setCurrentSetNumber(currentSet + 1);
        setCurrentExerciseIndex(0);
        setCurrentScreen('exercise');
        const { workDuration } = roundTiming;
        startTimer(workDuration);
      } else {
        // Normal rest between exercises
        const nextExerciseIndex = exerciseIdx + 1;
        setCurrentExerciseIndex(nextExerciseIndex);
        setCurrentScreen('exercise');
        const { workDuration } = getRoundTiming(roundIdx);
        startTimer(workDuration);
        
        // Play BRIDGE track at start of exercise 2
        if (nextExerciseIndex === 1) { // Exercise 2 (0-indexed)
          const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
          if (currentRoundMusic && playTrack) {
            const bridgeTrack = currentRoundMusic.track2;
            if (bridgeTrack) {
              playTrack(bridgeTrack.spotifyId, 0);
            }
          }
        }
      }
    }
  }, []); // No dependencies - function is stable and uses ref values

  const handleBack = useCallback(() => {
    // Reset lighting event to force re-application when navigating
    setLastLightingEvent('');
    
    if (currentScreen === 'round-preview') {
      if (currentRoundIndex > 0) {
        // Go to previous round's last rest
        setCurrentRoundIndex(currentRoundIndex - 1);
        const prevRound = roundsData[currentRoundIndex - 1];
        setCurrentExerciseIndex(prevRound.exercises.length - 1);
        
        // Check if previous round has multiple sets and set to the last set
        const prevRoundTiming = getRoundTiming(currentRoundIndex - 1);
        const hasMultipleSets = (prevRoundTiming.roundType === 'stations_round' || 
                                prevRoundTiming.roundType === 'circuit_round') && 
                               (prevRoundTiming.repeatTimes || 1) > 1;
        
        if (hasMultipleSets) {
          // Set to the last set of the previous round
          setCurrentSetNumber(prevRoundTiming.repeatTimes || 1);
        }
        
        const { restDuration } = prevRoundTiming;
        
        if (restDuration === 0) {
          // Skip rest and go directly to last exercise
          setCurrentScreen('exercise');
          const { workDuration } = prevRoundTiming;
          startTimer(workDuration);
        } else {
          setCurrentScreen('rest');
          startTimer(restDuration);
        }
      }
    } else if (currentScreen === 'exercise') {
      if (currentExerciseIndex === 0) {
        // Check if this is a multi-set round and we're not on the first set
        const roundTiming = getRoundTiming(currentRoundIndex);
        const hasMultipleSets = (roundTiming.roundType === 'stations_round' || 
                                roundTiming.roundType === 'circuit_round') && 
                               (roundTiming.repeatTimes || 1) > 1;
        
        if (hasMultipleSets && currentSetNumber > 1) {
          // Go back to previous set's last exercise (in rest)
          
          setCurrentSetNumber(currentSetNumber - 1);
          const currentRound = roundsData[currentRoundIndex];
          setCurrentExerciseIndex(currentRound.exercises.length - 1);
          if (roundTiming.restDuration === 0) {
            // Skip rest and go directly to last exercise of previous set
            setCurrentScreen('exercise');
            startTimer(roundTiming.workDuration);
          } else {
            setCurrentScreen('rest');
            startTimer(roundTiming.restDuration);
          }
          return;
        }
        
        // First exercise of first set (or single-set round), go back to round preview
        setCurrentScreen('round-preview');
        // No timer for first round, otherwise use rest between rounds
        if (currentRoundIndex > 0) {
          const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || 60;
          startTimer(restBetweenRounds);
        } else {
          setTimeRemaining(0);
        }
      } else {
        // Go to previous exercise or rest
        const { restDuration, workDuration } = getRoundTiming(currentRoundIndex);
        
        if (restDuration === 0) {
          // Skip rest and go directly to previous exercise
          setCurrentExerciseIndex(currentExerciseIndex - 1);
          setCurrentScreen('exercise');
          startTimer(workDuration);
        } else {
          // Go to previous rest
          setCurrentExerciseIndex(currentExerciseIndex - 1);
          setCurrentScreen('rest');
          startTimer(restDuration);
        }
      }
    } else if (currentScreen === 'rest') {
      // Go back to current exercise
      setCurrentScreen('exercise');
      const { workDuration } = getRoundTiming(currentRoundIndex);
      startTimer(workDuration);
    }
  }, [currentScreen, currentRoundIndex, currentExerciseIndex, currentSetNumber, roundsData, circuitConfig, getRoundTiming, startTimer]);

  const handleStartRound = () => {
    
    // For circuit rounds, start countdown with music
    // For stations/AMRAP, go directly to exercise
    if (currentRoundType === 'circuit_round') {
      startRound1Immediately();
    } else {
      // For stations and AMRAP, skip countdown and start directly
      setIsStarted(true);
      setCurrentScreen('exercise');
      const { workDuration } = getRoundTiming(0);
      startTimer(workDuration);
      
      // Play music for Round 1 if available
      const currentSetlist = timerStateRef.current.setlist;
      const playTrack = timerStateRef.current.playTrackAtPosition;
      const currentRoundMusic = currentSetlist?.rounds?.[0];
      if (currentRoundMusic && playTrack) {
        const hypeTrack = currentRoundMusic.track1;
        if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
          const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
          playTrack(hypeTrack.spotifyId, seekPositionMs);
        }
      }
    }
  };

  // Create debounced versions of navigation functions to prevent rapid clicks
  const debouncedHandleNext = useMemo(
    () => debounce(handleNext, 300),
    [handleNext]
  );

  const debouncedHandleBack = useMemo(
    () => debounce(handleBack, 300),
    [handleBack]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if ((selectionsLoading || !circuitConfig) /* && !isInitializingWarmup */) {
    console.log('[CircuitWorkoutLive] Rendering loading state:', {
      selectionsLoading,
      circuitConfigLoaded: !!circuitConfig,
      // isInitializingWarmup,
      instanceId: componentInstanceId.current
    });
    return (
      <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading workout...</Text>
      </View>
    );
  }

  const currentRound = getCurrentRound();
  const currentExercise = getCurrentExercise();

  // Dynamic background color for stations work periods
  const getBackgroundColor = () => {
    if (currentScreen === 'exercise' && currentRoundType === 'stations_round') {
      return '#2d1508'; // Bright orange-brown background for stations work
    }
    return TOKENS.color.bg; // Default background for all other states
  };

  return (
    <View style={{ flex: 1, backgroundColor: getBackgroundColor(), paddingTop: 40 }}>
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
        {/* LEFT SIDE: Back/Skip Navigation for Round Previews OR Round Info for Exercise/Rest */}
        {currentScreen === 'round-preview' ? (
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
                console.log('[CircuitWorkoutLive] Back Round pressed:', { currentRoundIndex });
              }}
              focusable
              disabled={currentRoundIndex === 0}
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
                    opacity: currentRoundIndex === 0 ? 0.4 : 1,
                    backgroundColor: focused ? 
                      'rgba(255,255,255,0.15)' : 
                      currentRoundIndex === 0 ? 'transparent' : 'rgba(255,255,255,0.08)',
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
              onPress={() => {
                console.log('[CircuitWorkoutLive] Skip Round pressed:', { currentRoundIndex });
              }}
              focusable
              disabled={currentRoundIndex >= roundsData.length - 1}
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
                    opacity: currentRoundIndex >= roundsData.length - 1 ? 0.4 : 1,
                    backgroundColor: focused ? 
                      'rgba(255,255,255,0.15)' : 
                      currentRoundIndex >= roundsData.length - 1 ? 'transparent' : 'rgba(255,255,255,0.08)',
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
              color: currentRoundType === 'stations_round' && currentScreen === 'exercise' ? '#fff5e6' : TOKENS.color.text,
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              {currentRound?.roundName || `Round ${currentRoundIndex + 1}`}
            </Text>
            
            {/* AMRAP Rest Label */}
            {currentScreen === 'round-preview' && currentRoundType === 'amrap_round' && (
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
                {currentScreen === 'exercise' ? (
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
                            width: index === currentExerciseIndex ? 8 : 6,
                            height: index === currentExerciseIndex ? 8 : 6,
                            borderRadius: 4,
                            backgroundColor: index === currentExerciseIndex 
                              ? (currentRoundType === 'stations_round' ? '#ffb366' : TOKENS.color.accent)
                              : index < currentExerciseIndex 
                                ? (currentRoundType === 'stations_round' ? 'rgba(255, 179, 102, 0.6)' : 'rgba(156, 176, 255, 0.6)') // completed
                                : (currentRoundType === 'stations_round' ? 'rgba(255, 179, 102, 0.25)' : 'rgba(156, 176, 255, 0.25)'), // future
                            transform: index === currentExerciseIndex ? [{ scale: 1.2 }] : [],
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{
                        fontSize: currentRoundType === 'stations_round' ? 18 : 14, // Larger for stations
                        fontWeight: '900', // Bolder
                        color: currentRoundType === 'stations_round' ? '#fff5e6' : TOKENS.color.accent, // Warm white for stations
                        fontStyle: 'normal', // Remove italic for more impact
                        letterSpacing: currentRoundType === 'stations_round' ? 1.5 : 0.5, // More spacing for impact
                        textTransform: 'uppercase', // All caps for power
                        textShadowColor: currentRoundType === 'stations_round' ? 'rgba(255, 179, 102, 0.8)' : 'transparent',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: currentRoundType === 'stations_round' ? 6 : 0, // Glow effect for stations
                      }}>
                        Let's Go!
                      </Text>
                    </View>
                  </View>
                ) : currentScreen === 'rest' ? (
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
        
        {(currentScreen === 'exercise' || currentScreen === 'rest') && currentRoundType === 'stations_round' ? (
          // Timer for stations exercise and rest
          <Text style={{ 
            fontSize: 120, 
            fontWeight: '900', 
            color: currentScreen === 'exercise' ? '#fff5e6' : TOKENS.color.accent, // Warm off-white to match round header, cyan for rest
            letterSpacing: -2,
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            {formatTime(timeRemaining)}
          </Text>
        ) : currentScreen === 'exercise' && currentRoundType === 'amrap_round' ? (
          // Timer for AMRAP exercise
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
            {formatTime(timeRemaining)}
          </Text>
        ) : currentScreen === 'exercise' ? (
          null  // No centered header text for circuit exercise screen
        ) : currentScreen === 'rest' ? (
          null  // No centered header text for rest screen
        ) : currentScreen === 'round-preview' ? (
          // Round preview: Show round name header for all types
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
            {currentRound?.roundName || `Round ${currentRoundIndex + 1}`}
          </Text>
        ) : null}
        
        
        {(() => {
          const shouldShowStartButton = currentScreen === 'round-preview' && currentRoundIndex === 0 && !isStarted;
          return shouldShowStartButton;
        })() ? (
          <Pressable
            onPress={handleStartRound}
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
        ) : (
          currentScreen === 'round-preview' ? (
            // RIGHT SIDE: Playback Controls Only for ALL round types during preview
            <View style={{ 
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 32,
              padding: 6,
              gap: 4,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              zIndex: 1
            }}>
              {/* Pause/Play */}
              <Pressable
                onPress={() => setIsPaused(!isPaused)}
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
                      backgroundColor: focused ? 
                        'rgba(255,255,255,0.15)' : 
                        'rgba(255,255,255,0.08)',
                      borderColor: focused ? 'rgba(255,255,255,0.3)' : 'transparent',
                      borderWidth: focused ? 1.5 : 0,
                    }}
                  >
                    <Icon 
                      name={isPaused ? "play-arrow" : "pause"} 
                      size={24} 
                      color={TOKENS.color.text}
                    />
                  </MattePanel>
                )}
              </Pressable>

              {/* Skip Forward */}
              <Pressable
                onPress={debouncedHandleNext}
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
                      backgroundColor: focused ? 
                        'rgba(255,255,255,0.15)' : 
                        'rgba(255,255,255,0.08)',
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
            // FALLBACK: Original 3-button layout for exercise/rest screens
            <View style={{ flexDirection: 'row', gap: 16, zIndex: 1 }}>
              <Pressable
                onPress={debouncedHandleBack}
                focusable
                disabled={(currentRoundIndex === 0 && currentScreen === 'round-preview')}
              >
                {({ focused }) => (
                  <MattePanel 
                    focused={focused}
                    style={{ 
                      width: 50,
                      height: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: ((currentRoundIndex === 0 && currentScreen === 'round-preview')) ? 0.5 : 1,
                      backgroundColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,179,102,0.25)' : 'rgba(255,255,255,0.16)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,200,150,0.1)' : TOKENS.color.card),
                      borderColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? '#ffb366' : 'rgba(255,255,255,0.45)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,180,120,0.3)' : TOKENS.color.borderGlass),
                      borderWidth: focused ? 1 : 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                  >
                    <Icon 
                      name="skip-previous" 
                      size={24} 
                      color={(currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#fff5e6' : TOKENS.color.text} 
                    />
                  </MattePanel>
                )}
              </Pressable>
              
              <Pressable
                onPress={() => setIsPaused(!isPaused)}
                focusable
              >
                {({ focused }) => (
                  <MattePanel 
                    focused={focused}
                    style={{ 
                      width: 50,
                      height: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,179,102,0.25)' : 'rgba(255,255,255,0.16)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,200,150,0.1)' : TOKENS.color.card),
                      borderColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? '#ffb366' : 'rgba(255,255,255,0.45)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,180,120,0.3)' : TOKENS.color.borderGlass),
                      borderWidth: focused ? 1 : 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                  >
                    <Icon 
                      name={isPaused ? "play-arrow" : "pause"} 
                      size={28} 
                      color={(currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#fff5e6' : TOKENS.color.text} 
                    />
                  </MattePanel>
                )}
              </Pressable>
              
              <Pressable
                onPress={debouncedHandleNext}
                focusable
              >
                {({ focused }) => (
                  <MattePanel 
                    focused={focused}
                    style={{ 
                      width: 50,
                      height: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,179,102,0.25)' : 'rgba(255,255,255,0.16)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,200,150,0.1)' : TOKENS.color.card),
                      borderColor: focused ? 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? '#ffb366' : 'rgba(255,255,255,0.45)') : 
                        (currentRoundType === 'stations_round' && currentScreen === 'exercise' ? 'rgba(255,180,120,0.3)' : TOKENS.color.borderGlass),
                      borderWidth: focused ? 1 : 1,
                      transform: focused ? [{ translateY: -1 }] : [],
                    }}
                  >
                    <Icon 
                      name="skip-next" 
                      size={24} 
                      color={(currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#fff5e6' : TOKENS.color.text} 
                    />
                  </MattePanel>
                )}
              </Pressable>
            </View>
          )
        )}
      </View>

      {/* Main content */}
      <View style={{ flex: 1, paddingHorizontal: 48, paddingBottom: 48 }}>
        
        {currentScreen === 'round-preview' && currentRound && (
          currentRoundType === 'stations_round' 
            ? <StationsRoundPreview 
                currentRound={currentRound} 
                repeatTimes={getRoundTiming(currentRoundIndex).repeatTimes || 1}
                workDuration={getRoundTiming(currentRoundIndex).workDuration}
                timeRemaining={timeRemaining}
                isTimerActive={currentRoundIndex > 0 && timeRemaining > 0}
              />
            : currentRoundType === 'amrap_round'
            ? <AMRAPRoundPreview 
                currentRound={currentRound} 
                restDuration={circuitConfig?.config?.restBetweenRounds || 60}
                timeRemaining={timeRemaining}
                isTimerActive={currentRoundIndex > 0 && timeRemaining > 0}
              />
            : <CircuitRoundPreview 
                currentRound={currentRound} 
                repeatTimes={getRoundTiming(currentRoundIndex).repeatTimes || 1}
                timeRemaining={timeRemaining}
                isTimerActive={currentRoundIndex > 0 && timeRemaining > 0}
              />
        )}

        {currentScreen === 'exercise' && currentExercise && currentRound && (
          <>
            {currentRoundType === 'stations_round' 
              ? <StationsExerciseView 
                  currentRound={currentRound}
                  currentExercise={currentExercise}
                  currentExerciseIndex={currentExerciseIndex}
                  timeRemaining={timeRemaining}
                  isPaused={isPaused}
                  workDuration={getRoundTiming(currentRoundIndex).workDuration}
                />
            : currentRoundType === 'amrap_round'
            ? <AMRAPExerciseView 
                currentRound={currentRound}
                currentExercise={currentExercise}
                currentExerciseIndex={currentExerciseIndex}
                timeRemaining={timeRemaining}
                isPaused={isPaused}
              />
            : <CircuitExerciseView 
                currentRound={currentRound}
                currentExercise={currentExercise}
                currentExerciseIndex={currentExerciseIndex}
                timeRemaining={timeRemaining}
                isPaused={isPaused}
                restDuration={getRoundTiming(currentRoundIndex).restDuration}
              />
            }
            
            {/* Repeat Progress Indicator for Circuit/Stations */}
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
                  backgroundColor: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? 'rgba(255, 179, 102, 0.15)' : TOKENS.color.accent + '15',
                  borderColor: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                }}>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '700',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    Set
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    marginLeft: 2,
                  }}>
                    {currentRepeatNumber}
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '500',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    marginHorizontal: 3,
                  }}>
                    of
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                  }}>
                    {currentRepeatTimes}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {currentScreen === 'rest' && currentRound && (
          <>
            {currentRoundType === 'stations_round' 
              ? <StationsRestView 
                  currentRound={currentRound}
                  currentExerciseIndex={currentExerciseIndex}
                  timeRemaining={timeRemaining}
                  isPaused={isPaused}
                  isSetBreak={currentExerciseIndex === currentRound.exercises.length - 1 && currentSetNumber < (getRoundTiming(currentRoundIndex).repeatTimes || 1)}
                  restDuration={getRoundTiming(currentRoundIndex).restDuration}
                  workDuration={getRoundTiming(currentRoundIndex).workDuration}
                />
            : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
                {/* Main Timer - Primary Focus */}
                <Text style={{ 
                  fontSize: 180, 
                  fontWeight: '900', 
                  color: TOKENS.color.accent,
                  marginBottom: 40,
                  letterSpacing: -2
                }}>
                  {formatTime(timeRemaining)}
                </Text>
                
                {/* Rest Label - Secondary Focus */}
                <Text style={{ 
                  fontSize: 48, 
                  fontWeight: '700', 
                  color: TOKENS.color.text, 
                  marginBottom: 12,
                  textAlign: 'center'
                }}>
                  Rest
                </Text>
                
                {/* Next Exercise - Tertiary (hide during set breaks) */}
                {(() => {
                  const isLastExercise = currentExerciseIndex === currentRound.exercises.length - 1;
                  const isSetBreak = isLastExercise && currentSetNumber < (getRoundTiming(currentRoundIndex).repeatTimes || 1);
                  
                  // Don't show "Next up" during set breaks
                  if (isSetBreak) {
                    return null;
                  }
                  
                  return (
                    <Text style={{ 
                      fontSize: 20, 
                      fontWeight: '500',
                      color: TOKENS.color.muted,
                      opacity: 0.7
                    }}>
                      Next up: {currentRound?.exercises[currentExerciseIndex + 1]?.exerciseName || 'Complete'}
                    </Text>
                  );
                })()}
                
              </View>
            )
            }
            
            {/* Repeat Progress Indicator for Stations/Circuit Rest */}
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
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    Set
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    marginLeft: 2,
                  }}>
                    {currentRepeatNumber}
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 13 : 12,
                    fontWeight: '500',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                    marginHorizontal: 3,
                  }}>
                    of
                  </Text>
                  <Text style={{
                    fontSize: currentRoundType === 'circuit_round' ? 16 : 14,
                    fontWeight: '800',
                    color: (currentRoundType === 'stations_round' && currentScreen === 'exercise') ? '#ffb366' : TOKENS.color.accent,
                  }}>
                    {currentRepeatTimes}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>
      
      
    </View>
  );
}