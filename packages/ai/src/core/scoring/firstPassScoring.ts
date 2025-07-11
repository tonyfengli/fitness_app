import type { Exercise } from "../../types";
import type { ScoredExercise, ScoringCriteria } from "../../types/scoredExercise";
import { SCORING_CONFIG } from "./scoringConfig";

/**
 * Calculate the base score for an exercise
 * All exercises start with the same base score
 */
function calculateBaseScore(exercise: Exercise): number {
  return SCORING_CONFIG.BASE_SCORE;
}

/**
 * Calculate muscle target bonus
 * Priority: Primary muscle match (+3.0) takes precedence over secondary (+1.5)
 * No stacking - only the highest match applies
 */
function calculateMuscleTargetBonus(exercise: Exercise, muscleTargets: string[]): number {
  if (!muscleTargets || muscleTargets.length === 0) return 0;
  
  // Check primary muscle first - this takes priority
  if (muscleTargets.includes(exercise.primaryMuscle)) {
    return SCORING_CONFIG.MUSCLE_TARGET_PRIMARY; // +3.0
  }
  
  // Only check secondary if primary didn't match
  if (exercise.secondaryMuscles && Array.isArray(exercise.secondaryMuscles)) {
    const matchingSecondary = exercise.secondaryMuscles.filter(muscle => 
      muscleTargets.includes(muscle)
    );
    if (matchingSecondary.length > 0) {
      return SCORING_CONFIG.MUSCLE_TARGET_SECONDARY; // +1.5
    }
  }
  
  return 0;
}

/**
 * Calculate muscle lessen penalty
 * Priority: Primary muscle match (-3.0) takes precedence over secondary (-1.5)
 * No stacking - only the highest penalty applies
 */
function calculateMuscleLessenPenalty(exercise: Exercise, muscleLessen: string[]): number {
  if (!muscleLessen || muscleLessen.length === 0) return 0;
  
  // Check primary muscle first - this takes priority
  if (muscleLessen.includes(exercise.primaryMuscle)) {
    return SCORING_CONFIG.MUSCLE_LESSEN_PRIMARY; // -3.0
  }
  
  // Only check secondary if primary didn't match
  if (exercise.secondaryMuscles && Array.isArray(exercise.secondaryMuscles)) {
    const matchingSecondary = exercise.secondaryMuscles.filter(muscle => 
      muscleLessen.includes(muscle)
    );
    if (matchingSecondary.length > 0) {
      return SCORING_CONFIG.MUSCLE_LESSEN_SECONDARY; // -1.5
    }
  }
  
  return 0;
}

/**
 * Calculate intensity adjustment
 * Different fatigue profiles are preferred based on the intensity level
 */
function calculateIntensityAdjustment(exercise: Exercise, intensity?: string): number {
  if (!intensity || !exercise.fatigueProfile) return 0;
  
  const adjustments = SCORING_CONFIG.INTENSITY_SCORING[intensity as keyof typeof SCORING_CONFIG.INTENSITY_SCORING];
  if (!adjustments) return 0;
  
  return adjustments[exercise.fatigueProfile as keyof typeof adjustments] || 0;
}

/**
 * Score a single exercise based on the scoring criteria
 */
export function scoreExercise(
  exercise: Exercise,
  criteria: ScoringCriteria,
  includeExerciseBoost = 0,
  includeBreakdown = false
): ScoredExercise {
  const base = calculateBaseScore(exercise);
  const muscleTargetBonus = calculateMuscleTargetBonus(exercise, criteria.muscleTarget);
  const muscleLessenPenalty = calculateMuscleLessenPenalty(exercise, criteria.muscleLessen);
  const intensityAdjustment = calculateIntensityAdjustment(exercise, criteria.intensity);
  
  const total = base + includeExerciseBoost + muscleTargetBonus + muscleLessenPenalty + intensityAdjustment;
  
  const scoredExercise: ScoredExercise = {
    ...exercise,
    score: Math.max(0, total), // Ensure score doesn't go negative
  };
  
  if (includeBreakdown) {
    scoredExercise.scoreBreakdown = {
      base,
      includeExerciseBoost,
      muscleTargetBonus,
      muscleLessenPenalty,
      intensityAdjustment,
      total: scoredExercise.score,
    };
  }
  
  return scoredExercise;
}

/**
 * Perform the first pass of scoring - calculate base scores without include boost
 */
export function performFirstPassScoring(
  exercises: Exercise[],
  criteria: ScoringCriteria,
  includeBreakdown = false
): { scoredExercises: ScoredExercise[]; maxScore: number } {
  console.log('🎯 First pass: Scoring exercises without include boost');
  
  const scoredExercises = exercises.map(exercise => 
    scoreExercise(exercise, criteria, 0, includeBreakdown)
  );
  
  const maxScore = scoredExercises.length > 0 
    ? Math.max(...scoredExercises.map(ex => ex.score))
    : 0;
    
  console.log(`📊 First pass complete: max score = ${maxScore}`);
  
  return { scoredExercises, maxScore };
}