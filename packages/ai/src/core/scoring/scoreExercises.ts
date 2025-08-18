import type { Exercise } from "../../types";
import type {
  ScoredExercise,
  ScoringCriteria,
} from "../../types/scoredExercise";
import { performFirstPassScoring } from "./firstPassScoring";
import {
  analyzeScoreDistribution,
  logScoringPerformance,
} from "./scoreAnalysis";
import { performSecondPassScoring } from "./secondPassScoring";

/**
 * Score and sort exercises based on the provided criteria
 * Uses a two-pass approach: first calculates all normal scores, then boosts included exercises
 *
 * @param exercises - Array of exercises to score
 * @param criteria - Scoring criteria from Phase 1 and Phase 2 filters
 * @returns Array of scored exercises sorted by score (highest first)
 */
export async function scoreAndSortExercises(
  exercises: Exercise[],
  criteria: ScoringCriteria,
): Promise<ScoredExercise[]> {
  const startTime = performance.now();
  // console.log('🎯 Scoring exercises with criteria:', {
  //   includeExercisesCount: criteria.includeExercises?.length || 0,
  //   muscleTargetCount: criteria.muscleTarget.length,
  //   muscleLessenCount: criteria.muscleLessen.length,
  //   intensity: criteria.intensity,
  //   exerciseCount: exercises.length,
  // });

  // PASS 1: Score all exercises normally (without include boost)
  const { scoredExercises: firstPassResults, maxScore } =
    performFirstPassScoring(exercises, criteria);

  // PASS 2: Add foundational adjustments and boost included exercises
  const finalScoredExercises = performSecondPassScoring(
    firstPassResults,
    criteria,
    maxScore,
  );

  // Sort by score (highest first)
  finalScoredExercises.sort((a, b) => b.score - a.score);

  // Analyze and log score distribution
  analyzeScoreDistribution(finalScoredExercises, criteria, maxScore);

  // Log performance metrics
  logScoringPerformance(startTime, exercises.length);

  return finalScoredExercises;
}
