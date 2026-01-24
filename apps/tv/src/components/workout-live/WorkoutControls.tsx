import React from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TOKENS } from './types';
import { MattePanel } from './MattePanel';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface WorkoutControlsProps {
  state: any;
  send: (event: any) => void;
  currentRoundType?: 'circuit_round' | 'stations_round' | 'amrap_round';
  isLightingEnabled?: boolean;
  lightingConfig?: any;
  onToggleLighting?: () => Promise<void>;
  hasLightingForCurrentView?: boolean;
  // Settings panel props
  isSettingsPanelOpen?: boolean;
  onToggleSettingsPanel?: () => void;
  onCloseSettingsPanel?: () => void; // Close without animation (for navigation)
  // Music props
  isMusicEnabled?: boolean;
  currentTrack?: any;
  onStopMusic?: () => void;
  onEnableMusic?: () => void;
}

export function WorkoutControls({
  state,
  send,
  currentRoundType,
  isLightingEnabled = false,
  lightingConfig = null,
  onToggleLighting,
  hasLightingForCurrentView = false,
  isSettingsPanelOpen = false,
  onToggleSettingsPanel,
  onCloseSettingsPanel,
  isMusicEnabled = false,
  currentTrack = null,
  onStopMusic,
  onEnableMusic,
}: WorkoutControlsProps) {
  const handleBack = () => {
    // Close panel without animation to avoid LayoutAnimation conflicts
    if (isSettingsPanelOpen && onCloseSettingsPanel) {
      onCloseSettingsPanel();
    }
    send({ type: 'BACK' });
  };

  const handlePause = () => {
    if (state.context.isPaused) {
      send({ type: 'RESUME' });
    } else {
      send({ type: 'PAUSE' });
    }
  };

  const handleSkip = () => {
    // Close panel without animation to avoid LayoutAnimation conflicts
    if (isSettingsPanelOpen && onCloseSettingsPanel) {
      onCloseSettingsPanel();
    }
    send({ type: 'SKIP' });
  };

  const handleMusicToggle = () => {
    if (isMusicEnabled) {
      // Disable music - stops playback and ignores triggers
      onStopMusic?.();
    } else {
      // Enable music - triggers will handle playback
      onEnableMusic?.();
    }
  };

  const toggleSettingsPanel = () => {
    LayoutAnimation.configureNext({
      duration: 200,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    onToggleSettingsPanel?.();
  };

  // Only show controls during exercise, rest, or setBreak states
  if (state.value !== 'exercise' && state.value !== 'rest' && state.value !== 'setBreak') {
    return null;
  }

  // Check if we should show settings panel for this view
  // Stations: rest, work (exercise), set break
  // Circuit: rest, work (exercise), set break
  // AMRAP: work (exercise) only
  const shouldShowSettings =
    currentRoundType === 'stations_round' ||
    currentRoundType === 'circuit_round' ||
    (currentRoundType === 'amrap_round' && state.value === 'exercise');

  // Theming for stations exercise state
  const isStationsExercise = currentRoundType === 'stations_round' && state.value === 'exercise';

  // Exact match to old implementation styling
  return (
    <View style={{ position: 'relative' }}>
      <View style={{
        flexDirection: 'row',
        backgroundColor: isStationsExercise
          ? 'rgba(255,179,102,0.08)' // Warm orange tint for stations exercise
          : 'rgba(255,255,255,0.05)', // Clean white for everything else
        borderRadius: 32,
        padding: 6,
        gap: 4,
        borderWidth: 1,
        borderColor: isStationsExercise
          ? 'rgba(255,179,102,0.15)' // Subtle orange border for stations
          : 'rgba(255,255,255,0.1)', // Subtle white border for others
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}>
      {/* Back */}
      <Pressable onPress={handleBack} focusable>
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
                (isStationsExercise
                  ? 'rgba(255,179,102,0.2)'
                  : 'rgba(255,255,255,0.15)') :
                (isStationsExercise
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ?
                (isStationsExercise
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)')
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon
              name="skip-previous"
              size={22}
              color={isStationsExercise
                ? '#fff5e6'
                : TOKENS.color.text}
            />
          </MattePanel>
        )}
      </Pressable>

      {/* Pause/Play */}
      <Pressable onPress={handlePause} focusable>
        {({ focused }) => (
          <MattePanel
            focused={focused}
            radius={26}
            style={{
              width: 56, // Slightly wider for play/pause button
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ?
                (isStationsExercise
                  ? 'rgba(255,179,102,0.2)'
                  : 'rgba(255,255,255,0.15)') :
                (isStationsExercise
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ?
                (isStationsExercise
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)')
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon
              name={state.context.isPaused ? "play-arrow" : "pause"}
              size={26} // Larger icon for play/pause
              color={isStationsExercise
                ? '#fff5e6'
                : TOKENS.color.text}
            />
          </MattePanel>
        )}
      </Pressable>

      {/* Skip Forward */}
      <Pressable onPress={handleSkip} focusable>
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
                (isStationsExercise
                  ? 'rgba(255,179,102,0.2)'
                  : 'rgba(255,255,255,0.15)') :
                (isStationsExercise
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ?
                (isStationsExercise
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)')
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon
              name="skip-next"
              size={22}
              color={isStationsExercise
                ? '#fff5e6'
                : TOKENS.color.text}
            />
          </MattePanel>
        )}
      </Pressable>

      {/* Settings Button - only for applicable views */}
      {shouldShowSettings && (
        <>
          <Pressable
            onPress={toggleSettingsPanel}
            focusable
          >
            {({ focused }) => (
              <View style={{ position: 'relative' }}>
                <MattePanel
                  focused={focused}
                  radius={26}
                  style={{
                    width: 52,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: focused ?
                      (isStationsExercise
                        ? 'rgba(255,179,102,0.2)'
                        : 'rgba(255,255,255,0.15)') :
                      (isStationsExercise
                        ? 'rgba(255,179,102,0.1)'
                        : 'rgba(255,255,255,0.08)'),
                    borderColor: focused ?
                      (isStationsExercise
                        ? 'rgba(255,179,102,0.4)'
                        : 'rgba(255,255,255,0.3)')
                      : 'transparent',
                    borderWidth: focused ? 1.5 : 0,
                  }}
                >
                  <Icon
                    name="settings"
                    size={22}
                    color={isStationsExercise ? '#fff5e6' : TOKENS.color.text}
                  />
                </MattePanel>
              </View>
            )}
          </Pressable>

          {/* Expandable Settings Panel */}
          {isSettingsPanelOpen && (
            <View style={{ flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
              {/* Divider */}
              <View style={{
                width: 1,
                height: 24,
                backgroundColor: isStationsExercise
                  ? 'rgba(255,179,102,0.25)'
                  : 'rgba(255,255,255,0.15)',
                marginLeft: 4,
                marginRight: 8,
              }} />

              {/* Lights Button */}
              <Pressable
                onPress={async () => {
                  if (onToggleLighting) {
                    await onToggleLighting();
                  }
                }}
                focusable={isSettingsPanelOpen}
                style={{ marginRight: 6 }}
              >
                {({ focused }) => (
                  <MattePanel
                    focused={focused}
                    radius={22}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isLightingEnabled ?
                        (focused ? 'rgba(93,225,255,0.25)' : 'rgba(93,225,255,0.12)') :
                        (focused ?
                          (isStationsExercise ? 'rgba(255,179,102,0.2)' : 'rgba(255,255,255,0.15)') :
                          (isStationsExercise ? 'rgba(255,179,102,0.1)' : 'rgba(255,255,255,0.06)')),
                      borderColor: isLightingEnabled ?
                        TOKENS.color.accent2 :
                        (focused ?
                          (isStationsExercise ? 'rgba(255,179,102,0.4)' : 'rgba(255,255,255,0.25)') :
                          'transparent'),
                      borderWidth: isLightingEnabled ? 1.5 : (focused ? 1 : 0),
                    }}
                  >
                    <Icon
                      name={isLightingEnabled ? "lightbulb" : "lightbulb-outline"}
                      size={20}
                      color={isLightingEnabled ? TOKENS.color.accent2 : (isStationsExercise ? '#fff5e6' : TOKENS.color.text)}
                    />
                  </MattePanel>
                )}
              </Pressable>

              {/* Music Toggle */}
              <Pressable
                onPress={handleMusicToggle}
                focusable={isSettingsPanelOpen}
              >
                {({ focused }) => (
                  <MattePanel
                    focused={focused}
                    radius={22}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isMusicEnabled ?
                        (focused ? 'rgba(93,225,255,0.25)' : 'rgba(93,225,255,0.12)') :
                        (focused ?
                          (isStationsExercise ? 'rgba(255,179,102,0.2)' : 'rgba(255,255,255,0.15)') :
                          (isStationsExercise ? 'rgba(255,179,102,0.1)' : 'rgba(255,255,255,0.06)')),
                      borderColor: isMusicEnabled ?
                        TOKENS.color.accent2 :
                        (focused ?
                          (isStationsExercise ? 'rgba(255,179,102,0.4)' : 'rgba(255,255,255,0.25)') :
                          'transparent'),
                      borderWidth: isMusicEnabled ? 1.5 : (focused ? 1 : 0),
                    }}
                  >
                    <Icon
                      name={isMusicEnabled ? "music-note" : "music-off"}
                      size={20}
                      color={isMusicEnabled ? TOKENS.color.accent2 : (isStationsExercise ? '#fff5e6' : TOKENS.color.text)}
                    />
                  </MattePanel>
                )}
              </Pressable>
            </View>
          )}
        </>
      )}
      </View>
      {/* Lighting Config Badge */}
      {lightingConfig && hasLightingForCurrentView && (
        <View style={{
          position: 'absolute',
          bottom: -22,
          right: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
        }}>
          <Text style={{
            fontSize: 9,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            AUTO
          </Text>
        </View>
      )}
    </View>
  );
}
