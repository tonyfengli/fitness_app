import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Render latency offset (time from transition trigger to screen visible)
const RENDER_LATENCY_MS = 150;

// Design tokens
const TOKENS = {
  color: {
    accent: '#FF6B35',      // Main accent (orange)
    accentGlow: '#FF8C5A',  // Lighter accent for glow
    text: '#ffffff',
    muted: '#9cb0ff',
  },
};

// Display phases for the countdown
type DisplayPhase = 'ready' | 3 | 2 | 1 | 'complete';

interface RiseCountdownOverlayProps {
  /** Absolute timestamp (ms) when the drop should hit - source of truth for timing */
  dropTime: number | null;
  /** Whether the overlay should be visible */
  isVisible: boolean;
  /** Callback fired when countdown completes (RENDER_LATENCY_MS before dropTime if useLatencyOffset is true) */
  onComplete?: () => void;
  /** Callback fired early to prepare audio (accounts for track loading latency) */
  onAudioPrepare?: () => void;
  /** How many ms before completion to fire onAudioPrepare (default: 1000ms) */
  audioPrepareLead?: number;
  /** Debug mode: always show overlay with a static number */
  debug?: boolean;
  /** Whether to apply render latency offset (default: true for Rise, set false for High) */
  useLatencyOffset?: boolean;
}

/**
 * Full-screen overlay that displays an energizing countdown (3, 2, 1) before the music drop.
 *
 * Timing is based on setTimeout scheduled from dropTime for millisecond precision:
 * - GET READY: Shows immediately when visible, until 3 seconds before drop
 * - "3": Shows at dropTime - 3000ms
 * - "2": Shows at dropTime - 2000ms
 * - "1": Shows at dropTime - 1000ms
 * - onComplete: Fires at dropTime - RENDER_LATENCY_MS
 */
export function RiseCountdownOverlay({
  dropTime,
  isVisible,
  onComplete,
  onAudioPrepare,
  audioPrepareLead = 1000,
  debug = false,
  useLatencyOffset = true,
}: RiseCountdownOverlayProps) {
  // Current display phase - controlled by scheduled setTimeouts
  const [displayPhase, setDisplayPhase] = useState<DisplayPhase>('ready');

  // Track if we've triggered onComplete to prevent double-firing
  const hasCompletedRef = useRef(false);
  // Track if we've triggered onAudioPrepare to prevent double-firing
  const hasAudioPreparedRef = useRef(false);

  // Animation values
  const numberScale = useRef(new Animated.Value(1)).current;
  const numberOpacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const outerRingScale = useRef(new Animated.Value(1)).current;
  const outerRingOpacity = useRef(new Animated.Value(0.3)).current;

  // Track previous display phase for animations
  const prevPhaseRef = useRef<DisplayPhase>('ready');

  // Schedule all countdown phases and transition based on dropTime
  useEffect(() => {
    if (!isVisible || !dropTime) {
      // Reset state when not visible
      setDisplayPhase('ready');
      hasCompletedRef.current = false;
      hasAudioPreparedRef.current = false;
      return;
    }

    const now = Date.now();
    const timeToGo = dropTime - now;

    // Calculate the latency to apply (0 if disabled)
    const latencyMs = useLatencyOffset ? RENDER_LATENCY_MS : 0;

    // If dropTime already passed, trigger complete immediately
    if (timeToGo <= latencyMs) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setDisplayPhase('complete');
        onComplete?.();
      }
      return;
    }

    // Calculate delays for each phase (relative to now)
    const showThreeAt = Math.max(0, timeToGo - 3000);
    const showTwoAt = Math.max(0, timeToGo - 2000);
    const showOneAt = Math.max(0, timeToGo - 1000);
    const completeAt = Math.max(0, timeToGo - latencyMs);

    // Determine initial phase based on current time
    if (timeToGo > 3000) {
      setDisplayPhase('ready');
    } else if (timeToGo > 2000) {
      setDisplayPhase(3);
    } else if (timeToGo > 1000) {
      setDisplayPhase(2);
    } else {
      setDisplayPhase(1);
    }

    const timers: NodeJS.Timeout[] = [];

    // Schedule phase transitions (only if they're in the future)
    if (showThreeAt > 0) {
      timers.push(setTimeout(() => setDisplayPhase(3), showThreeAt));
    }
    if (showTwoAt > 0) {
      timers.push(setTimeout(() => setDisplayPhase(2), showTwoAt));
    }
    if (showOneAt > 0) {
      timers.push(setTimeout(() => setDisplayPhase(1), showOneAt));
    }

    // Schedule audio prepare callback (fires early to account for loading latency)
    if (onAudioPrepare) {
      const audioPrepareAt = Math.max(0, completeAt - audioPrepareLead);
      if (audioPrepareAt > 0) {
        timers.push(setTimeout(() => {
          if (!hasAudioPreparedRef.current) {
            hasAudioPreparedRef.current = true;
            console.log('[RiseCountdownOverlay] Audio prepare callback fired');
            onAudioPrepare();
          }
        }, audioPrepareAt));
      } else if (!hasAudioPreparedRef.current) {
        // If audioPrepareAt is 0 or negative, fire immediately
        hasAudioPreparedRef.current = true;
        console.log('[RiseCountdownOverlay] Audio prepare callback fired immediately');
        onAudioPrepare();
      }
    }

    // Schedule completion
    timers.push(setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setDisplayPhase('complete');
        onComplete?.();
      }
    }, completeAt));

    console.log('[RiseCountdownOverlay] Scheduled timers:', {
      timeToGo,
      showThreeAt,
      showTwoAt,
      showOneAt,
      audioPrepareAt: onAudioPrepare ? Math.max(0, completeAt - audioPrepareLead) : 'n/a',
      completeAt,
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isVisible, dropTime, onComplete, onAudioPrepare, audioPrepareLead, useLatencyOffset]);

  // Number punch animation when display phase changes to a number
  useEffect(() => {
    const isNumber = typeof displayPhase === 'number';
    const wasNumber = typeof prevPhaseRef.current === 'number';

    if (isNumber && displayPhase !== prevPhaseRef.current) {
      // Punch animation for new number
      numberScale.setValue(0.3);
      numberOpacity.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.spring(numberScale, {
            toValue: 1.1,
            tension: 200,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(numberScale, {
            toValue: 1,
            tension: 100,
            friction: 10,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(numberOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }

    prevPhaseRef.current = displayPhase;
  }, [displayPhase]);

  // Continuous pulsing animation for the energy rings (only during number phases)
  useEffect(() => {
    const isNumberPhase = typeof displayPhase === 'number';

    if (!isVisible || !isNumberPhase) {
      return;
    }

    // Inner ring pulse - faster, more intense
    const innerPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.8,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.5,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Outer ring pulse - slower, breathing effect
    const outerPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(outerRingScale, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(outerRingOpacity, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(outerRingScale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(outerRingOpacity, {
            toValue: 0.2,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    innerPulse.start();
    outerPulse.start();

    return () => {
      innerPulse.stop();
      outerPulse.stop();
    };
  }, [isVisible, displayPhase]);

  // Reset animations when overlay hides
  useEffect(() => {
    if (!isVisible) {
      numberScale.setValue(1);
      numberOpacity.setValue(1);
      ringScale.setValue(1);
      ringOpacity.setValue(0.6);
      outerRingScale.setValue(1);
      outerRingOpacity.setValue(0.3);
      prevPhaseRef.current = 'ready';
    }
  }, [isVisible]);

  // Don't render if not visible or already complete (unless debug mode)
  if (!debug && (!isVisible || displayPhase === 'complete')) {
    return null;
  }

  // In debug mode, always show "3"
  const debugDisplayPhase: DisplayPhase = debug ? 3 : displayPhase;
  const isReadyPhase = debugDisplayPhase === 'ready';
  const displayNumber = typeof debugDisplayPhase === 'number' ? debugDisplayPhase : 3;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Content container */}
      <View style={styles.content}>
        {/* Phase 1: GET READY (before 3-second countdown) */}
        {isReadyPhase && (
          <Text style={styles.readyText}>
            GET READY
          </Text>
        )}

        {/* Phase 2: Countdown with rings and glow (3, 2, 1) */}
        {!isReadyPhase && (
          <View style={styles.numberContainer}>
            {/* Radial glow effect (behind everything) */}
            <View style={styles.glowContainer}>
              <View style={styles.glowOuter} />
              <View style={styles.glowMiddle} />
              <View style={styles.glowInner} />
            </View>
            {/* Outer energy ring */}
            <Animated.View
              style={[
                styles.energyRing,
                styles.outerRing,
                {
                  transform: [{ scale: outerRingScale }],
                  opacity: outerRingOpacity,
                },
              ]}
            />

            {/* Inner energy ring */}
            <Animated.View
              style={[
                styles.energyRing,
                styles.innerRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />

            {/* The countdown number */}
            <Animated.Text
              style={[
                styles.countdownNumber,
                {
                  transform: [{ scale: numberScale }],
                  opacity: numberOpacity,
                },
              ]}
            >
              {displayNumber}
            </Animated.Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    // Full screen positioning - rendered at screen root level
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    zIndex: 9999,
    elevation: 9999,
  },

  // Radial glow effect - centered within numberContainer (280x280)
  glowContainer: {
    position: 'absolute',
    width: 600,
    height: 600,
    // Center the 600x600 glow in the 280x280 container: (280-600)/2 = -160
    top: -160,
    left: -160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: TOKENS.color.accent,
    opacity: 0.03,
  },
  glowMiddle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: TOKENS.color.accent,
    opacity: 0.05,
  },
  glowInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: TOKENS.color.accentGlow,
    opacity: 0.08,
  },

  content: {
    alignItems: 'center',
  },

  readyText: {
    fontSize: 90,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.7,
    letterSpacing: 12,
    textTransform: 'uppercase',
  },

  numberContainer: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },

  energyRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: TOKENS.color.accent,
  },
  outerRing: {
    width: 280,
    height: 280,
  },
  innerRing: {
    width: 220,
    height: 220,
    borderWidth: 4,
  },

  countdownNumber: {
    fontSize: 180,
    fontWeight: '900',
    color: TOKENS.color.text,
    textShadowColor: TOKENS.color.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
});
