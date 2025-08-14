import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';

// Types
type Assignment = { clientName: string; tag: string };
type Exercise = { title: string; meta: string; assigned: Assignment[] };
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
    text: '#d8e2ff',
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

// Example rounds data
const ROUNDS: RoundData[] = [
  {
    label: "Round 1 • Warm-Up",
    workSeconds: 180,
    restSeconds: 30,
    phase: "work",
    exercises: [
      {
        title: "Dynamic Stretching",
        meta: "Mobility • 3×: 45s • Light Movement",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Sara", tag: "A2" }]
      },
      {
        title: "Arm Circles & Swings",
        meta: "Upper Warm-Up • 3×: 30s • Both Directions",
        assigned: [
          { clientName: "Max", tag: "B1" },
          { clientName: "Jess", tag: "B2" },
        ]
      },
      {
        title: "Bodyweight Squats",
        meta: "Lower Warm-Up • 3×: 15 reps • Controlled",
        assigned: [{ clientName: "Tony", tag: "C1" }, { clientName: "Max", tag: "C2" }, { clientName: "Sara", tag: "C3" }]
      }
    ]
  },
  {
    label: "Round 2 • Upper",
    workSeconds: 180,
    restSeconds: 45,
    phase: "work",
    exercises: [
      {
        title: "DB Bench Press",
        meta: "Upper Push • 3×: 8-10 • RPE 7",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Jess", tag: "A2" }]
      },
      {
        title: "Pull-Up Progression",
        meta: "Upper Pull • 3×: 6-8 • Full ROM",
        assigned: [
          { clientName: "Max", tag: "B1" },
          { clientName: "Sara", tag: "B2" },
        ]
      },
      {
        title: "Lateral Raises",
        meta: "Shoulders • 3×: 12-15 • Light Weight",
        assigned: [{ clientName: "Jess", tag: "C1" }, { clientName: "Tony", tag: "C2" }]
      }
    ]
  },
  {
    label: "Round 3 • Core",
    workSeconds: 180,
    restSeconds: 45,
    phase: "work",
    exercises: [
      {
        title: "Stir-the-Pot Plank",
        meta: "Core • 3×: 30-40s • Tempo 2-1-2",
        assigned: [{ clientName: "Tony", tag: "A1" }, { clientName: "Jess", tag: "A2" }]
      },
      {
        title: "3-Point DB Row",
        meta: "Upper Pull • 3×: 10-12/side • RPE 7",
        assigned: [
          { clientName: "Tony", tag: "B1" },
          { clientName: "Max", tag: "B2" },
          { clientName: "Sara", tag: "B3" }
        ]
      },
      {
        title: "Goblet Squat",
        meta: "Lower Push • 3×: 8-10 • Slow Eccentric",
        assigned: [{ clientName: "Jess", tag: "C1" }, { clientName: "Max", tag: "C2" }]
      }
    ]
  },
  {
    label: "Round 4 • Finisher",
    workSeconds: 120,
    restSeconds: 60,
    phase: "work",
    exercises: [
      {
        title: "Battle Ropes",
        meta: "Conditioning • 3×: 20s • Max Effort",
        assigned: [{ clientName: "Sara", tag: "A1" }, { clientName: "Max", tag: "A2" }]
      },
      {
        title: "Box Jumps",
        meta: "Power • 3×: 10 reps • Explosive",
        assigned: [
          { clientName: "Tony", tag: "B1" },
          { clientName: "Jess", tag: "B2" },
        ]
      },
      {
        title: "Farmer's Walk",
        meta: "Full Body • 3×: 40m • Heavy",
        assigned: [{ clientName: "Max", tag: "C1" }, { clientName: "Sara", tag: "C2" }, { clientName: "Tony", tag: "C3" }]
      }
    ]
  }
];

export default function RoundView() {
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [timeRemaining, setTimeRemaining] = useState(ROUNDS[0].workSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentRound = ROUNDS[currentRoundIndex];
  const nextRound = ROUNDS[(currentRoundIndex + 1) % ROUNDS.length];

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer logic
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up, transition to next phase
          if (phase === "work") {
            setPhase("rest");
            return currentRound.restSeconds;
          } else {
            // Rest is over, move to next round
            setPhase("work");
            setCurrentRoundIndex((prevIndex) => (prevIndex + 1) % ROUNDS.length);
            return ROUNDS[(currentRoundIndex + 1) % ROUNDS.length].workSeconds;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [phase, currentRoundIndex, currentRound.restSeconds]);

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
        <Text style={{ 
          fontSize: 48, 
          fontWeight: '900', 
          letterSpacing: -0.4,
          lineHeight: 48 * 1.05,
          color: TOKENS.color.text 
        }}>
          {currentRound.label}
        </Text>
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

                  {/* Title */}
                  <Text style={{ 
                    fontSize: 20, 
                    color: TOKENS.color.text, 
                    fontWeight: '900', 
                    letterSpacing: 0.2,
                    lineHeight: 24,
                    marginBottom: 4 
                  }}>
                    {exercise.title}
                  </Text>

                  {/* Meta */}
                  <Text style={{ fontSize: 13, color: TOKENS.color.muted, marginBottom: 8 }}>
                    {exercise.meta}
                  </Text>

                  {/* Assignment chips */}
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {exercise.assigned.map((a, chipIndex) => (
                      <View key={chipIndex} className="flex-row items-center border"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderColor: TOKENS.color.borderGlass,
                          borderRadius: TOKENS.radius.chip,
                          paddingVertical: 5,
                          paddingHorizontal: 8,
                        }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: TOKENS.color.accent, marginRight: 6 }} />
                        <Text style={{ fontSize: 11.5, color: TOKENS.color.text, fontWeight: '700', marginRight: 4 }}>{a.clientName}</Text>
                        <Text style={{ fontSize: 10, color: TOKENS.color.muted }}>{a.tag}</Text>
                      </View>
                    ))}
                  </View>
                </MattePanel>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}