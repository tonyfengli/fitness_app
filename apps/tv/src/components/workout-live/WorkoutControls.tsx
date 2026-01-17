import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TOKENS } from './types';
import { MattePanel } from './MattePanel';

interface WorkoutControlsProps {
  state: any; // We'll type this more specifically in a later phase
  send: (event: any) => void;
  currentRoundType?: 'circuit_round' | 'stations_round' | 'amrap_round';
  isLightingEnabled?: boolean;
  lightingConfig?: any;
  onToggleLighting?: () => Promise<void>;
  hasLightingForCurrentView?: boolean;
}

export function WorkoutControls({ 
  state, 
  send, 
  currentRoundType,
  isLightingEnabled = false,
  lightingConfig = null,
  onToggleLighting,
  hasLightingForCurrentView = false
}: WorkoutControlsProps) {
  const handleBack = () => {
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
    send({ type: 'SKIP' });
  };

  // Only show controls during exercise, rest, or setBreak states
  if (state.value !== 'exercise' && state.value !== 'rest' && state.value !== 'setBreak') {
    return null;
  }

  // Exact match to old implementation styling
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ 
        flexDirection: 'row',
        backgroundColor: currentRoundType === 'stations_round' && state.value === 'exercise' 
          ? 'rgba(255,179,102,0.08)' // Warm orange tint for stations exercise
          : 'rgba(255,255,255,0.05)', // Clean white for everything else
        borderRadius: 32,
        padding: 6,
        gap: 4,
        borderWidth: 1,
        borderColor: currentRoundType === 'stations_round' && state.value === 'exercise'
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
                (currentRoundType === 'stations_round' && state.value === 'exercise' 
                  ? 'rgba(255,179,102,0.2)' 
                  : 'rgba(255,255,255,0.15)') : 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ? 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)') 
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon 
              name="skip-previous" 
              size={22} 
              color={currentRoundType === 'stations_round' && state.value === 'exercise' 
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
                (currentRoundType === 'stations_round' && state.value === 'exercise' 
                  ? 'rgba(255,179,102,0.2)' 
                  : 'rgba(255,255,255,0.15)') : 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ? 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)') 
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon 
              name={state.context.isPaused ? "play-arrow" : "pause"} 
              size={26} // Larger icon for play/pause
              color={currentRoundType === 'stations_round' && state.value === 'exercise' 
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
                (currentRoundType === 'stations_round' && state.value === 'exercise' 
                  ? 'rgba(255,179,102,0.2)' 
                  : 'rgba(255,255,255,0.15)') : 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.1)'
                  : 'rgba(255,255,255,0.08)'),
              borderColor: focused ? 
                (currentRoundType === 'stations_round' && state.value === 'exercise'
                  ? 'rgba(255,179,102,0.4)'
                  : 'rgba(255,255,255,0.3)') 
                : 'transparent',
              borderWidth: focused ? 1.5 : 0,
            }}
          >
            <Icon 
              name="skip-next" 
              size={22} 
              color={currentRoundType === 'stations_round' && state.value === 'exercise' 
                ? '#fff5e6' 
                : TOKENS.color.text}
            />
          </MattePanel>
        )}
      </Pressable>
      
      {/* Lighting Control */}
      <Pressable
        onPress={async () => {
          if (!onToggleLighting) return;
          await onToggleLighting();
        }}
        focusable
      >
        {({ focused }) => (
          <MattePanel 
            focused={focused}
            radius={26}
            style={{ 
              width: 52,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isLightingEnabled ? 
                (focused ? 'rgba(0,183,194,0.2)' : 'rgba(0,183,194,0.1)') :
                (focused ? 
                  (currentRoundType === 'stations_round' && state.value === 'exercise' 
                    ? 'rgba(255,179,102,0.2)' 
                    : 'rgba(255,255,255,0.15)') : 
                  (currentRoundType === 'stations_round' && state.value === 'exercise'
                    ? 'rgba(255,179,102,0.1)'
                    : 'rgba(255,255,255,0.08)')),
              borderColor: isLightingEnabled ? 
                TOKENS.color.accent : 
                (focused ? 
                  (currentRoundType === 'stations_round' && state.value === 'exercise'
                    ? 'rgba(255,179,102,0.4)'
                    : 'rgba(255,255,255,0.3)') 
                  : 'transparent'),
              borderWidth: isLightingEnabled ? 1.5 : (focused ? 1.5 : 0),
            }}
          >
            <Icon 
              name={isLightingEnabled ? "lightbulb" : "lightbulb-outline"} 
              size={22} 
              color={isLightingEnabled ? 
                TOKENS.color.accent : 
                (currentRoundType === 'stations_round' && state.value === 'exercise' 
                  ? '#fff5e6' 
                  : TOKENS.color.text)}
              style={{
                shadowColor: isLightingEnabled ? TOKENS.color.accent : 'transparent',
                shadowOpacity: isLightingEnabled ? 0.8 : 0,
                shadowRadius: isLightingEnabled ? 15 : 0,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          </MattePanel>
        )}
      </Pressable>
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