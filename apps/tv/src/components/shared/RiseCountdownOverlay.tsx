import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design tokens
const TOKENS = {
  color: {
    accent: '#FF6B35',      // Main accent (orange)
    accentGlow: '#FF8C5A',  // Lighter accent for glow
    text: '#ffffff',
    muted: '#9cb0ff',
  },
};

interface RiseCountdownOverlayProps {
  /** Current countdown value (seconds remaining until drop) */
  countdown: number | null;
  /** Whether the overlay should be visible */
  isVisible: boolean;
  /** Only show countdown when it reaches this threshold (default: 3) */
  threshold?: number;
  /** Debug mode: always show overlay with a static number */
  debug?: boolean;
  /** Keep overlay visible even after countdown ends (prevents flash before transition) */
  holdAfterComplete?: boolean;
}

/**
 * Full-screen overlay that displays an energizing countdown (3, 2, 1) before the music drop.
 * Features pulsing energy rings and punchy number animations to build hype.
 */
export function RiseCountdownOverlay({
  countdown,
  isVisible,
  threshold = 3,
  debug = false,
  holdAfterComplete = false,
}: RiseCountdownOverlayProps) {
  // Track if we've shown the countdown (to hold overlay after completion)
  const hasShownCountdown = useRef(false);
  // Animation values
  const numberScale = useRef(new Animated.Value(1)).current;
  const numberOpacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const outerRingScale = useRef(new Animated.Value(1)).current;
  const outerRingOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  // Track previous countdown to detect changes
  const prevCountdown = useRef<number | null>(null);

  // Continuous pulsing animation for the energy rings
  useEffect(() => {
    if (!isVisible || countdown === null || countdown > threshold || countdown <= 0) {
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
  }, [isVisible, countdown, threshold]);

  // Number punch animation when countdown changes
  useEffect(() => {
    if (countdown === null || countdown > threshold || countdown <= 0) {
      prevCountdown.current = null;
      return;
    }

    // Round to whole number for animation trigger (only animate on 3, 2, 1 changes)
    const currentDisplayNumber = Math.ceil(countdown);
    const prevDisplayNumber = prevCountdown.current !== null ? Math.ceil(prevCountdown.current) : null;

    // Only animate if the displayed number actually changed
    if (prevDisplayNumber !== currentDisplayNumber) {
      // Reset and punch in
      numberScale.setValue(0.3);
      numberOpacity.setValue(0);

      Animated.parallel([
        // Scale: small -> overshoot -> settle
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
        // Fade in quickly
        Animated.timing(numberOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // Fade out "GET READY" text after first number appears
      if (prevCountdown.current === null || prevCountdown.current > threshold) {
        Animated.timing(textOpacity, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }

    prevCountdown.current = countdown;
  }, [countdown, threshold]);

  // Reset animations when overlay hides
  useEffect(() => {
    if (!isVisible) {
      numberScale.setValue(1);
      numberOpacity.setValue(1);
      ringScale.setValue(1);
      ringOpacity.setValue(0.6);
      outerRingScale.setValue(1);
      outerRingOpacity.setValue(0.3);
      textOpacity.setValue(1);
      prevCountdown.current = null;
    }
  }, [isVisible]);

  // Only render when visible, countdown is active, and within extended threshold (5 seconds total)
  // First 2 seconds: GET READY, Last 3 seconds: countdown numbers
  // Debug mode bypasses all checks
  const extendedThreshold = threshold + 2; // 5 seconds total

  // Track if we've entered the countdown phase
  if (isVisible && countdown !== null && countdown <= extendedThreshold && countdown > 0) {
    hasShownCountdown.current = true;
  }

  // Reset tracking when overlay becomes invisible
  if (!isVisible) {
    hasShownCountdown.current = false;
  }

  // Determine if we should hold the overlay (countdown finished but transition hasn't happened)
  const shouldHold = holdAfterComplete && hasShownCountdown.current && isVisible && (countdown === null || countdown <= 0);

  if (!debug && !shouldHold && (!isVisible || countdown === null || countdown > extendedThreshold || countdown <= 0)) {
    return null;
  }

  // Round countdown to whole number for display (always show 3, 2, 1)
  // In debug mode, show static "3". When holding, show 1.
  const displayNumber = debug ? 3 : (shouldHold ? 1 : Math.ceil(countdown!));

  // Determine phase: "ready" (first 2 sec) or "countdown" (last 3 sec)
  // When holding, show countdown phase
  const isReadyPhase = !debug && !shouldHold && countdown !== null && countdown > threshold;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Content container */}
      <View style={styles.content}>
        {/* Phase 1: GET READY (first 2 seconds) */}
        {isReadyPhase && (
          <Text style={styles.readyText}>
            GET READY
          </Text>
        )}

        {/* Phase 2: Countdown with rings and glow (last 3 seconds) */}
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
    // Use extended dimensions and negative offsets to break out of parent padding
    width: SCREEN_WIDTH + 48,
    height: SCREEN_HEIGHT + 200,
    top: -200,
    left: -48,
    paddingBottom: 60,   // Push content up to center on screen
    paddingLeft: 0,      // Shifted left
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
