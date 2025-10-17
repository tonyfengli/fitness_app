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
  return (
    <View style={{ alignItems: 'center', position: 'relative' }}>
      {/* Main Round Info */}
      <Text style={{ 
        fontSize: 40, 
        fontWeight: '900', 
        color: currentRoundType === 'stations_round' && state.value === 'exercise' ? '#fff5e6' : TOKENS.color.text,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
      }}>
        {currentRound?.roundName || `Round ${state.context.currentRoundIndex + 1}`}
      </Text>
      
      {/* AMRAP Rest Label */}
      {state.value === 'round-preview' && currentRoundType === 'amrap_round' && (
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '700',
          color: TOKENS.color.muted,
          opacity: 0.8,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginTop: 4,
        }}>
          Rest
        </Text>
      )}
      
      {/* Stations Round Progress */}
      {currentRoundType === 'stations_round' && currentRound && (
        <View style={{ 
          height: 24, 
          marginTop: 8,
          justifyContent: 'center',
        }}>
          {state.value === 'exercise' ? (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 12, 
            }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: 6, 
              }}>
                {currentRound.exercises.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: index === state.context.currentExerciseIndex ? 8 : 6,
                      height: index === state.context.currentExerciseIndex ? 8 : 6,
                      borderRadius: 4,
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '900',
                  color: '#fff5e6',
                  fontStyle: 'normal',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  textShadowColor: 'rgba(255, 179, 102, 0.8)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 6,
                }}>
                  Let's Go!
                </Text>
              </View>
            </View>
          ) : state.value === 'rest' ? (
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: TOKENS.color.muted,
              opacity: 0.8,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}>
              Switch Stations
            </Text>
          ) : null}
        </View>
      )}
      
      {/* Timer Display for specific cases */}
      {(state.value === 'exercise' || state.value === 'rest') && currentRoundType === 'stations_round' ? (
        <TimerDisplay
          timeRemaining={state.context.timeRemaining}
          size="large"
          color={state.value === 'exercise' ? '#fff5e6' : TOKENS.color.accent}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        />
      ) : state.value === 'exercise' && currentRoundType === 'amrap_round' ? (
        <TimerDisplay
          timeRemaining={state.context.timeRemaining}
          size="large"
          color={TOKENS.color.accent}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        />
      ) : state.value === 'roundPreview' ? (
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
      ) : null}
    </View>
  );
}