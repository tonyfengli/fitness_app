import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, RoundData } from './types';
import { TimerDisplay } from './TimerDisplay';

interface WorkoutHeaderProps {
  state: any; // We'll type this more specifically in Phase 2
  currentRound: RoundData | undefined;
  currentRoundType: 'circuit_round' | 'stations_round' | 'amrap_round';
}

export function WorkoutHeader({ state, currentRound, currentRoundType }: WorkoutHeaderProps) {
  // For round preview, render as before (centered)
  if (state.value === 'roundPreview') {
    return (
      <View style={{ alignItems: 'center', position: 'relative' }}>
        <Text style={{ 
          fontSize: 80, 
          fontWeight: '900', 
          color: TOKENS.color.text,
          letterSpacing: 1,
          textTransform: 'uppercase',
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          {currentRound?.roundName || `Round ${state.context.currentRoundIndex + 1}`}
        </Text>
      </View>
    );
  }

  // For exercise/rest states, render as left-side component
  return (
    <View style={{ 
      alignItems: 'flex-start', 
      position: 'relative',
      height: 88, // Fixed height to prevent shifting
      justifyContent: 'flex-start'
    }}>
      {/* Round Info */}
      <Text style={{ 
        fontSize: 40, 
        fontWeight: '900', 
        color: currentRoundType === 'stations_round' && state.value === 'exercise' ? '#fff5e6' : TOKENS.color.text,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {currentRound?.roundName || `Round ${state.context.currentRoundIndex + 1}`}
      </Text>
      
      {/* Stations Round Progress */}
      {currentRoundType === 'stations_round' && currentRound && (
        <View style={{ 
          marginTop: 4,
          height: 32, // Fixed height to prevent layout shifts
          justifyContent: 'center',
        }}>
          {state.value === 'exercise' ? (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 20, 
            }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: 10, 
              }}>
                {currentRound.exercises.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: index === state.context.currentExerciseIndex ? 12 : 10,
                      height: index === state.context.currentExerciseIndex ? 12 : 10,
                      borderRadius: 6,
                      backgroundColor: index === state.context.currentExerciseIndex 
                        ? '#ffb366'
                        : index < state.context.currentExerciseIndex 
                          ? 'rgba(255, 179, 102, 0.6)'
                          : 'rgba(255, 179, 102, 0.25)',
                      transform: index === state.context.currentExerciseIndex ? [{ scale: 1.2 }] : [],
                    }}
                  />
                ))}
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: '900',
                color: '#fff5e6',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                textShadowColor: 'rgba(255, 179, 102, 0.8)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 6,
              }}>
                Let's Go!
              </Text>
            </View>
          ) : state.value === 'rest' ? (
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: TOKENS.color.muted,
              opacity: 0.8,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}>
              Switch Stations
            </Text>
          ) : state.value === 'setBreak' ? (
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: TOKENS.color.accent, // Cyan theme for set break
              opacity: 0.8,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}>
              Next Set Starting
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}