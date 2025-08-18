import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Pressable } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

interface WorkoutGenerationLoaderProps {
  clientNames: string[];
  onCancel?: () => void;
  durationMinutes?: number; // Duration in minutes
  forceComplete?: boolean; // Force progress to 100% immediately
}

const MESSAGES = [
  'Warming up…',
  'Measuring rest times…',
  'Balancing push / pull…',
  'Reserving equipment…',
  'Picking a spicy finisher…',
  'Almost there…'
];

export function WorkoutGenerationLoader({ clientNames, onCancel, durationMinutes = 1, forceComplete = false }: WorkoutGenerationLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Calculate interval based on duration
  const durationMs = durationMinutes * 60 * 1000; // Convert to milliseconds
  const updateInterval = durationMs / 100; // Update every 1% of progress
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const swingAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const completeScaleAnim = useRef(new Animated.Value(1)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
  
  // Pulse animation for background glow
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Kettlebell swing animation - smooth continuous motion
  useEffect(() => {
    // Start from center (0)
    swingAnim.setValue(0);
    
    const swing = Animated.loop(
      Animated.sequence([
        // Swing to right
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        // Swing through center to left
        Animated.timing(swingAnim, {
          toValue: -1,
          duration: 2400,
          useNativeDriver: true,
        }),
        // Swing back to right
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    );
    swing.start();
    return () => swing.stop();
  }, []);

  // Orbit rotation
  useEffect(() => {
    // Reset to starting position
    orbitRotation.setValue(0);
    
    const orbit = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    );
    orbit.start();
    return () => orbit.stop();
  }, []);

  // Progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) {
          clearInterval(interval);
          handleComplete();
          return 100;
        }
        // Smooth linear progression
        return Math.min(99, prev + 1);
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  // Handle force complete
  useEffect(() => {
    if (forceComplete && progress < 100) {
      // Quickly animate to 100%
      const rapidInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(rapidInterval);
            handleComplete();
            return 100;
          }
          // Jump by 10% each frame for quick completion
          return Math.min(100, prev + 10);
        });
      }, 50); // Update every 50ms for smooth but fast animation

      return () => clearInterval(rapidInterval);
    }
  }, [forceComplete]);

  // Update progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: forceComplete ? 50 : 220, // Faster animation when force completing
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim, forceComplete]);

  // Message rotation
  useEffect(() => {
    // Change message every ~15% of progress
    const messageChangeInterval = Math.floor(100 / MESSAGES.length);
    if (progress > 0 && progress % messageChangeInterval === 0) {
      setMessageIndex(prev => (prev + 1) % MESSAGES.length);
    }
  }, [progress]);

  // Completion animation
  const handleComplete = () => {
    setIsComplete(true);
    // Slam effect
    Animated.sequence([
      Animated.timing(completeScaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(completeScaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotation = swingAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-18deg', '18deg'],
  });

  const orbitSpin = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#070b18' }}>
      {/* Gradient background simulation using overlapping views */}
      <View style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0f22',
      }}>
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '60%',
          height: '60%',
          backgroundColor: '#101a44',
          opacity: 0.7,
          borderBottomRightRadius: 1000,
        }} />
        <View style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '50%',
          height: '50%',
          backgroundColor: '#060913',
          opacity: 0.8,
          borderTopLeftRadius: 800,
        }} />
      </View>

      {/* Main content - centered container */}
      <View style={{ 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center',
        paddingHorizontal: 40,
      }}>
        {/* Card container */}
        <View style={{
          width: Math.min(600, screenWidth * 0.8),
          maxHeight: screenHeight * 0.85,
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(93,225,255,0.06)',
          }}>
            {/* Logo */}
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#0f1a3a',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Text style={{ fontSize: 20 }}>💪</Text>
            </View>
            
            <View>
              <Text style={{
                color: '#d8e2ff',
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: 0.2,
              }}>
                Loading your workout
              </Text>
              <Text style={{
                color: '#9cb0ff',
                fontSize: 13,
                marginTop: 1,
              }}>
                Balancing muscles • Checking equipment
              </Text>
            </View>
          </View>

          {/* Stage */}
          <View style={{ paddingVertical: 16, paddingHorizontal: 20 }}>
            {/* Arena */}
            <View style={{
              width: 180,
              height: 180,
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              {/* Pulse background */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: 'rgba(124,255,181,0.1)',
                  transform: [{ scale: pulseAnim }],
                }}
              />

              {/* Orbit ring */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  borderWidth: 4,
                  borderColor: 'rgba(93,225,255,0.3)',
                  borderStyle: 'dashed',
                  transform: [{ rotate: orbitSpin }],
                }}
              />

              {/* Kettlebell container */}
              <Animated.View
                style={{
                  transform: [{ rotate: rotation }],
                  transformOrigin: 'center bottom',
                }}
              >
                <Animated.View
                  style={{
                    transform: isComplete ? [{ scale: completeScaleAnim }] : [],
                  }}
                >
                  {/* Kettlebell shape using View components */}
                  <View style={{ alignItems: 'center' }}>
                    {/* Handle */}
                    <View style={{
                      width: 38,
                      height: 19,
                      borderTopLeftRadius: 19,
                      borderTopRightRadius: 19,
                      borderWidth: 5,
                      borderColor: '#c7ddff',
                      borderBottomWidth: 0,
                      marginBottom: -2,
                    }} />
                    {/* Body */}
                    <View style={{
                      width: 56,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#7cffb5',
                      overflow: 'hidden',
                    }}>
                      {/* Gradient effect using overlays */}
                      <View style={{
                        position: 'absolute',
                        top: -12,
                        left: -12,
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#6ff7ff',
                        opacity: 0.7,
                      }} />
                      {/* Shine */}
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        width: 16,
                        height: 12,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.4)',
                      }} />
                    </View>
                  </View>
                </Animated.View>
              </Animated.View>

            </View>

            {/* Readout */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 42,
                fontWeight: '900',
                color: '#d8e2ff',
                letterSpacing: -0.6,
                marginBottom: 6,
              }}>
                {progress}%
              </Text>
              
              <Text style={{
                color: '#9cb0ff',
                fontSize: 14,
                marginBottom: 16,
                minHeight: 20,
              }}>
                {isComplete ? "Let's go!" : MESSAGES[messageIndex]}
              </Text>

              {/* Progress bar */}
              <View style={{
                width: Math.min(400, screenWidth * 0.7),
                height: 10,
                borderRadius: 5,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: '#7cffb5',
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }}
                >
                  {/* Gradient simulation */}
                  <View style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '30%',
                    backgroundColor: '#5de1ff',
                    opacity: 0.6,
                  }} />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(124,255,181,0.04)',
          }}>
            <Text style={{
              color: '#a9b8ff',
              fontSize: 11,
              flex: 1,
              marginRight: 10,
            }}>
              Tip: Finding the perfect exercises for {clientNames.length} clients
            </Text>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#7cffb5',
                marginRight: 8,
              }} />
              <Text style={{
                color: '#d8e2ff',
                fontSize: 11,
                fontFamily: 'monospace',
              }}>
                AI • optimizing
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      {/* Cancel button - fixed position */}
      {onCancel && !isComplete && (
        <Pressable
          onPress={onCancel}
          focusable
          style={{
            position: 'absolute',
            bottom: 30,
            left: 40,
          }}
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
              <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Cancel</Text>
            </MattePanel>
          )}
        </Pressable>
      )}
    </View>
  );
}