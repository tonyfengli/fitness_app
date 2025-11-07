/**
 * Reusable action handlers for workout operations
 */

import type { ExerciseSwapPayload, ProcessedExercise, RoundData } from '../types/circuit.types';
import { getStationInfo } from './station-helpers';
import { isStationsRound } from './round-helpers';

interface SwapMutations {
  swapSpecific: {
    mutate: (payload: any) => void;
    mutateAsync: (payload: any) => Promise<any>;
  };
  swapCircuit: {
    mutate: (payload: any) => void;
    mutateAsync: (payload: any) => Promise<any>;
  };
}

interface ReplaceExerciseParams {
  exercise: ProcessedExercise;
  newExerciseId: string | null;
  customName?: string;
  round: RoundData;
  sessionId: string;
  userId: string;
  circuitConfig: any;
  mutations: SwapMutations;
}

/**
 * Determine which swap mutation to use and execute it
 */
export async function replaceExercise(params: ReplaceExerciseParams): Promise<void> {
  const {
    exercise,
    newExerciseId,
    customName,
    round,
    sessionId,
    userId,
    circuitConfig,
    mutations
  } = params;


  // Determine if this is a station exercise
  const stationInfo = getStationInfo(exercise, round.exercises);
  const isStationRound = isStationsRound(round.roundName, circuitConfig);
  

  // Use specific swap for station exercises in station rounds
  if (isStationRound && stationInfo.isStation) {
    
    return mutations.swapSpecific.mutateAsync({
      sessionId,
      exerciseId: exercise.id,
      newExerciseId,
      customName,
      reason: "Station exercise swap",
      swappedBy: userId,
    });
  } else {
    return mutations.swapCircuit.mutateAsync({
      sessionId,
      roundName: round.roundName,
      exerciseIndex: exercise.orderIndex,
      originalExerciseId: exercise.exerciseId || exercise.custom_exercise?.originalExerciseId || null,
      newExerciseId,
      customName,
      reason: "Circuit exercise swap",
      swappedBy: userId,
    });
  }
}

/**
 * Check if an exercise appears in a mirror round
 */
export function findMirrorExercise(
  exercise: ProcessedExercise,
  currentRoundIndex: number,
  allRounds: RoundData[],
  hasRepeatRounds: boolean
): { mirrorRound: RoundData; mirrorExercise: ProcessedExercise } | null {
  if (!hasRepeatRounds) return null;
  
  const baseRoundCount = Math.floor(allRounds.length / 2);
  
  // Only check for mirrors if this is a base round
  if (currentRoundIndex >= baseRoundCount) return null;
  
  const mirrorRoundIndex = currentRoundIndex + baseRoundCount;
  const mirrorRound = allRounds[mirrorRoundIndex];
  
  if (!mirrorRound) return null;
  
  // Find exercise at same position
  const currentRound = allRounds[currentRoundIndex];
  const exercisePosition = currentRound.exercises.findIndex(ex => ex.id === exercise.id);
  const mirrorExercise = mirrorRound.exercises[exercisePosition];
  
  // Check if it's the same exercise
  if (mirrorExercise && mirrorExercise.exerciseName === exercise.exerciseName) {
    return { mirrorRound, mirrorExercise };
  }
  
  return null;
}

/**
 * Get the appropriate reason string for a swap
 */
export function getSwapReason(
  isStation: boolean,
  isStationRound: boolean,
  isMirror: boolean = false
): string {
  if (isMirror) {
    return isStation ? "Station exercise swap (mirror round)" : "Circuit exercise swap (mirror round)";
  }
  
  return isStation && isStationRound ? "Station exercise swap" : "Circuit exercise swap";
}

/**
 * Validate if an exercise can be replaced
 */
export function canReplaceExercise(
  exercise: ProcessedExercise,
  round: RoundData
): { canReplace: boolean; reason?: string } {
  // Check if exercise exists in round
  const exists = round.exercises.some(ex => 
    ex.id === exercise.id || 
    ex.stationExercises?.some(se => se.id === exercise.id)
  );
  
  if (!exists) {
    return { canReplace: false, reason: "Exercise not found in round" };
  }
  
  // Add other validation rules as needed
  
  return { canReplace: true };
}

/**
 * Calculate the impact of replacing an exercise
 */
export function getReplacementImpact(
  exercise: ProcessedExercise,
  round: RoundData,
  allRounds: RoundData[],
  hasRepeatRounds: boolean
): {
  affectedExercises: string[];
  affectedRounds: string[];
  totalAffected: number;
} {
  const stationInfo = getStationInfo(exercise, round.exercises);
  const affectedExercises: string[] = [];
  const affectedRounds = [round.roundName];
  
  if (stationInfo.isStation && stationInfo.position === 'primary') {
    // Station replacement might affect all exercises in the station
    affectedExercises.push(...(stationInfo.allStationExerciseIds || []));
  } else {
    affectedExercises.push(exercise.id);
  }
  
  // Check for mirror round
  const currentRoundIndex = allRounds.findIndex(r => r.roundName === round.roundName);
  const mirror = findMirrorExercise(exercise, currentRoundIndex, allRounds, hasRepeatRounds);
  
  if (mirror) {
    affectedRounds.push(mirror.mirrorRound.roundName);
    if (stationInfo.isStation) {
      const mirrorStationInfo = getStationInfo(mirror.mirrorExercise, mirror.mirrorRound.exercises);
      affectedExercises.push(...(mirrorStationInfo.allStationExerciseIds || []));
    } else {
      affectedExercises.push(mirror.mirrorExercise.id);
    }
  }
  
  return {
    affectedExercises: [...new Set(affectedExercises)],
    affectedRounds,
    totalAffected: affectedExercises.length
  };
}