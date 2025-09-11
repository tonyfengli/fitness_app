import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// Design tokens
const TOKENS = {
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
  
  // State for rounds and navigation
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('round-preview');
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Countdown overlay state
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Lighting state
  const [lastLightingEvent, setLastLightingEvent] = useState<string>('');
  const [isStarted, setIsStarted] = useState(false);
  
  // Get circuit config for timing and Spotify device
  const { data: circuitConfig } = useQuery(
    sessionId ? api.circuitConfig.getBySession.queryOptions({ sessionId }) : {
      enabled: false,
      queryKey: ['disabled-circuit-config-live'],
      queryFn: () => Promise.resolve(null)
    }
  );
  
  // Spotify integration with pre-selected device (auto-play disabled since music already playing from preferences screen)
  useSpotifySync(sessionId, circuitConfig?.config?.spotifyDeviceId, { autoPlay: false });
  
  // Get saved selections
  const selectionsQueryOptions = sessionId 
    ? api.workoutSelections.getSelections.queryOptions({ sessionId })
    : null;

  const { data: selections, isLoading: selectionsLoading } = useQuery({
    ...selectionsQueryOptions,
    enabled: !!sessionId && !!selectionsQueryOptions,
  });
  
  // Process selections into rounds
  useEffect(() => {
    if (selections && selections.length > 0) {
      console.log('[CircuitWorkoutLive] Processing selections:', selections.length);
      
      // For circuits, deduplicate by exerciseId + groupName
      const exerciseMap = new Map<string, CircuitExercise>();
      
      selections.forEach((selection) => {
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
      
      setRoundsData(rounds);
    }
  }, [selections]);

  // Start health check on mount and cleanup on unmount
  useEffect(() => {
    console.log('[CIRCUIT-LIGHTING] Component mounted, starting health check');
    startHealthCheck();
    return () => {
      console.log('[CIRCUIT-LIGHTING] Component unmounting, cleanup');
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
    console.log('[CIRCUIT-LIGHTING] Phase detection:', {
      currentScreen,
      timeRemaining,
      isStarted,
      currentRoundIndex,
      totalRounds: roundsData.length,
      lastLightingEvent
    });
    
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
    
    console.log('[CIRCUIT-LIGHTING] Detected event:', {
      lightingEvent,
      willTrigger: lightingEvent && lightingEvent !== lastLightingEvent
    });
    
    // Only trigger if event changed
    if (lightingEvent && lightingEvent !== lastLightingEvent) {
      console.log('[CIRCUIT-LIGHTING] 🎨 Applying lighting effect:', {
        event: lightingEvent,
        timestamp: new Date().toISOString()
      });
      
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

  // Timer management
  useEffect(() => {
    if (timeRemaining > 0 && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer reached 0, advance to next screen
            handleTimerComplete();
            return 0;
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
  }, [timeRemaining, isPaused]);

  const handleTimerComplete = useCallback(() => {
    // Auto-advance to next screen
    handleNext();
  }, [currentScreen, currentRoundIndex, currentExerciseIndex]);

  // Start countdown and then proceed to exercise
  const startCountdown = useCallback(() => {
    setShowCountdown(true);
    setCountdownValue(5);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          // Countdown complete
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setShowCountdown(false);
          // Start the first exercise
          setCurrentScreen('exercise');
          startTimer(circuitConfig?.config?.workDuration || 45);
          return 5; // Reset for next time
        }
        return prev - 1;
      });
    }, 1000);
  }, [circuitConfig]);

  const startTimer = (duration: number) => {
    setTimeRemaining(duration);
    setIsStarted(true);
  };

  const getCurrentRound = () => roundsData[currentRoundIndex];
  const getCurrentExercise = () => {
    const round = getCurrentRound();
    return round?.exercises[currentExerciseIndex];
  };

  const getTotalRounds = () => roundsData.length;

  const handleNext = () => {
    const currentRound = getCurrentRound();
    if (!currentRound) return;

    // Reset lighting event to force re-application when navigating
    setLastLightingEvent('');

    if (currentScreen === 'round-preview') {
      // Start countdown before going to first exercise
      startCountdown();
    } else if (currentScreen === 'exercise') {
      // Check if this is the last exercise in the round
      if (currentExerciseIndex === currentRound.exercises.length - 1) {
        // Last exercise of the round - skip rest and go to next round preview or complete
        if (currentRoundIndex < roundsData.length - 1) {
          setCurrentRoundIndex(currentRoundIndex + 1);
          setCurrentExerciseIndex(0);
          setCurrentScreen('round-preview');
          startTimer(circuitConfig?.config?.restBetweenRounds || 60);
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
        startTimer(circuitConfig?.config?.restDuration || 15);
      }
    } else if (currentScreen === 'rest') {
      // Rest screen always leads to the next exercise
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentScreen('exercise');
      startTimer(circuitConfig?.config?.workDuration || 45);
    }
  };

  const handleBack = () => {
    // Reset lighting event to force re-application when navigating
    setLastLightingEvent('');
    
    if (currentScreen === 'round-preview') {
      if (currentRoundIndex > 0) {
        // Go to previous round's last rest
        setCurrentRoundIndex(currentRoundIndex - 1);
        const prevRound = roundsData[currentRoundIndex - 1];
        setCurrentExerciseIndex(prevRound.exercises.length - 1);
        setCurrentScreen('rest');
        startTimer(circuitConfig?.config?.restDuration || 15);
      }
    } else if (currentScreen === 'exercise') {
      if (currentExerciseIndex === 0) {
        // First exercise, go back to round preview
        setCurrentScreen('round-preview');
        // No timer for first round, otherwise use rest between rounds
        if (currentRoundIndex > 0) {
          startTimer(circuitConfig?.config?.restBetweenRounds || 60);
        } else {
          setTimeRemaining(0);
        }
      } else {
        // Go to previous rest
        setCurrentExerciseIndex(currentExerciseIndex - 1);
        setCurrentScreen('rest');
        startTimer(circuitConfig?.config?.restDuration || 15);
      }
    } else if (currentScreen === 'rest') {
      // Go back to current exercise
      setCurrentScreen('exercise');
      startTimer(circuitConfig?.config?.workDuration || 45);
    }
  };

  const handleStartRound = () => {
    startCountdown();
  };

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
        paddingBottom: 20
      }}>
        {!(currentScreen === 'round-preview' && currentRoundIndex === 0) ? (
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
        ) : (
          <Pressable
            onPress={async () => {
              console.log('[CircuitWorkoutLive] Back button pressed');
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
        
        {currentScreen === 'exercise' ? (
          null  // No centered header text for exercise screen
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
        
        {currentScreen === 'round-preview' && currentRoundIndex === 0 && timeRemaining === 0 ? (
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
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable
              onPress={handleBack}
              focusable
              disabled={currentRoundIndex === 0 && currentScreen === 'round-preview'}
            >
              {({ focused }) => (
                <MattePanel 
                  focused={focused}
                  style={{ 
                    width: 50,
                    height: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: (currentRoundIndex === 0 && currentScreen === 'round-preview') ? 0.5 : 1,
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
              onPress={handleNext}
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
        {currentScreen === 'round-preview' && currentRound && (() => {
            // Calculate grid layout based on number of exercises
            const exerciseCount = currentRound.exercises.length;
            let columns = 4; // Default to 4 columns
            
            if (exerciseCount <= 2) {
              columns = exerciseCount; // 1-2 exercises: show in single row
            } else if (exerciseCount === 3) {
              columns = 2; // 3 exercises: 2 on top, 1 on bottom
            } else if (exerciseCount === 6) {
              columns = 3; // 6 exercises: 3x2 grid
            } else if (exerciseCount === 5) {
              columns = 3; // 5 exercises: 3 on top, 2 on bottom
            } else if (exerciseCount === 7) {
              columns = 4; // 7 exercises: 4 on top, 3 on bottom
            } else if (exerciseCount === 8) {
              columns = 4; // 8 exercises: 4x2 grid
            }
            
            // Calculate rows to determine if we need to scale down
            const rows = Math.ceil(exerciseCount / columns);
            const needsScaling = rows > 1; // Scale for ANY multi-row layout
            
            return (
              <View style={{ flex: 1, width: '100%' }}>
                {/* Exercise Grid */}
                <View style={{ 
                  flex: 1, 
                  justifyContent: 'center',
                  paddingTop: needsScaling ? 60 : 0, // Add padding when more than 1 row
                }}>
                  <View style={{ 
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginHorizontal: -10,
                  }}>
                    {currentRound.exercises.map((exercise, idx) => {
                    
                    // Fixed width for cards - scale down by 5% if more than 1 row
                    const baseCardWidth = 380;
                    const cardWidth = needsScaling ? baseCardWidth * 0.95 : baseCardWidth;
                    
                    // Adjust vertical padding when scaled
                    const verticalPadding = needsScaling ? 8 : 10;
                    
                    return (
                      <View key={exercise.id} style={{ 
                        width: cardWidth,
                        paddingHorizontal: 10,
                        paddingVertical: verticalPadding,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                        {/* Number outside the card */}
                        <Text style={{ 
                          fontSize: needsScaling ? 46 : 48, 
                          fontWeight: '900',
                          color: TOKENS.color.muted,
                          marginRight: needsScaling ? 14 : 16,
                          opacity: 0.3,
                          minWidth: needsScaling ? 57 : 60,
                          textAlign: 'right'
                        }}>
                          {idx + 1}
                        </Text>
                        
                        <MattePanel style={{ 
                          flex: 1,
                          paddingHorizontal: needsScaling ? 22 : 24,
                          paddingVertical: needsScaling ? 18 : 20,
                          height: needsScaling ? 114 : 120,
                          justifyContent: 'center',
                        }}>
                          {/* Exercise Name */}
                          <Text style={{ 
                            fontSize: needsScaling ? 22 : 24, 
                            fontWeight: '900',
                            color: TOKENS.color.text,
                            lineHeight: needsScaling ? 26 : 28,
                            marginBottom: 4,
                            minHeight: needsScaling ? 26 : 28, // Ensures at least one line height
                          }} numberOfLines={2}>
                            {exercise.exerciseName}
                          </Text>
                          
                          {/* Equipment or default text */}
                          <Text style={{ 
                            fontSize: needsScaling ? 15 : 16, 
                            fontWeight: '600',
                            color: '#9ca3af',
                          }}>
                            {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                              ? exercise.equipment.join(', ') 
                              : 'bodyweight'}
                          </Text>
                        </MattePanel>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Timer now shown in header for round 2+ previews */}
            </View>
            );
          })()}

        {currentScreen === 'exercise' && currentExercise && (
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
            
            {/* Exercise Name - Secondary Focus */}
            <Text style={{ 
              fontSize: 48, 
              fontWeight: '700', 
              color: TOKENS.color.text, 
              marginBottom: 12,
              textAlign: 'center'
            }} numberOfLines={1}>
              {currentExercise.exerciseName}
            </Text>
            
            {/* Progress Indicator - Tertiary */}
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '500',
              color: TOKENS.color.muted,
              opacity: 0.7
            }}>
              Exercise {currentExerciseIndex + 1} of {currentRound?.exercises.length}
            </Text>
          </View>
        )}

        {currentScreen === 'rest' && (
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
        )}
      </View>
      
      {/* Countdown Overlay */}
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