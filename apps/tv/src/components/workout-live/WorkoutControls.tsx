import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TOKENS } from './types';
import { MattePanel } from './MattePanel';

interface WorkoutControlsProps {
  state: any; // We'll type this more specifically in a later phase
  send: (event: any) => void;
}

export function WorkoutControls({ state, send }: WorkoutControlsProps) {
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

  return (
    <View style={{ 
      position: 'absolute', 
      bottom: 60, 
      left: 0, 
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      paddingHorizontal: 60
    }}>
      <Pressable onPress={handleBack} focusable>
        {({ focused }) => (
          <MattePanel 
            focused={focused}
            style={{ 
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
              borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
            }}
          >
            <Text style={{ color: TOKENS.color.text, fontSize: 16 }}>Back</Text>
          </MattePanel>
        )}
      </Pressable>
      
      <Pressable onPress={handlePause} focusable>
        {({ focused }) => (
          <MattePanel 
            focused={focused}
            style={{ 
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
              borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
            }}
          >
            <Icon 
              name={state.context.isPaused ? 'play-arrow' : 'pause'} 
              size={24} 
              color={TOKENS.color.text} 
            />
          </MattePanel>
        )}
      </Pressable>
      
      <Pressable onPress={handleSkip} focusable>
        {({ focused }) => (
          <MattePanel 
            focused={focused}
            style={{ 
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
              borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
            }}
          >
            <Text style={{ color: TOKENS.color.text, fontSize: 16 }}>Skip</Text>
          </MattePanel>
        )}
      </Pressable>
    </View>
  );
}