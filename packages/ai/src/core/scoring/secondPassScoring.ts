import type { Exercise } from "../../types";
import type { ScoredExercise, ScoringCriteria } from "../../types/scoredExercise";
import { SCORING_CONFIG } from "./scoringConfig";
import { scoreExercise } from "./firstPassScoring";

/**
 * Check if exercise is in the include list
 */
function isIncludedExercise(exercise: Exercise, includeExercises: string[]): boolean {
  if (!includeExercises || includeExercises.length === 0) return false;
  return includeExercises.includes(exercise.name);
}

/**
 * Perform the second pass of scoring:
 * Re-score included exercises with boost to ensure they rank highest
 */
export function performSecondPassScoring(
  firstPassResults: ScoredExercise[],
  criteria: ScoringCriteria,
  maxScore: number,
  includeBreakdown: boolean = false
): ScoredExercise[] {
  console.log('🎯 Second pass: Boosting included exercises');
  
  const finalScoredExercises = firstPassResults.map(exercise => {
    // Check if this is an included exercise that needs boosting
    const isIncluded = isIncludedExercise(exercise, criteria.includeExercises || []);
    
    if (isIncluded) {
      // Give included exercises a score 1 point higher than the current max
      const includeBoost = maxScore + SCORING_CONFIG.INCLUDE_EXERCISE_PRIORITY - exercise.score;
      
      // Re-score the exercise with the boost
      const boostedExercise = scoreExercise(exercise, criteria, includeBoost, includeBreakdown);
      
      console.log(`🔹 Boosted included exercise "${exercise.name}" to score ${boostedExercise.score}`);
      return boostedExercise;
    }
    
    return exercise;
  });
  
  console.log('📊 Second pass complete');
  return finalScoredExercises;
}