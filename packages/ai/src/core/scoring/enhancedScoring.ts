/**
 * Enhanced scoring functions with score breakdown tracking
 */

import type { Exercise } from "../../types";
import type { ScoredExercise, ScoringCriteria } from "../../types/scoredExercise";
import { scoreTracker, debugLogger } from "../../utils/enhancedDebug";
import { SCORING_CONFIG } from "./scoringConfig";

// Extract scoring constants from config
const MUSCLE_SCORING = {
  primaryMuscleBonus: SCORING_CONFIG.MUSCLE_TARGET_PRIMARY,
  secondaryMuscleBonus: SCORING_CONFIG.MUSCLE_TARGET_SECONDARY,
  primaryMusclePenalty: SCORING_CONFIG.MUSCLE_LESSEN_PRIMARY,
  secondaryMusclePenalty: SCORING_CONFIG.MUSCLE_LESSEN_SECONDARY,
};

// TODO: Define movement pattern and function tag scoring mappings
const MOVEMENT_PATTERN_SCORING: Record<string, Record<string, number>> = {};
const FUNCTION_TAG_SCORING: Record<string, Record<string, number>> = {};

/**
 * Enhanced scoring function that tracks score breakdowns
 */
export function enhancedApplyScoring(
  exercises: Exercise[],
  criteria: ScoringCriteria,
  enableDebug: boolean = false
): ScoredExercise[] {
  if (enableDebug) {
    debugLogger.log('scoring', 'Starting enhanced scoring', {
      exerciseCount: exercises.length,
      criteria: {
        targetMuscles: criteria.muscleTarget,
        avoidMuscles: criteria.muscleLessen,
        primaryGoal: criteria.primaryGoal,
        intensity: criteria.intensity
      }
    });
  }
  
  const startTime = performance.now();
  
  const scoredExercises = exercises.map(exercise => {
    const bonuses: Array<{ reason: string; value: number }> = [];
    const penalties: Array<{ reason: string; value: number }> = [];
    let baseScore = SCORING_CONFIG.BASE_SCORE;
    
    // Calculate muscle targeting bonus
    if (criteria.muscleTarget && criteria.muscleTarget.length > 0) {
      // Primary muscle match
      if (criteria.muscleTarget.includes(exercise.primaryMuscle)) {
        const bonus = MUSCLE_SCORING.primaryMuscleBonus;
        bonuses.push({ reason: `primary_muscle_match:${exercise.primaryMuscle}`, value: bonus });
        
        if (enableDebug) {
          debugLogger.log('scoring', `Primary muscle bonus for ${exercise.name}`, {
            muscle: exercise.primaryMuscle,
            bonus
          });
        }
      }
      
      // Secondary muscle matches
      const secondaryMatches = exercise.secondaryMuscles?.filter(muscle => 
        criteria.muscleTarget?.includes(muscle)
      ) ?? [];
      
      if (secondaryMatches.length > 0) {
        const bonus = MUSCLE_SCORING.secondaryMuscleBonus * secondaryMatches.length;
        bonuses.push({ 
          reason: `secondary_muscle_matches:${secondaryMatches.join(',')}`, 
          value: bonus 
        });
      }
    }
    
    // Calculate muscle avoidance penalty
    if (criteria.muscleLessen && criteria.muscleLessen.length > 0) {
      // Primary muscle penalty
      if (criteria.muscleLessen.includes(exercise.primaryMuscle)) {
        const penalty = MUSCLE_SCORING.primaryMusclePenalty;
        penalties.push({ 
          reason: `avoid_primary_muscle:${exercise.primaryMuscle}`, 
          value: penalty 
        });
      }
      
      // Secondary muscle penalties
      const secondaryPenalties = exercise.secondaryMuscles?.filter(muscle => 
        criteria.muscleLessen?.includes(muscle)
      ) ?? [];
      
      if (secondaryPenalties.length > 0) {
        const penalty = MUSCLE_SCORING.secondaryMusclePenalty * secondaryPenalties.length;
        penalties.push({ 
          reason: `avoid_secondary_muscles:${secondaryPenalties.join(',')}`, 
          value: penalty 
        });
      }
    }
    
    // Calculate movement pattern bonus
    if (criteria.primaryGoal && exercise.movementPattern) {
      const movementBonus = MOVEMENT_PATTERN_SCORING[criteria.primaryGoal]?.[exercise.movementPattern];
      if (movementBonus && movementBonus > 0) {
        bonuses.push({ 
          reason: `movement_pattern:${exercise.movementPattern}_for_${criteria.primaryGoal}`, 
          value: movementBonus 
        });
      }
    }
    
    // Calculate function tag bonus
    if (criteria.primaryGoal && exercise.functionTags) {
      const primaryGoal = criteria.primaryGoal;
      exercise.functionTags.forEach(tag => {
        const tagBonus = FUNCTION_TAG_SCORING[primaryGoal]?.[tag];
        if (tagBonus && tagBonus > 0) {
          bonuses.push({ 
            reason: `function_tag:${tag}_for_${primaryGoal}`, 
            value: tagBonus 
          });
        }
      });
    }
    
    // Calculate final score
    const totalBonus = bonuses.reduce((sum, b) => sum + b.value, 0);
    const totalPenalty = penalties.reduce((sum, p) => sum + p.value, 0);
    const finalScore = Math.max(0, baseScore + totalBonus - totalPenalty);
    
    // Track the breakdown
    if (enableDebug) {
      scoreTracker.addBreakdown(
        { ...exercise, score: finalScore } as ScoredExercise,
        baseScore,
        bonuses,
        penalties
      );
    }
    
    return {
      ...exercise,
      score: finalScore
    } as ScoredExercise;
  });
  
  const duration = performance.now() - startTime;
  
  if (enableDebug) {
    debugLogger.log('scoring', 'Scoring complete', {
      duration,
      averageScore: scoredExercises.reduce((sum, ex) => sum + ex.score, 0) / scoredExercises.length,
      scoreDistribution: {
        above8: scoredExercises.filter(ex => ex.score > 8).length,
        between5and8: scoredExercises.filter(ex => ex.score >= 5 && ex.score <= 8).length,
        below5: scoredExercises.filter(ex => ex.score < 5).length
      }
    });
    debugLogger.logPerformance(debugLogger.getLogs().length, duration);
  }
  
  return scoredExercises;
}

/**
 * Get top exercises by score with detailed breakdown
 */
export function getTopExercisesWithBreakdown(
  exercises: ScoredExercise[], 
  count: number = 10
): Array<ScoredExercise & { breakdown?: any }> {
  const sorted = [...exercises].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, count);
  
  // Add breakdown if available
  return top.map(exercise => {
    const breakdown = scoreTracker.getBreakdowns()[exercise.id];
    return breakdown ? { ...exercise, breakdown } : exercise;
  });
}