import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WorkoutGenerationLoaderProps {
  clientNames: string[];
  onCancel?: () => void;
}

const MESSAGES = [
  'Warming up…',
  'Measuring rest times…',
  'Balancing push / pull…',
  'Reserving equipment…',
  'Picking a spicy finisher…',
  'Syncing your playlist…',
  'Almost there…'
];

export function WorkoutGenerationLoader({ clientNames, onCancel }: WorkoutGenerationLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
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
  }, [pulseAnim]);

  // Kettlebell swing animation
  useEffect(() => {
    const swing = Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(swingAnim, {
          toValue: -1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    swing.start();
    return () => swing.stop();
  }, [swingAnim]);

  // Orbit rotation
  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    );
    orbit.start();
    return () => orbit.stop();
  }, [orbitRotation]);

  // Progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) {
          clearInterval(interval);
          handleComplete();
          return 100;
        }
        const remaining = 100 - prev;
        const step = Math.max(1, Math.round(Math.random() * Math.max(1, remaining / 9)));
        return Math.min(99, prev + step);
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Update progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Message rotation
  useEffect(() => {
    if (progress % 13 < 3) {
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
                Balancing muscles • Checking equipment • Syncing beats
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
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: 'rgba(124,255,181,0.1)',
                  transform: [{ scale: pulseAnim }],
                }}
              />

              {/* Orbit ring */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  borderWidth: 5,
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
                      width: 48,
                      height: 24,
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      borderWidth: 6,
                      borderColor: '#c7ddff',
                      borderBottomWidth: 0,
                      marginBottom: -3,
                    }} />
                    {/* Body */}
                    <View style={{
                      width: 70,
                      height: 55,
                      borderRadius: 28,
                      backgroundColor: '#7cffb5',
                      overflow: 'hidden',
                    }}>
                      {/* Gradient effect using overlays */}
                      <View style={{
                        position: 'absolute',
                        top: -15,
                        left: -15,
                        width: 45,
                        height: 45,
                        borderRadius: 23,
                        backgroundColor: '#6ff7ff',
                        opacity: 0.7,
                      }} />
                      {/* Shine */}
                      <View style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        width: 20,
                        height: 15,
                        borderRadius: 10,
                        backgroundColor: 'rgba(255,255,255,0.4)',
                      }} />
                    </View>
                  </View>
                </Animated.View>
              </Animated.View>

              {/* Spark effects (simplified) */}
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: '#b8ffe0',
                    opacity: 0.7,
                    top: i % 2 ? '10%' : '80%',
                    left: i < 2 ? '15%' : '85%',
                  }}
                />
              ))}
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
        <TouchableOpacity
          onPress={onCancel}
          style={{
            position: 'absolute',
            bottom: 30,
            left: 40,
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
          activeOpacity={0.7}
          tvParallaxProperties={{
            enabled: true,
            shiftDistanceX: 2,
            shiftDistanceY: 2,
          }}
        >
          <Text style={{ color: '#9cb0ff', fontSize: 14 }}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}