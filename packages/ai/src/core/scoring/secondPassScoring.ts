import type { Exercise } from "../../types";
import type { ScoredExercise, ScoringCriteria } from "../../types/scoredExercise";
import { SCORING_CONFIG } from "./scoringConfig";
import { scoreExercise } from "./firstPassScoring";

/**
 * Calculate foundational adjustment based on skill and strength levels
 * This is only added during the second pass for exercises with high skill requirements
 */
function calculateFoundationalBonus(exercise: Exercise, skillLevel?: string, strengthLevel?: string): number {
  if (!skillLevel || !strengthLevel) return 0;
  
  // Define foundational capacity levels
  const foundationalLevels = ["very_low", "low"];
  
  // Check if client is at foundational level for both skill AND strength
  const isFoundationalSkill = foundationalLevels.includes(skillLevel);
  const isFoundationalStrength = foundationalLevels.includes(strengthLevel);
  
  if (isFoundationalSkill && isFoundationalStrength) {
    // Penalize exercises that are too complex for foundational clients
    if (exercise.complexityLevel === "high") {
      return SCORING_CONFIG.FOUNDATIONAL_HIGH_COMPLEXITY_PENALTY; // -2.0
    }
    
    // Slightly penalize moderate complexity
    if (exercise.complexityLevel === "moderate") {
      return SCORING_CONFIG.FOUNDATIONAL_MODERATE_COMPLEXITY_PENALTY; // -1.0
    }
  }
  
  return 0;
}

/**
 * Check if exercise is in the include list
 */
function isIncludedExercise(exercise: Exercise, includeExercises: string[]): boolean {
  if (!includeExercises || includeExercises.length === 0) return false;
  return includeExercises.includes(exercise.name);
}

/**
 * Update a scored exercise with foundational bonus
 */
function addFoundationalBonus(
  exercise: ScoredExercise,
  criteria: ScoringCriteria,
  includeBreakdown: boolean
): ScoredExercise {
  const foundationalBonus = calculateFoundationalBonus(
    exercise, 
    criteria.skillLevel, 
    criteria.strengthLevel
  );
  
  if (foundationalBonus === 0) {
    return exercise;
  }
  
  const newScore = Math.max(0, exercise.score + foundationalBonus);
  
  const updatedExercise: ScoredExercise = {
    ...exercise,
    score: newScore
  };
  
  if (includeBreakdown && exercise.scoreBreakdown) {
    updatedExercise.scoreBreakdown = {
      ...exercise.scoreBreakdown,
      foundationalBonus,
      total: newScore
    };
  }
  
  return updatedExercise;
}

/**
 * Perform the second pass of scoring:
 * 1. Add foundational bonuses/penalties
 * 2. Re-score included exercises with boost
 */
export function performSecondPassScoring(
  firstPassResults: ScoredExercise[],
  criteria: ScoringCriteria,
  maxScore: number,
  includeBreakdown: boolean = false
): ScoredExercise[] {
  console.log('🎯 Second pass: Adding foundational adjustments and include boosts');
  
  const finalScoredExercises = firstPassResults.map(exercise => {
    // First add foundational bonus
    let scoredExercise = addFoundationalBonus(exercise, criteria, includeBreakdown);
    
    // Then check if this is an included exercise that needs boosting
    const isIncluded = isIncludedExercise(exercise, criteria.includeExercises || []);
    
    if (isIncluded) {
      // Give included exercises a score 1 point higher than the current max
      const includeBoost = maxScore + SCORING_CONFIG.INCLUDE_EXERCISE_PRIORITY - exercise.score;
      
      // Re-score the exercise with the boost
      scoredExercise = scoreExercise(exercise, criteria, includeBoost, includeBreakdown);
      
      // Re-add foundational bonus after re-scoring
      scoredExercise = addFoundationalBonus(scoredExercise, criteria, includeBreakdown);
      
      console.log(`🔹 Boosted included exercise "${exercise.name}" to score ${scoredExercise.score}`);
    }
    
    return scoredExercise;
  });
  
  console.log('📊 Second pass complete');
  return finalScoredExercises;
}