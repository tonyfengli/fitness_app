import React, { useCallback, useRef } from 'react';
import { View, Pressable, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TOKENS } from './types';
import { MattePanel } from './MattePanel';

interface VolumeControlProps {
  volume: number; // 0.0 to 1.0
  onVolumeChange: (volume: number) => void;
  focusable?: boolean;
  isStationsExercise?: boolean;
  isMusicPlaying?: boolean;
}

const VOLUME_STEP = 0.1; // 10% per step
const VOLUME_LEVELS = 5; // Number of bars in the indicator

/**
 * TV-optimized Volume Control
 *
 * Features:
 * - Volume up/down buttons for D-pad navigation
 * - Visual volume level indicator (5 bars)
 * - Haptic-like visual feedback on press
 * - Matches existing workout controls styling
 */
export function VolumeControl({
  volume,
  onVolumeChange,
  focusable = true,
  isStationsExercise = false,
  isMusicPlaying = false,
}: VolumeControlProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  const handleVolumeDown = useCallback(() => {
    animatePress();
    const newVolume = Math.max(0, volume - VOLUME_STEP);
    onVolumeChange(newVolume);
  }, [volume, onVolumeChange, animatePress]);

  const handleVolumeUp = useCallback(() => {
    animatePress();
    const newVolume = Math.min(1, volume + VOLUME_STEP);
    onVolumeChange(newVolume);
  }, [volume, onVolumeChange, animatePress]);

  // Calculate which bars should be lit (out of 5)
  const activeBars = Math.round(volume * VOLUME_LEVELS);
  const isMuted = volume === 0;

  // Get the appropriate volume icon
  const getVolumeIcon = () => {
    if (isMuted) return 'volume-off';
    if (volume < 0.33) return 'volume-down';
    if (volume < 0.66) return 'volume-down';
    return 'volume-up';
  };

  // Colors based on state
  const activeColor = isMusicPlaying ? TOKENS.color.accent2 : (isStationsExercise ? '#ffb366' : TOKENS.color.text);
  const inactiveColor = isStationsExercise ? 'rgba(255,179,102,0.2)' : 'rgba(255,255,255,0.15)';
  const bgColor = isStationsExercise ? 'rgba(255,179,102,0.1)' : 'rgba(255,255,255,0.06)';
  const focusBgColor = isStationsExercise ? 'rgba(255,179,102,0.2)' : 'rgba(255,255,255,0.15)';
  const focusBorderColor = isStationsExercise ? 'rgba(255,179,102,0.4)' : 'rgba(255,255,255,0.25)';

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        transform: [{ scale: scaleAnim }],
      }}
    >
      {/* Volume Down Button */}
      <Pressable onPress={handleVolumeDown} focusable={focusable}>
        {({ focused }) => (
          <MattePanel
            focused={focused}
            radius={18}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? focusBgColor : bgColor,
              borderColor: focused ? focusBorderColor : 'transparent',
              borderWidth: focused ? 1 : 0,
            }}
          >
            <Icon
              name="remove"
              size={18}
              color={isStationsExercise ? '#fff5e6' : TOKENS.color.text}
              style={{ opacity: volume <= 0 ? 0.3 : 1 }}
            />
          </MattePanel>
        )}
      </Pressable>

      {/* Volume Indicator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          height: 36,
          paddingHorizontal: 6,
          gap: 3,
        }}
      >
        {/* Volume Icon */}
        <Icon
          name={getVolumeIcon()}
          size={16}
          color={isMuted ? (isStationsExercise ? 'rgba(255,179,102,0.4)' : 'rgba(255,255,255,0.4)') : activeColor}
          style={{ marginRight: 4 }}
        />

        {/* Volume Bars */}
        {Array.from({ length: VOLUME_LEVELS }).map((_, index) => {
          const isActive = index < activeBars;
          const barHeight = 8 + (index * 3); // Progressive height: 8, 11, 14, 17, 20

          return (
            <View
              key={index}
              style={{
                width: 4,
                height: barHeight,
                borderRadius: 2,
                backgroundColor: isActive ? activeColor : inactiveColor,
                opacity: isActive ? 1 : 0.5,
              }}
            />
          );
        })}
      </View>

      {/* Volume Up Button */}
      <Pressable onPress={handleVolumeUp} focusable={focusable}>
        {({ focused }) => (
          <MattePanel
            focused={focused}
            radius={18}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? focusBgColor : bgColor,
              borderColor: focused ? focusBorderColor : 'transparent',
              borderWidth: focused ? 1 : 0,
            }}
          >
            <Icon
              name="add"
              size={18}
              color={isStationsExercise ? '#fff5e6' : TOKENS.color.text}
              style={{ opacity: volume >= 1 ? 0.3 : 1 }}
            />
          </MattePanel>
        )}
      </Pressable>
    </Animated.View>
  );
}
