import type { ScoredExercise } from "../types/scoredExercise";
import type { OrganizedExercises } from "../core/templates/types";

export interface ExerciseWithUIFlags extends ScoredExercise {
  isTop6Selected: boolean;
  isTop6BlockA: boolean;
  isTop6BlockB: boolean;
  isTop6BlockC: boolean;
  isTop6BlockD: boolean;
  blockBPenalty: number;
  blockCPenalty: number;
}

/**
 * Add presentation-specific flags to exercises for UI display
 * This keeps UI concerns separate from business logic
 */
export function addPresentationFlags(
  exercises: ScoredExercise[],
  organizedExercises: OrganizedExercises | null
): ExerciseWithUIFlags[] {
  if (!organizedExercises) {
    // If no template organization, return exercises without UI flags
    return exercises.map(exercise => ({
      ...exercise,
      isTop6Selected: false,
      isTop6BlockA: false,
      isTop6BlockB: false,
      isTop6BlockC: false,
      isTop6BlockD: false,
      blockBPenalty: 0,
      blockCPenalty: 0
    }));
  }

  // Create sets of IDs for TOP 6 selections in each block
  const top6BlockA = new Set(organizedExercises.blockA.map(ex => ex.id));
  const top6BlockB = new Set(organizedExercises.blockB.map(ex => ex.id));
  const top6BlockC = new Set(organizedExercises.blockC.map(ex => ex.id));
  const top6BlockD = new Set(organizedExercises.blockD.map(ex => ex.id));
  
  // Mark exercises with UI-specific flags
  const exercisesWithFlags = exercises.map(exercise => {
    const tags = exercise.functionTags ?? [];
    
    // Check if this exercise is selected as TOP 6 for specific blocks
    const isTop6BlockA = tags.includes('primary_strength') && top6BlockA.has(exercise.id);
    const isTop6BlockB = tags.includes('secondary_strength') && top6BlockB.has(exercise.id);
    const isTop6BlockC = tags.includes('accessory') && top6BlockC.has(exercise.id);
    const isTop6BlockD = (tags.includes('core') || tags.includes('capacity')) && top6BlockD.has(exercise.id);
    
    return {
      ...exercise,
      isTop6Selected: isTop6BlockA || isTop6BlockB || isTop6BlockC || isTop6BlockD,
      isTop6BlockA,
      isTop6BlockB,
      isTop6BlockC,
      isTop6BlockD,
      blockBPenalty: isTop6BlockA ? 2.0 : 0,
      blockCPenalty: isTop6BlockB ? 2.0 : 0
    };
  });

  // Debug logging
  const blockACount = exercisesWithFlags.filter(ex => ex.isTop6BlockA).length;
  const blockBCount = exercisesWithFlags.filter(ex => ex.isTop6BlockB).length;
  const blockCCount = exercisesWithFlags.filter(ex => ex.isTop6BlockC).length;
  const blockDCount = exercisesWithFlags.filter(ex => ex.isTop6BlockD).length;
  
  console.log(`📊 TOP 6 flags set:`);
  console.log(`   - isTop6BlockA: ${blockACount} exercises marked`);
  console.log(`   - isTop6BlockB: ${blockBCount} exercises marked`);
  console.log(`   - isTop6BlockC: ${blockCCount} exercises marked`);
  console.log(`   - isTop6BlockD: ${blockDCount} exercises marked`);
  
  return exercisesWithFlags;
}