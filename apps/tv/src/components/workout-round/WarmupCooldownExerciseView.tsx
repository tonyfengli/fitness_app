import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';

interface WarmupCooldownExerciseViewProps {
  currentRound: RoundData & { template: { position: 'warmup' | 'cooldown', exerciseWorkDuration?: number, exerciseRestDuration?: number } };
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
  const headerText = currentRound.template.position === 'warmup' ? 'WARM-UP' : 'COOL-DOWN';
  const exerciseCount = currentRound.exercises.length;
  const useColumns = exerciseCount > 4;
  
  // Calculate which exercise is currently active based on time elapsed
  const { activeExerciseIndex, isResting, exerciseTimeRemaining } = useMemo(() => {
    const workDuration = currentRound.template.exerciseWorkDuration || 45;
    const restDuration = currentRound.template.exerciseRestDuration || 15;
    const totalExercises = currentRound.exercises.length;
    
    // Calculate total duration
    const totalDuration = (workDuration + restDuration) * totalExercises - restDuration;
    const timeElapsed = totalDuration - timeRemaining;
    
    // Find current exercise
    let currentTime = 0;
    for (let i = 0; i < totalExercises; i++) {
      const exerciseEnd = currentTime + workDuration;
      const restEnd = i < totalExercises - 1 ? exerciseEnd + restDuration : exerciseEnd;
      
      if (timeElapsed < exerciseEnd) {
        // Currently in exercise
        return {
          activeExerciseIndex: i,
          isResting: false,
          exerciseTimeRemaining: exerciseEnd - timeElapsed
        };
      } else if (timeElapsed < restEnd) {
        // Currently in rest
        return {
          activeExerciseIndex: i,
          isResting: true,
          exerciseTimeRemaining: restEnd - timeElapsed
        };
      }
      
      currentTime = restEnd;
    }
    
    // Default to last exercise
    return {
      activeExerciseIndex: totalExercises - 1,
      isResting: false,
      exerciseTimeRemaining: 0
    };
  }, [timeRemaining, currentRound.exercises.length, currentRound.template]);
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Header Section - matches AMRAP formatting */}
      <View style={{ 
        paddingTop: 0,
        paddingBottom: 30,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '800',
          color: TOKENS.color.muted,
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 8,
        }}>
          {headerText}
        </Text>
      </View>

      {/* Exercises List - matches AMRAP layout exactly */}
      <View style={{ 
        flex: 1, 
        paddingHorizontal: 48,
      }}>
        <View style={{ 
          flexDirection: useColumns ? 'row' : 'column',
          flexWrap: useColumns ? 'wrap' : 'nowrap',
          gap: 8,
          justifyContent: useColumns ? 'space-between' : 'flex-start',
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            const isActive = idx === activeExerciseIndex;
            const isComplete = idx < activeExerciseIndex;
            const isFuture = idx > activeExerciseIndex;
            
            return (
              <MattePanel 
                key={exercise.id} 
                style={{ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 12,
                  width: useColumns ? '48%' : '100%',
                  opacity: isFuture ? 0.5 : 1,
                  backgroundColor: isActive && !isResting ? TOKENS.color.accent + '10' : undefined,
                  borderWidth: isActive && !isResting ? 2 : 0,
                  borderColor: isActive && !isResting ? TOKENS.color.accent + '30' : undefined,
                }}
              >
                {/* Exercise Number */}
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isComplete 
                    ? TOKENS.color.accent + '60'
                    : isActive && !isResting
                      ? TOKENS.color.accent
                      : TOKENS.color.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '900',
                    color: TOKENS.color.bg,
                  }}>
                    {isComplete ? '✓' : idx + 1}
                  </Text>
                </View>
                
                {/* Exercise Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 18, 
                    fontWeight: '700',
                    color: isActive && !isResting ? TOKENS.color.text : TOKENS.color.text,
                    marginBottom: 2,
                  }}>
                    {exercise.exerciseName}
                  </Text>
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: '700',
                    color: TOKENS.color.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}>
                    {Array.isArray(exercise.equipment) && exercise.equipment.length > 0
                      ? exercise.equipment.join(', ') 
                      : 'bodyweight'}
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