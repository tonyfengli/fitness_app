import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface WarmupCooldownExerciseViewProps {
  currentRound: RoundData & { template: { position: 'warmup' | 'cooldown' } };
  currentExercise: CircuitExercise;
  currentExerciseIndex: number;
  timeRemaining: number;
  isPaused: boolean;
}

export function WarmupCooldownExerciseView({ 
  currentRound, 
  currentExercise,
  currentExerciseIndex,
  timeRemaining,
  isPaused 
}: WarmupCooldownExerciseViewProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const headerText = currentRound.template.position === 'warmup' ? 'WARM-UP' : 'COOL-DOWN';
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Header */}
      <View style={{ 
        paddingTop: 20,
        paddingBottom: 10,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '800',
          color: TOKENS.color.muted,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}>
          {headerText}
        </Text>
      </View>

      {/* Timer */}
      <View style={{ 
        paddingVertical: 20,
        alignItems: 'center',
      }}>
        <Text style={{ 
          fontSize: 84, 
          fontWeight: '800',
          color: TOKENS.color.accent,
          letterSpacing: -2,
        }}>
          {formatTime(timeRemaining)}
        </Text>
      </View>

      {/* Current Exercise */}
      <View style={{ paddingHorizontal: 48, marginBottom: 30 }}>
        <MattePanel style={{ 
          paddingHorizontal: 24,
          paddingVertical: 20,
          backgroundColor: TOKENS.color.accent + '10',
          borderWidth: 2,
          borderColor: TOKENS.color.accent + '30',
        }}>
          <Text style={{ 
            fontSize: 28, 
            fontWeight: '800',
            color: TOKENS.color.text,
            marginBottom: 4,
            textAlign: 'center',
          }}>
            {currentExercise.exerciseName}
          </Text>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '700',
            color: TOKENS.color.muted,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            textAlign: 'center',
          }}>
            {Array.isArray(currentExercise.equipment) && currentExercise.equipment.length > 0
              ? currentExercise.equipment.join(', ') 
              : 'bodyweight'}
          </Text>
        </MattePanel>
      </View>

      {/* Exercise List */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '700',
          color: TOKENS.color.muted,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 12,
        }}>
          ALL EXERCISES
        </Text>
        
        <View style={{ gap: 8 }}>
          {currentRound.exercises.map((exercise, idx) => {
            const isActive = idx === currentExerciseIndex;
            return (
              <MattePanel 
                key={exercise.id} 
                style={{ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 12,
                  opacity: isActive ? 1 : 0.6,
                  backgroundColor: isActive ? TOKENS.color.accent + '10' : undefined,
                  borderWidth: isActive ? 1 : 0,
                  borderColor: isActive ? TOKENS.color.accent + '30' : undefined,
                }}
              >
                {/* Exercise Number */}
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isActive ? TOKENS.color.accent : TOKENS.color.muted + '30',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '900',
                    color: isActive ? TOKENS.color.bg : TOKENS.color.muted,
                  }}>
                    {idx + 1}
                  </Text>
                </View>
                
                {/* Exercise Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? TOKENS.color.text : TOKENS.color.muted,
                  }}>
                    {exercise.exerciseName}
                  </Text>
                </View>
              </MattePanel>
            );
          })}
        </View>
      </View>
    </View>
  );
}