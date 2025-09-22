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
  startCountdownPulse,
  setPauseState,
  stopAnimation
} from '../lib/lighting';
import { getColorForPreset, getHuePresetForColor } from '../lib/lighting/colorMappings';
import { LightingStatusDot } from '../components/LightingStatusDot';
import { useSpotifySync } from '../hooks/useSpotifySync';
import { playCountdownSound, setCountdownVolume } from '../lib/sound/countdown-sound';
import type { CircuitConfig } from '@acme/db';
import { 
  CircuitRoundPreview, 
  StationsRoundPreview,
  AMRAPRoundPreview,
  WarmupRoundPreview,
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

type ScreenType = 'warmup' | 'round-preview' | 'exercise' | 'rest';

export function CircuitWorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Generate unique component instance ID
  const componentInstanceId = useRef(`cwl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  
  // State for rounds and navigation
  const [roundsData, setRoundsDataInternal] = useState<RoundData[]>([]);
  const [warmupData, setWarmupData] = useState<RoundData | null>(null);
  const [warmupCompleted, setWarmupCompleted] = useState(false);
  
  const setRoundsData = setRoundsDataInternal;
  
  const [currentRoundIndex, setCurrentRoundIndexInternal] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndexInternal] = useState(0);
  const [currentScreen, setCurrentScreenInternal] = useState<ScreenType>('round-preview');
  
  const setCurrentRoundIndex = setCurrentRoundIndexInternal;
  const setCurrentExerciseIndex = setCurrentExerciseIndexInternal;
  const setCurrentScreen = setCurrentScreenInternal;
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Countdown overlay state - only for Round 1
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | string>(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup and unmount logging
  useEffect(() => {
    return () => {
      console.log('[COUNTDOWN-DEBUG] CircuitWorkoutLiveScreen unmounting', {
        currentScreen,
        timestamp: new Date().toISOString()
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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
        roundType: 'circuit_round' as const
      };
    }
    
    const { roundTemplates, workDuration = 45, restDuration = 15 } = circuitConfig.config;
    
    // If no roundTemplates, use legacy timing
    if (!roundTemplates || roundTemplates.length === 0) {
      return {
        workDuration,
        restDuration,
        roundType: 'circuit_round' as const
      };
    }
    
    // Find template for current round (roundTemplates are 1-indexed)
    const roundTemplate = roundTemplates.find(rt => rt.roundNumber === roundIndex + 1);
    
    console.log('[TIMING-DEBUG] getRoundTiming:', {
      roundIndex,
      lookingForRoundNumber: roundIndex + 1,
      foundTemplate: !!roundTemplate,
      templateType: roundTemplate?.template?.type,
      allTemplates: roundTemplates.map(rt => ({ round: rt.roundNumber, type: rt.template.type }))
    });
    
    if (!roundTemplate) {
      // Fallback to legacy timing
      return {
        workDuration,
        restDuration,
        roundType: 'circuit_round' as const
      };
    }
    
    // Return round-specific timing
    const template = roundTemplate.template;
    if (template.type === 'circuit_round') {
      return {
        workDuration: template.workDuration || workDuration,
        restDuration: template.restDuration || restDuration,
        roundType: 'circuit_round' as const
      };
    } else if (template.type === 'stations_round') {
      // Stations now have their own timing
      return {
        workDuration: (template as any).workDuration || workDuration,
        restDuration: (template as any).restDuration || restDuration,
        roundType: 'stations_round' as const
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
  
  // Get current round type
  const currentRoundType = getRoundTiming(currentRoundIndex).roundType;
  
  // Log round type for debugging
  useEffect(() => {
    console.log('[ROUND-TYPE-DEBUG] Current round type:', {
      currentRoundType,
      currentRoundIndex,
      currentScreen,
      isStarted,
      timeRemaining,
      timestamp: new Date().toISOString()
    });
  }, [currentRoundType, currentRoundIndex, currentScreen, isStarted, timeRemaining]);
  
  // Spotify integration with pre-selected device (auto-play disabled since music already playing from preferences screen)
  const { playTrackAtPosition, prefetchSetlistTracks, setlist, isConnected: spotifyConnectionState, refetchDevices } = useSpotifySync(sessionId, circuitConfig?.config?.spotifyDeviceId, { autoPlay: false });
  
  // Update ref when values change
  useEffect(() => {
    timerStateRef.current = {
      currentScreen,
      currentRoundIndex,
      currentExerciseIndex,
      isPaused,
      setlist,
      playTrackAtPosition,
      roundsData,
    };
  }, [currentScreen, currentRoundIndex, currentExerciseIndex, isPaused, setlist, playTrackAtPosition, roundsData]);
  
  // Get saved selections
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
    onError: (error) => {
      console.error('[CircuitWorkoutLive] Failed to load selections:', error);
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
      console.log('[CircuitWorkout] Processing selections:', {
        totalSelections: selections.length,
        groupNames: [...new Set(selections.map(s => s.groupName))],
        warmupEnabled: circuitConfig?.config?.warmup?.enabled,
      });
      
      // For circuits, deduplicate by exerciseId + groupName
      const exerciseMap = new Map<string, CircuitExercise>();
      
      selections.forEach((selection) => {
        // Skip warm-up exercises from being added to regular rounds
        if (selection.groupName === 'Warm-up') {
          console.log('[CircuitWorkout] Skipping warm-up exercise from rounds:', selection.exerciseName);
          return;
        }
        
        const key = `${selection.exerciseId}-${selection.groupName}`;
        
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            id: selection.id,
            exerciseId: selection.exerciseId,
            exerciseName: selection.exerciseName,
            orderIndex: selection.orderIndex || 0,
            groupName: selection.groupName || 'Round 1',
            equipment: selection.equipment,
          });
        }
      });
      
      // Group by round
      const roundsMap = new Map<string, CircuitExercise[]>();
      exerciseMap.forEach((exercise) => {
        const round = exercise.groupName;
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push(exercise);
      });
      
      // Sort exercises within each round and create final structure
      let rounds: RoundData[] = Array.from(roundsMap.entries())
        .map(([roundName, exercises]) => ({
          roundName,
          exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex)
        }))
        .sort((a, b) => {
          const aNum = parseInt(a.roundName.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.roundName.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
      
      console.log('[CircuitWorkout] Final rounds data:', {
        roundCount: rounds.length,
        rounds: rounds.map(r => ({
          name: r.roundName,
          exerciseCount: r.exercises.length
        }))
      });
      
      setRoundsData(rounds);
      
      // Check if warmup is configured and enabled
      if (circuitConfig?.config?.warmup?.enabled && !warmupData && !warmupCompleted) {
        // Only set up warmup if we haven't already done so and haven't completed it
        // Look for exercises with groupName "Warm-up"
        const warmupExercises = selections
          .filter(s => s.groupName === 'Warm-up')
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(s => ({
            id: s.id,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName,
            orderIndex: s.orderIndex
          }));
        
        if (warmupExercises.length > 0) {
          const warmupRound: RoundData = {
            roundName: 'Warm-up',
            exercises: warmupExercises
          };
          setWarmupData(warmupRound);
          setCurrentScreen('warmup');
          // Start warmup timer - just use the total duration
          const warmupDuration = circuitConfig.config.warmup.duration; // Total warmup time
          console.log('[WARMUP-INIT-DEBUG] Initializing warmup', {
            warmupDuration,
            currentScreen,
            hasWarmupData: !!warmupData,
            warmupExerciseCount: warmupExercises.length,
            timestamp: new Date().toISOString()
          });
          startTimer(warmupDuration);
        } else {
          console.log('[WARMUP-INIT-DEBUG] No warm-up exercises found in selections', {
            totalSelections: selections.length,
            groupNames: [...new Set(selections.map(s => s.groupName))]
          });
        }
      }
    }
  }, [selections, circuitConfig, getRoundTiming, warmupCompleted]);

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
      lightingEvent = 'warmup';  // 'warmup' maps to Round Preview in our color mappings
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
            console.log('[MUSIC-DEBUG] Starting music early at 0:06', {
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
                console.log('[MUSIC-DEBUG] Playing hype track early', {
                  round: roundIdx + 1,
                  track: hypeTrack.spotifyId,
                  hypeTimestamp: hypeTrack.hypeTimestamp,
                  seekPosition: seekPositionMs / 1000,
                  timestamp: new Date().toISOString()
                });
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
                console.log('[MUSIC-DEBUG] Playing hype track early', {
                  round: roundIdx + 1,
                  track: hypeTrack.spotifyId,
                  hypeTimestamp: hypeTrack.hypeTimestamp,
                  seekPosition: seekPositionMs / 1000,
                  timestamp: new Date().toISOString()
                });
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
    // Auto-advance to next screen (not a manual skip)
    handleNext(false);
  }, []);

  // Start countdown for Round 1 only
  const startCountdownRound1 = useCallback(() => {
    console.log('[COUNTDOWN-DEBUG] Starting Round 1 countdown');
    setShowCountdown(true);
    setCountdownValue(5);
    
    // Get values from ref
    const { setlist: currentSetlist, playTrackAtPosition: playTrack } = timerStateRef.current;
    
    // Sync music with countdown
    if (currentSetlist && playTrack) {
      const currentRoundMusic = currentSetlist.rounds?.[0]; // Round 1
      const hypeTrack = currentRoundMusic?.track1;
      
      if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
        // Calculate seek position: hype moment - 5 seconds for countdown
        const seekPositionMs = Math.max(0, (hypeTrack.hypeTimestamp - 5) * 1000);
        console.log('[MUSIC-DEBUG] Playing Round 1 hype track for countdown', {
          track: hypeTrack.spotifyId,
          hypeTimestamp: hypeTrack.hypeTimestamp,
          seekPosition: seekPositionMs / 1000,
          timestamp: new Date().toISOString()
        });
        playTrack(hypeTrack.spotifyId, seekPositionMs);
      }
    }
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev === 'GO!') {
          // GO! complete - start exercise
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setShowCountdown(false);
          setIsStarted(true); // Mark workout as started
          setCurrentScreen('exercise');
          const { workDuration } = getRoundTiming(0); // Round 1 countdown
          startTimer(workDuration);
          return 5; // Reset for next time
        }
        if (prev === 1) {
          return 'GO!';
        }
        
        // Play countdown sound when about to show 3
        if (prev === 5) {
          // Trigger at 4, play 50ms before 3 appears
          setTimeout(() => {
            playCountdownSound().catch(error => {
              console.error('[CircuitWorkoutLive] Failed to play countdown sound:', error);
            });
          }, 950); // Play 50ms before the display changes to 3
        }
        
        return typeof prev === 'number' ? prev - 1 : 5;
      });
    }, 1000);
  }, [circuitConfig]);

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
      
      console.log('[MUSIC-DEBUG] Starting first exercise with music', {
        round: roundIdx + 1,
        hasSetlist: !!currentSetlist,
        hasPlayFunction: !!playTrack,
        hasRoundMusic: !!currentRoundMusic,
        hasHypeTrack: !!hypeTrack,
        hypeTimestamp: hypeTrack?.hypeTimestamp,
        timestamp: new Date().toISOString()
      });
      
      if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
        // Start at the hype moment (music should already be playing from 0:06)
        // Only play if we're on round 1 (round 2+ starts early at 0:06)
        if (roundIdx === 0) {
          const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
          playTrack(hypeTrack.spotifyId, seekPositionMs);
        }
      } else {
        console.warn('[MUSIC-DEBUG] Cannot play hype track', {
          round: roundIdx + 1,
          reason: !hypeTrack ? 'No hype track' : 'No hype timestamp',
          trackData: hypeTrack
        });
      }
    } else {
      console.warn('[MUSIC-DEBUG] Missing requirements for exercise music', {
        hasSetlist: !!currentSetlist,
        hasPlayFunction: !!playTrack
      });
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
      startCountdownRound1();
      return;
    }
    
    // For Round 2+, music should already be playing from 0:06
    // Just start the exercise
    console.log('[MUSIC-DEBUG] Starting exercise (music already playing from 0:06)');
    setCurrentScreen('exercise');
    startTimer(workDuration);
  }, [getRoundTiming, startCountdownRound1]);

  const startTimer = (duration: number) => {
    console.log('[TIMER-DEBUG] startTimer called', {
      newDuration: duration,
      currentTimeRemaining: timeRemaining,
      currentScreen,
      caller: new Error().stack?.split('\n')[2]?.trim(),
      timestamp: new Date().toISOString()
    });
    
    console.log('[TIMER-SET-DEBUG] setTimeRemaining called', {
      duration,
      oldTimeRemaining: timeRemaining,
      currentScreen,
      currentRoundIndex,
      caller: new Error().stack?.split('\n')[3]?.trim(),
      timestamp: new Date().toISOString()
    });
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
    
    console.log('[FLOW-DEBUG] handleNext called', {
      currentScreen: screen,
      roundIndex: roundIdx,
      exerciseIndex: exerciseIdx,
      timeRemaining,
      timestamp: new Date().toISOString()
    });
    
    const currentRound = rounds[roundIdx];
    if (!currentRound) {
      console.error('[CircuitWorkoutLive] handleNext - No currentRound', {
        roundIdx,
        roundsDataLength: rounds.length
      });
      return;
    }

    // Reset lighting event to force re-application when navigating
    setLastLightingEvent('');

    if (screen === 'warmup') {
      console.log('[FLOW-DEBUG] Warmup complete, moving to Round 1', {
        isManualSkip,
        timestamp: new Date().toISOString()
      });
      
      // Warmup complete - go to Round 1 preview
      console.log('[WARMUP-COMPLETE-DEBUG] Warmup finished, clearing timer and transitioning', {
        oldScreen: screen,
        newScreen: 'round-preview',
        currentTimeRemaining: timeRemaining,
        timestamp: new Date().toISOString()
      });
      
      // Clear any running timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Reset all states for round preview
      setCurrentRoundIndex(0);
      setCurrentExerciseIndex(0);
      setCurrentScreen('round-preview');
      setTimeRemaining(0); // Set to 0 so Start button shows
      setWarmupCompleted(true); // Mark warmup as done
      
      // Don't start timer - wait for user to click "Start"
      return;
    }
    
    if (screen === 'round-preview') {
      console.log('[FLOW-DEBUG] Round preview complete', {
        isManualSkip,
        roundIdx,
        roundType: getRoundTiming(roundIdx).roundType,
        timestamp: new Date().toISOString()
      });
      
      const currentRoundType = getRoundTiming(roundIdx).roundType;
      
      // For Round 2+, when MANUALLY skipping from preview, go directly to hype moment
      if (roundIdx > 0 && isManualSkip) {
        // Play hype track at the exact hype moment
        const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
        if (currentRoundMusic && playTrack) {
          const hypeTrack = currentRoundMusic.track1;
          if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
            const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
            console.log('[MUSIC-DEBUG] Manual skip from Round preview - seeking to hype moment', {
              round: roundIdx + 1,
              track: hypeTrack.spotifyId,
              hypeTimestamp: hypeTrack.hypeTimestamp,
              timestamp: new Date().toISOString()
            });
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
            navigation.goBack();
          });
        }
      } else {
        // Circuit, Stations, or Warmup/Cooldown round - normal exercise progression
        // Check if this is the last exercise in the round
        if (exerciseIdx === currentRound.exercises.length - 1) {
          // Last exercise of the round - play REST track
          const currentRoundMusic = currentSetlist?.rounds?.[roundIdx];
          if (currentRoundMusic && playTrack) {
            const restTrack = currentRoundMusic.track3;
            if (restTrack) {
              console.log('[UNMOUNT-DEBUG] Playing REST track at round end', {
                round: roundIdx + 1,
                track: restTrack.spotifyId,
                trackName: restTrack.trackName,
                timestamp: new Date().toISOString()
              });
              playTrack(restTrack.spotifyId, 0);
            } else {
              console.warn('[UNMOUNT-DEBUG] No REST track available for round', roundIdx + 1);
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
              navigation.goBack();
            });
          }
        } else {
          // Not the last exercise - go to rest
          setCurrentScreen('rest');
          const { restDuration } = getRoundTiming(roundIdx);
          startTimer(restDuration);
        }
      }
    } else if (screen === 'rest') {
      // Rest screen always leads to the next exercise
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
        setCurrentScreen('rest');
        const { restDuration } = getRoundTiming(currentRoundIndex - 1);
        startTimer(restDuration);
      }
    } else if (currentScreen === 'exercise') {
      if (currentExerciseIndex === 0) {
        // First exercise, go back to round preview
        setCurrentScreen('round-preview');
        // No timer for first round, otherwise use rest between rounds
        if (currentRoundIndex > 0) {
          const restBetweenRounds = circuitConfig?.config?.restBetweenRounds || 60;
          startTimer(restBetweenRounds);
        } else {
          setTimeRemaining(0);
        }
      } else {
        // Go to previous rest
        setCurrentExerciseIndex(currentExerciseIndex - 1);
        setCurrentScreen('rest');
        const { restDuration } = getRoundTiming(currentRoundIndex);
        startTimer(restDuration);
      }
    } else if (currentScreen === 'rest') {
      // Go back to current exercise
      setCurrentScreen('exercise');
      const { workDuration } = getRoundTiming(currentRoundIndex);
      startTimer(workDuration);
    }
  }, [currentScreen, currentRoundIndex, currentExerciseIndex, roundsData, circuitConfig, getRoundTiming, startTimer]);

  const handleStartRound = () => {
    console.log('[START-DEBUG] handleStartRound called:', {
      currentRoundType,
      currentScreen,
      currentRoundIndex,
      isStarted,
      timestamp: new Date().toISOString()
    });
    
    // For circuit rounds, start countdown with music
    // For stations/AMRAP, go directly to exercise
    if (currentRoundType === 'circuit_round') {
      console.log('[START-DEBUG] Starting circuit countdown');
      startCountdownRound1();
    } else {
      console.log('[START-DEBUG] Starting stations/AMRAP directly');
      // For stations and AMRAP, skip countdown and start directly
      setIsStarted(true);
      setCurrentScreen('exercise');
      const { workDuration } = getRoundTiming(0);
      console.log('[START-DEBUG] Work duration:', workDuration);
      startTimer(workDuration);
      
      // Play music for Round 1 if available
      const currentSetlist = timerStateRef.current.setlist;
      const playTrack = timerStateRef.current.playTrackAtPosition;
      const currentRoundMusic = currentSetlist?.rounds?.[0];
      if (currentRoundMusic && playTrack) {
        const hypeTrack = currentRoundMusic.track1;
        if (hypeTrack && hypeTrack.hypeTimestamp !== undefined) {
          const seekPositionMs = hypeTrack.hypeTimestamp * 1000;
          console.log('[START-DEBUG] Playing music:', hypeTrack.spotifyId);
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

  if (selectionsLoading || !circuitConfig) {
    return (
      <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading workout...</Text>
      </View>
    );
  }

  const currentRound = getCurrentRound();
  const currentExercise = getCurrentExercise();

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, paddingTop: 40 }}>
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
        {currentScreen === 'warmup' && (
          <View style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 0,
            paddingTop: 20
          }}>
            <Text style={{ 
              fontSize: 80, 
              fontWeight: '900', 
              color: TOKENS.color.text,
              letterSpacing: 1,
              textTransform: 'uppercase'
            }}>
              WARM-UP
            </Text>
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: TOKENS.color.accent,
              letterSpacing: 0.5,
              marginTop: 8,
            }}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
        )}
        
        {!(currentScreen === 'round-preview' && currentRoundIndex === 0) && currentScreen !== 'warmup' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 40, 
              fontWeight: '900', 
              color: currentScreen === 'round-preview' && currentRoundIndex > 0 && timeRemaining > 0 ? TOKENS.color.muted : TOKENS.color.text,
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              {currentScreen === 'round-preview' && currentRoundIndex > 0 && timeRemaining > 0 
                ? formatTime(timeRemaining)
                : currentRound?.roundName || `Round ${currentRoundIndex + 1}`}
            </Text>
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
                              ? TOKENS.color.accent
                              : index < currentExerciseIndex 
                                ? 'rgba(156, 176, 255, 0.6)' // completed
                                : 'rgba(156, 176, 255, 0.25)', // future
                            transform: index === currentExerciseIndex ? [{ scale: 1.2 }] : [],
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: TOKENS.color.accent,
                      fontStyle: 'italic',
                      letterSpacing: 0.5,
                    }}>
                      Let's Go!
                    </Text>
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
        ) : (
          <Pressable
            onPress={async () => {
              // Apply App Start color when leaving workout
              const appStartColor = await getColorForPreset('app_start');
              const preset = getHuePresetForColor(appStartColor);
              await setHueLights(preset);
              navigation.goBack();
            }}
            focusable
            style={{ zIndex: 10 }}
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
        )}
        
        {(currentScreen === 'exercise' || currentScreen === 'rest') && currentRoundType === 'stations_round' ? (
          // Timer for stations exercise and rest
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
          console.log('[CONTROL-DEBUG] Button logic:', {
            shouldShowStartButton,
            currentScreen,
            currentRoundIndex,
            isStarted,
            currentRoundType,
            timestamp: new Date().toISOString()
          });
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
          <View style={{ flexDirection: 'row', gap: 16, zIndex: 1 }}>
            <Pressable
              onPress={debouncedHandleBack}
              focusable
              disabled={(currentRoundIndex === 0 && currentScreen === 'round-preview') || currentScreen === 'warmup'}
            >
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    width: 50,
                    height: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: ((currentRoundIndex === 0 && currentScreen === 'round-preview') || currentScreen === 'warmup') ? 0.5 : 1,
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                >
                  <Icon 
                    name="skip-previous" 
                    size={24} 
                    color={TOKENS.color.text} 
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
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                >
                  <Icon 
                    name={isPaused ? "play-arrow" : "pause"} 
                    size={28} 
                    color={TOKENS.color.text} 
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
                    backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                    borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                    borderWidth: focused ? 1 : 1,
                    transform: focused ? [{ translateY: -1 }] : [],
                  }}
                >
                  <Icon 
                    name="skip-next" 
                    size={24} 
                    color={TOKENS.color.text} 
                  />
                </MattePanel>
              )}
            </Pressable>
            
          </View>
        )}
      </View>

      {/* Main content */}
      <View style={{ flex: 1, paddingHorizontal: 48, paddingBottom: 48 }}>
        {currentScreen === 'warmup' && warmupData && (
          <WarmupRoundPreview currentRound={warmupData} />
        )}
        
        {currentScreen === 'round-preview' && currentRound && (
          currentRoundType === 'stations_round' 
            ? <StationsRoundPreview currentRound={currentRound} />
            : currentRoundType === 'amrap_round'
            ? <AMRAPRoundPreview currentRound={currentRound} />
            : <CircuitRoundPreview currentRound={currentRound} />
        )}

        {currentScreen === 'exercise' && currentExercise && currentRound && (
          currentRoundType === 'stations_round' 
            ? <StationsExerciseView 
                currentRound={currentRound}
                currentExercise={currentExercise}
                currentExerciseIndex={currentExerciseIndex}
                timeRemaining={timeRemaining}
                isPaused={isPaused}
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
              />
        )}

        {currentScreen === 'rest' && currentRound && (
          currentRoundType === 'stations_round' 
            ? <StationsRestView 
                currentRound={currentRound}
                currentExerciseIndex={currentExerciseIndex}
                timeRemaining={timeRemaining}
                isPaused={isPaused}
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
                
                {/* Next Exercise - Tertiary */}
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: '500',
                  color: TOKENS.color.muted,
                  opacity: 0.7
                }}>
                  Next up: {currentRound?.exercises[currentExerciseIndex + 1]?.exerciseName || 'Complete'}
                </Text>
                
              </View>
            )
        )}
      </View>
      
      {/* Countdown Overlay - Round 1 only */}
      {showCountdown && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <Text style={{
            fontSize: 280,
            fontWeight: '900',
            color: '#ffffff',
            textAlign: 'center',
            letterSpacing: -8,
            textShadowColor: 'rgba(0, 0, 0, 0.3)',
            textShadowOffset: { width: 0, height: 4 },
            textShadowRadius: 10,
          }}>
            {countdownValue}
          </Text>
        </View>
      )}
      
      {/* Status Indicators */}
      <View style={{ 
        position: 'absolute', 
        bottom: 40, 
        left: 60, 
        flexDirection: 'row', 
        alignItems: 'center',
        gap: 20 
      }}>
        <LightingStatusDot />
      </View>
    </View>
  );
}