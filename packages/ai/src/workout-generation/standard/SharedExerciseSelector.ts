/**
 * Selects shared exercises to ensure group cohesion
 * Runs BEFORE individual LLM calls
 */

import type { GroupScoredExercise } from "../../types/groupContext";
import type { StandardGroupWorkoutBlueprint } from "../../types/standardBlueprint";
import type { ClientContext } from "../../types/clientContext";
import { SCORING_CONFIG } from "../../core/scoring/scoringConfig";

export interface SharedExerciseSelectionResult {
  mandatoryShared: GroupScoredExercise[]; // Must be included by all applicable clients
  optionalShared: GroupScoredExercise[]; // Can be chosen by LLM if suitable
}

export class SharedExerciseSelector {
  /**
   * Pre-select shared exercises before LLM calls
   * Ensures at least N shared exercises in the final workout
   */
  static selectSharedExercises(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: { clients: ClientContext[] },
    config: {
      minimumShared: number; // e.g., 1
      preferredShared: number; // e.g., 2-3
    }
  ): SharedExerciseSelectionResult {
    const { sharedExercisePool } = blueprint;
    
    // Filter to only exercises that ALL clients can do
    const universallyShared = sharedExercisePool.filter(exercise => {
      const isCoreOrFinisher = exercise.functionTags?.some(
        tag => tag === 'core' || tag === 'capacity'
      ) ?? false;
      const threshold = isCoreOrFinisher 
        ? SCORING_CONFIG.SHARED_EXERCISE_CORE_FINISHER_MIN_SCORE 
        : SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;
      
      return exercise.clientsSharing.length === groupContext.clients.length &&
        exercise.groupScore >= threshold;
    });
    
    // Sort by group score (highest first)
    universallyShared.sort((a, b) => b.groupScore - a.groupScore);
    
    // Select mandatory shared exercises
    const mandatoryShared = universallyShared.slice(0, config.minimumShared);
    
    // Additional shared exercises that LLM can choose from
    const optionalShared = sharedExercisePool.filter(exercise => {
      const isCoreOrFinisher = exercise.functionTags?.some(
        tag => tag === 'core' || tag === 'capacity'
      ) ?? false;
      const threshold = isCoreOrFinisher 
        ? SCORING_CONFIG.SHARED_EXERCISE_CORE_FINISHER_MIN_SCORE 
        : SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;
      
      return !mandatoryShared.includes(exercise) &&
        exercise.clientsSharing.length >= Math.ceil(groupContext.clients.length * 0.6) && // At least 60% of clients
        exercise.groupScore >= threshold;
    });
    
    return {
      mandatoryShared,
      optionalShared
    };
  }
  
  /**
   * Identify the best shared exercise based on constraints
   */
  static selectBestSharedForConstraints(
    sharedPool: GroupScoredExercise[],
    constraints: {
      movementPattern?: string;
      muscleTarget?: string[];
      avoidMuscles?: string[];
      functionTags?: string[];
    }
  ): GroupScoredExercise | null {
    // Filter by constraints
    let candidates = sharedPool;
    
    if (constraints.movementPattern) {
      candidates = candidates.filter(ex => 
        ex.movementPattern === constraints.movementPattern
      );
    }
    
    if (constraints.muscleTarget && constraints.muscleTarget.length > 0) {
      candidates = candidates.filter(ex => 
        constraints.muscleTarget!.some(muscle => 
          ex.primaryMuscle === muscle || ex.secondaryMuscles?.includes(muscle)
        )
      );
    }
    
    if (constraints.avoidMuscles && constraints.avoidMuscles.length > 0) {
      candidates = candidates.filter(ex => 
        !constraints.avoidMuscles!.includes(ex.primaryMuscle) &&
        !ex.secondaryMuscles?.some(m => constraints.avoidMuscles!.includes(m))
      );
    }
    
    if (constraints.functionTags && constraints.functionTags.length > 0) {
      candidates = candidates.filter(ex =>
        ex.functionTags?.some(tag => constraints.functionTags!.includes(tag))
      );
    }
    
    // Return highest scoring candidate
    return candidates.sort((a, b) => b.groupScore - a.groupScore)[0] || null;
  }
}