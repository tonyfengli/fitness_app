import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { LightingButtonWrapper } from '../components/LightingButtonWrapper';

// Types
type Assignment = { clientName: string; tag: string };
type Exercise = { 
  title: string; 
  meta: string; 
  assigned: Assignment[]; 
  exerciseDetails?: Array<{ exerciseId: string; title: string; meta: string }> 
};
type RoundData = {
  label: string;
  workSeconds: number;
  restSeconds: number;
  phase: "work" | "rest";
  exercises: [Exercise, Exercise, Exercise];
};

// Design tokens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',  // brightened from #0a0f1f
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
  shadow: {
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
};

// Reusable shadow constant
const SHADOW = {
  elevation: TOKENS.shadow.elevation,
  shadowColor: TOKENS.shadow.shadowColor,
  shadowOpacity: TOKENS.shadow.shadowOpacity,
  shadowRadius: TOKENS.shadow.shadowRadius,
  shadowOffset: TOKENS.shadow.shadowOffset,
};

// Matte panel helper component - no gradients/overlays/edges
function MattePanel({
  children,
  style,
  focused = false,
  restDim = false,
  radius = TOKENS.radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  focused?: boolean;
  restDim?: boolean;
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
          backgroundColor: TOKENS.color.card,      // solid matte panel
          borderColor: TOKENS.color.borderGlass,   // 1px hairline
          borderWidth: 1,
          borderRadius: radius,
          opacity: restDim ? 0.92 : 1,
        },
        focused ? FOCUS_SHADOW : BASE_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Fallback/demo rounds data - only used when no real workout data is provided
const DEMO_ROUNDS: RoundData[] = [
  {
    label: "Warm-Up",
    workSeconds: 180,
    restSeconds: 30,
    phase: "work",
    exercises: [
      {
        title: "Dynamic Stretching",
        meta: "3 sets, 45s",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Sara", tag: "A2" }]
      },
      {
        title: "Arm Circles & Swings",
        meta: "3 sets, 30s",
        assigned: [
          { clientName: "Max", tag: "B1" },
          { clientName: "Jess", tag: "B2" },
        ]
      },
      {
        title: "Bodyweight Squats",
        meta: "3 sets, 15 reps",
        assigned: [{ clientName: "Tony", tag: "C1" }, { clientName: "Max", tag: "C2" }, { clientName: "Sara", tag: "C3" }]
      }
    ]
  },
  {
    label: "Upper",
    workSeconds: 180,
    restSeconds: 45,
    phase: "work",
    exercises: [
      {
        title: "DB Bench Press",
        meta: "3 sets, 8-10 reps",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Jess", tag: "A2" }]
      },
      {
        title: "Pull-Up Progression",
        meta: "3 sets, 6-8 reps",
        assigned: [
          { clientName: "Max", tag: "B1" },
          { clientName: "Sara", tag: "B2" },
        ]
      },
      {
        title: "Lateral Raises",
        meta: "3 sets, 12-15 reps",
        assigned: [{ clientName: "Jess", tag: "C1" }, { clientName: "Tony", tag: "C2" }]
      }
    ]
  },
  {
    label: "Core",
    workSeconds: 180,
    restSeconds: 45,
    phase: "work",
    exercises: [
      {
        title: "Stir-the-Pot Plank",
        meta: "3 sets, 30-40s",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Jess", tag: "A2" }]
      },
      {
        title: "3-Point DB Row",
        meta: "3 sets, 10-12 reps",
        assigned: [
          { clientName: "Tony", tag: "B1" },
          { clientName: "Max", tag: "B2" },
          { clientName: "Sara", tag: "B3" }
        ]
      },
      {
        title: "Goblet Squat",
        meta: "3 sets, 8-10 reps",
        assigned: [{ clientName: "Jess", tag: "C1" }, { clientName: "Max", tag: "C2" }]
      }
    ]
  },
  {
    label: "Finisher",
    workSeconds: 120,
    restSeconds: 60,
    phase: "work",
    exercises: [
      {
        title: "Battle Ropes",
        meta: "3 sets, 20s",
        assigned: [{ clientName: "Sara", tag: "A1" }, { clientName: "Max", tag: "A2" }]
      },
      {
        title: "Box Jumps",
        meta: "3 sets, 10 reps",
        assigned: [
          { clientName: "Tony", tag: "B1" },
          { clientName: "Jess", tag: "B2" },
        ]
      },
      {
        title: "Farmer's Walk",
        meta: "3 sets, 40m",
        assigned: [{ clientName: "Max", tag: "C1" }, { clientName: "Sara", tag: "C2" }, { clientName: "Tony", tag: "C3" }]
      }
    ]
  }
];

interface RoundViewProps {
  sessionId?: string;
  round?: number;
  workouts?: any[];
  roundsData?: RoundData[];
  organization?: any;
  clients?: any[];
  isPhase2Loading?: boolean;
  phase2Error?: string;
  onTimerUpdate?: (timeRemaining: number, roundIndex: number) => void;
}

export default function RoundView({ sessionId, round, workouts, roundsData, organization, clients, isPhase2Loading, phase2Error, onTimerUpdate }: RoundViewProps = {}) {
  const navigation = useNavigation();
  
  // Use real data if provided, otherwise fall back to mock data
  const rounds = roundsData && roundsData.length > 0 ? roundsData : DEMO_ROUNDS;
  
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes
  const [isPaused, setIsPaused] = useState(isPhase2Loading || false); // Start paused if Phase 2 is loading
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Call timer update on mount and when round changes
  useEffect(() => {
    if (onTimerUpdate) {
      // Reset to initial time when round changes
      const initialTime = 600; // 10 minutes
      onTimerUpdate(initialTime, currentRoundIndex);
    }
  }, [currentRoundIndex]);
  
  // Unpause when Phase 2 completes
  useEffect(() => {
    if (!isPhase2Loading && isPaused && currentRoundIndex === 0) {
      setIsPaused(false);
    }
  }, [isPhase2Loading]);
  
  const currentRound = rounds[currentRoundIndex];
  const nextRound = rounds[(currentRoundIndex + 1) % rounds.length];
  
  // Navigation functions
  const goToNextRound = () => {
    // Check if we're on the last round
    if (currentRoundIndex === rounds.length - 1) {
      // Navigate to completion screen with all necessary data
      navigation.navigate('WorkoutComplete', { 
        sessionId, 
        totalRounds: rounds.length,
        organization,
        workouts,
        clients
      });
    } else {
      // Go to next round
      const nextIndex = currentRoundIndex + 1;
      setCurrentRoundIndex(nextIndex);
      setPhase("work");
      setTimeRemaining(600); // 10 minutes
      if (onTimerUpdate) {
        onTimerUpdate(600, nextIndex);
      }
    }
  };
  
  const goToPreviousRound = () => {
    if (currentRoundIndex === 0) {
      // On first round, go back to workout overview
      navigation.navigate('WorkoutOverview', { 
        sessionId,
        organization,
        workouts,
        clients
      });
    } else {
      // Go to previous round
      const prevIndex = currentRoundIndex - 1;
      setCurrentRoundIndex(prevIndex);
      setPhase("work");
      setTimeRemaining(600); // 10 minutes
      if (onTimerUpdate) {
        onTimerUpdate(600, prevIndex);
      }
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer logic
  useEffect(() => {
    if (!isPaused && timeRemaining === 0) {
      // Time's up, transition to next phase
      if (phase === "work") {
        // Work phase is done, auto-advance to next round
        goToNextRound();
      } else {
        // Rest is over, move to next round
        setPhase("work");
        setCurrentRoundIndex((prevIndex) => (prevIndex + 1) % rounds.length);
        setTimeRemaining(600); // 10 minutes
      }
    }
  }, [timeRemaining, phase, isPaused]);

  useEffect(() => {
    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 1);
          if (onTimerUpdate) {
            onTimerUpdate(newTime, currentRoundIndex);
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused]);

  // Header subline text
  const getSublineText = (): string => {
    if (phase === "work") {
      return `Work • ${currentRound.restSeconds}s rest`;
    } else {
      return `Rest • next: ${nextRound.label}`;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg, padding: 24 }}>

      {/* Header row with title and timer */}
      <View className="flex-row justify-between items-center">
        <View>
          <Text style={{ 
            fontSize: 48, 
            fontWeight: '900', 
            letterSpacing: -0.4,
            lineHeight: 48 * 1.05,
            color: TOKENS.color.text 
          }}>
            {isPhase2Loading && currentRoundIndex === 0 ? 'Finalizing Workout...' : `R${currentRoundIndex + 1}: ${currentRound.label.replace(/^R\d+:\s*/, '')}`}
          </Text>
          {/* Round indicator dots */}
          <View className="flex-row items-center" style={{ gap: 8, marginTop: 12 }}>
            {rounds.map((_, index) => (
              <View
                key={index}
                style={{
                  width: index === currentRoundIndex ? 10 : 8,
                  height: index === currentRoundIndex ? 10 : 8,
                  borderRadius: 5,
                  backgroundColor: index === currentRoundIndex 
                    ? TOKENS.color.accent
                    : index < currentRoundIndex 
                      ? 'rgba(156, 176, 255, 0.6)' // muted color with opacity for completed
                      : 'rgba(156, 176, 255, 0.25)', // even more muted for future
                  transform: index === currentRoundIndex ? [{ scale: 1.25 }] : [],
                }}
              />
            ))}
          </View>
        </View>
        <Text style={{ 
          fontSize: 88, 
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
          lineHeight: 88,
          color: TOKENS.color.text 
        }}>
          {formatTime(timeRemaining)}
        </Text>
      </View>

      {/* Spacer to center cards */}
      <View className="flex-1 justify-center">
        {/* Exercise Cards centered */}
        <View className="flex-row" style={{ gap: 12, width: '100%' }}>
          {currentRound.exercises.map((exercise, index) => (
            <Pressable key={index} focusable hasTVPreferredFocus={index === 0} style={{ flex: 1 }}>
              {({ focused }) => (
                <MattePanel
                  focused={focused}
                  restDim={phase === 'rest'}
                  style={{ padding: 12, minHeight: 180 }}
                >
                  {/* Optional focus ring (on top) */}
                  {focused && (
                    <View pointerEvents="none" style={{
                      position: 'absolute', inset: -1,
                      borderRadius: TOKENS.radius.card,
                      borderWidth: 2, borderColor: TOKENS.color.focusRing,
                    }}/>
                  )}

                  {/* Check if this is a superset */}
                  {exercise.exerciseDetails && exercise.exerciseDetails.length > 1 ? (
                    // Render superset with stacked exercises
                    <View>
                      {exercise.exerciseDetails.map((detail, detailIndex) => (
                        <View key={detail.exerciseId} style={{ marginBottom: detailIndex < exercise.exerciseDetails.length - 1 ? 12 : 0 }}>
                          <Text style={{ 
                            fontSize: 20, 
                            color: TOKENS.color.text, 
                            fontWeight: '900', 
                            letterSpacing: 0.2,
                            lineHeight: 24,
                            marginBottom: 4 
                          }}>
                            {detail.title}
                          </Text>
                          <Text style={{ fontSize: 15, color: TOKENS.color.text }}>
                            {detail.meta}
                          </Text>
                          {/* Add superset indicator */}
                          {detailIndex < exercise.exerciseDetails.length - 1 && (
                            <Text style={{ fontSize: 14, color: TOKENS.color.muted, textAlign: 'center', marginTop: 4 }}>
                              +
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    // Render single exercise
                    <>
                      <Text style={{ 
                        fontSize: 20, 
                        color: TOKENS.color.text, 
                        fontWeight: '900', 
                        letterSpacing: 0.2,
                        lineHeight: 24,
                        marginBottom: 4 
                      }}>
                        {exercise.exerciseDetails?.[0]?.title || exercise.title}
                      </Text>
                      <Text style={{ fontSize: 15, color: TOKENS.color.text, marginBottom: 8 }}>
                        {exercise.exerciseDetails?.[0]?.meta || exercise.meta}
                      </Text>
                    </>
                  )}

                  {/* Assignment chips */}
                  <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                    {exercise.assigned.map((a, chipIndex) => (
                      <View key={chipIndex} className="flex-row items-center border"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderColor: TOKENS.color.borderGlass,
                          borderRadius: TOKENS.radius.chip,
                          paddingVertical: 5,
                          paddingHorizontal: 8,
                        }}>
                        <View style={{ 
                          width: 16, 
                          height: 16, 
                          borderRadius: 8, 
                          backgroundColor: a.tag?.includes('🏆') ? '#FFD700' : TOKENS.color.accent, 
                          marginRight: 6 
                        }} />
                        <Text style={{ fontSize: 11.5, color: TOKENS.color.text, fontWeight: '700' }}>
                          {a.clientName}
                          {a.tag && (
                            <Text style={{ 
                              color: a.tag.includes('🏆') ? '#FFD700' : TOKENS.color.muted,
                              fontWeight: '600' 
                            }}>
                              {' • '}{a.tag}
                            </Text>
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                </MattePanel>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      
      {/* Navigation buttons */}
      <View className="flex-row justify-center items-center mt-6" style={{ gap: 24 }}>
        <Pressable
          onPress={goToPreviousRound}
          focusable={!isPhase2Loading}
          disabled={isPhase2Loading}
        >
          {({ focused }) => (
            <LightingButtonWrapper
              sessionId={sessionId || ''}
              roundNumber={Math.max(1, currentRoundIndex)}
              focused={focused}
            >
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  transform: focused ? [{ translateY: -1 }] : [],
                  opacity: isPhase2Loading ? 0.5 : 1,
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Previous</Text>
              </MattePanel>
            </LightingButtonWrapper>
          )}
        </Pressable>
        
        <Pressable
          onPress={() => {
            setIsPaused(!isPaused);
          }}
          focusable
        >
          {({ focused }) => (
            <LightingButtonWrapper
              sessionId={sessionId || ''}
              roundNumber={currentRoundIndex + 1}
              focused={focused}
            >
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18 }}>{isPaused ? '▶' : '❚❚'}</Text>
              </MattePanel>
            </LightingButtonWrapper>
          )}
        </Pressable>
        
        <Pressable
          onPress={goToNextRound}
          focusable={!isPhase2Loading}
          disabled={isPhase2Loading}
        >
          {({ focused }) => (
            <LightingButtonWrapper
              sessionId={sessionId || ''}
              roundNumber={Math.min(rounds.length, currentRoundIndex + 2)}
              focused={focused}
            >
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  transform: focused ? [{ translateY: -1 }] : [],
                  opacity: isPhase2Loading ? 0.5 : 1,
                }}
              >
                <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Next</Text>
              </MattePanel>
            </LightingButtonWrapper>
          )}
        </Pressable>
      </View>
    </View>
  );
}