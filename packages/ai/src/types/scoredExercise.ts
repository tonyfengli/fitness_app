import type { Exercise } from "./exercise";

/**
 * Breakdown of how an exercise's score was calculated
 */
export interface ScoreBreakdown {
  base: number;
  includeExerciseBoost: number;
  favoriteExerciseBoost: number;
  muscleTargetBonus: number;
  muscleLessenPenalty: number;
  intensityAdjustment: number;
  total: number;
}

/**
 * An exercise with its calculated score
 */
export interface ScoredExercise extends Exercise {
  score: number;
  scoreBreakdown: ScoreBreakdown; // Made required to ensure it flows through pipeline
}

/**
 * Criteria used for scoring exercises
 */
export interface ScoringCriteria {
  includeExercises?: string[]; // Exercise names from Phase 1 include list
  favoriteExerciseIds?: string[]; // Exercise IDs marked as favorites
  muscleTarget: string[];
  muscleLessen: string[];
  intensity?: string; // 'low', 'moderate', 'high'
  skillLevel?: string; // 'very_low', 'low', 'moderate', 'high'
  strengthLevel?: string; // 'very_low', 'low', 'moderate', 'high'
  primaryGoal?: string; // 'strength', 'muscle_building', 'endurance', etc.
}