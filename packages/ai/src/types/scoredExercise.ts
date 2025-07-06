import type { Exercise } from "./exercise";

/**
 * Breakdown of how an exercise's score was calculated
 */
export interface ScoreBreakdown {
  base: number;
  includeExerciseBoost: number;
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
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * Criteria used for scoring exercises
 */
export interface ScoringCriteria {
  includeExercises?: string[]; // Exercise names from Phase 1 include list
  muscleTarget: string[];
  muscleLessen: string[];
  intensity?: string; // 'low', 'medium', 'high'
}