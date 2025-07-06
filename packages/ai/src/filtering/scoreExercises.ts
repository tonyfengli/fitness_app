import type { Exercise } from "../types";
import type { ScoredExercise, ScoringCriteria, ScoreBreakdown } from "../types/scoredExercise";

/**
 * Scoring configuration constants
 */
const SCORING_CONFIG = {
  BASE_SCORE: 5.0,
  
  // Phase 1 scoring factors - exercise inclusion
  INCLUDE_EXERCISE_PRIORITY: 1.0, // Add 1 point above highest score
  
  // Phase 2 scoring factors - muscle target/lessen
  MUSCLE_TARGET_PRIMARY: 3.0,    // Max boost for primary muscle match
  MUSCLE_TARGET_SECONDARY: 1.5,  // Max boost for secondary muscle match
  MUSCLE_LESSEN_PRIMARY: -3.0,   // Max penalty for primary muscle match
  MUSCLE_LESSEN_SECONDARY: -1.5, // Max penalty for secondary muscle match
  
  // Phase 2 scoring factors - intensity preferences
  INTENSITY_SCORING: {
    low: {
      // On Low Intensity Days (client wants to take it easy)
      low_local: 1.5,
      moderate_local: 0.75,
      high_local: -1.5,
      moderate_systemic: -0.75,
      high_systemic: -1.5,
      metabolic: -1.5,
    },
    medium: {
      // On Moderate Intensity Days (default - no adjustments)
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
    high: {
      // On High Intensity Days (client wants to go hard)
      low_local: -1.5,
      moderate_local: -0.75,
      high_local: 1.5,
      moderate_systemic: 0.75,
      high_systemic: 1.5,
      metabolic: 1.5,
    },
  },
} as const;

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
 * Calculate intensity bonus/penalty based on client's intensity preference
 * and exercise's fatigue profile
 */
function calculateIntensityAdjustment(exercise: Exercise, intensityPreference?: string): number {
  if (!intensityPreference || intensityPreference === 'medium') {
    return 0; // Medium is neutral - no adjustments
  }
  
  const fatigueProfile = exercise.fatigueProfile;
  const intensityScoring = SCORING_CONFIG.INTENSITY_SCORING[intensityPreference as keyof typeof SCORING_CONFIG.INTENSITY_SCORING];
  
  if (!intensityScoring || !fatigueProfile) {
    return 0;
  }
  
  // Get the scoring adjustment for this fatigue profile
  const adjustment = intensityScoring[fatigueProfile as keyof typeof intensityScoring];
  
  return adjustment || 0;
}

/**
 * Check if exercise is in the include list
 */
function isIncludedExercise(exercise: Exercise, includeExercises: string[]): boolean {
  if (!includeExercises || includeExercises.length === 0) return false;
  return includeExercises.includes(exercise.name);
}

/**
 * Score a single exercise based on the scoring criteria
 */
function scoreExercise(
  exercise: Exercise,
  criteria: ScoringCriteria,
  includeExerciseBoost: number = 0,
  includeBreakdown: boolean = false
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
 * Score and sort exercises based on the provided criteria
 * Uses a two-pass approach: first calculates all normal scores, then boosts included exercises
 * 
 * @param exercises - Array of exercises to score
 * @param criteria - Scoring criteria from Phase 1 and Phase 2 filters
 * @param includeBreakdown - Whether to include score breakdown (useful for debugging)
 * @returns Array of scored exercises sorted by score (highest first)
 */
export async function scoreAndSortExercises(
  exercises: Exercise[],
  criteria: ScoringCriteria,
  includeBreakdown: boolean = false
): Promise<ScoredExercise[]> {
  console.log('🎯 Scoring exercises with criteria:', {
    includeExercisesCount: criteria.includeExercises?.length || 0,
    muscleTargetCount: criteria.muscleTarget.length,
    muscleLessenCount: criteria.muscleLessen.length,
    intensity: criteria.intensity,
    exerciseCount: exercises.length,
  });
  
  // PASS 1: Score all exercises normally (without include boost)
  const initialScoredExercises = exercises.map(exercise => 
    scoreExercise(exercise, criteria, 0, includeBreakdown)
  );
  
  // Find the highest score among all exercises
  const maxScore = initialScoredExercises.length > 0 
    ? Math.max(...initialScoredExercises.map(ex => ex.score))
    : 0;
  
  // PASS 2: Re-score included exercises with boost to be 1 point higher than max
  const finalScoredExercises = initialScoredExercises.map(exercise => {
    const isIncluded = isIncludedExercise(exercise, criteria.includeExercises || []);
    
    if (isIncluded) {
      // Give included exercises a score 1 point higher than the current max
      const includeBoost = maxScore + SCORING_CONFIG.INCLUDE_EXERCISE_PRIORITY - exercise.score;
      return scoreExercise(exercise, criteria, includeBoost, includeBreakdown);
    }
    
    return exercise; // Keep original score for non-included exercises
  });
  
  // Sort by score (highest first)
  finalScoredExercises.sort((a, b) => b.score - a.score);
  
  // Log score distribution for debugging
  if (finalScoredExercises.length > 0) {
    const topScore = finalScoredExercises[0]!.score;
    const bottomScore = finalScoredExercises[finalScoredExercises.length - 1]!.score;
    const avgScore = finalScoredExercises.reduce((sum, ex) => sum + ex.score, 0) / finalScoredExercises.length;
    const includedCount = criteria.includeExercises?.length || 0;
    
    console.log('📊 Score distribution:', {
      highest: topScore,
      lowest: bottomScore,
      average: avgScore.toFixed(1),
      total: finalScoredExercises.length,
      included: includedCount,
      maxBeforeBoost: maxScore,
    });
  }
  
  return finalScoredExercises;
}