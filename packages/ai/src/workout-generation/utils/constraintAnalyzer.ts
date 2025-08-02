/**
 * Constraint Analyzer
 * Analyzes exercise sets against workout type constraints
 */

import type { Exercise } from '../../types/exercise';
import type { ScoredExercise } from '../../types/scoredExercise';
import type { ClientContext } from '../../types/clientContext';
import { WorkoutType } from '../../types/clientTypes';
import { getWorkoutTypeStrategy } from '../strategies/workoutTypeStrategies';

export interface ConstraintAnalysis {
  movementPatterns: {
    [pattern: string]: {
      current: number;
      min: number;
      max: number;
      status: 'met' | 'under' | 'over';
      needed: number; // How many more needed to meet min
    };
  };
  functionalRequirements: {
    [requirement: string]: {
      current: number;
      required: number;
      status: 'met' | 'under';
      needed: number;
    };
  };
  summary: {
    totalExercises: number;
    totalNeeded: number;
    movementPatternsmet: number;
    movementPatternsTotal: number;
    functionalRequirementsMet: number;
    functionalRequirementsTotal: number;
    allConstraintsMet: boolean;
  };
}

/**
 * Normalize movement pattern for consistent comparison
 */
function normalizePattern(pattern: string | undefined): string {
  return (pattern || '').toLowerCase().trim();
}

/**
 * Count exercises by movement pattern
 */
function countMovementPatterns(exercises: (Exercise | ScoredExercise)[]): Map<string, number> {
  const counts = new Map<string, number>();
  
  exercises.forEach(ex => {
    const pattern = normalizePattern(ex.movementPattern);
    if (pattern) {
      counts.set(pattern, (counts.get(pattern) || 0) + 1);
    }
  });
  
  return counts;
}

/**
 * Count exercises meeting functional requirements
 */
function countFunctionalRequirements(
  exercises: (Exercise | ScoredExercise)[],
  client: ClientContext
): Map<string, number> {
  const counts = new Map<string, number>();
  
  // Count capacity/strength tags
  exercises.forEach(ex => {
    ex.functionTags?.forEach(tag => {
      if (tag === 'capacity' || tag === 'strength') {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    });
  });
  
  // Count muscle targets
  if (client.muscle_target && client.muscle_target.length > 0) {
    const muscleTargetCount = exercises.filter(ex => {
      const targets = client.muscle_target || [];
      return targets.some(muscle => 
        ex.primaryMuscle === muscle || 
        (ex.secondaryMuscles && ex.secondaryMuscles.includes(muscle))
      );
    }).length;
    
    counts.set('muscle_target', muscleTargetCount);
  }
  
  return counts;
}

/**
 * Analyze exercises against workout type constraints
 */
export function analyzeConstraints(
  exercises: (Exercise | ScoredExercise)[],
  client: ClientContext,
  workoutType: WorkoutType
): ConstraintAnalysis {
  const strategy = getWorkoutTypeStrategy(workoutType);
  const movementCounts = countMovementPatterns(exercises);
  const functionalCounts = countFunctionalRequirements(exercises, client);
  
  // Analyze movement patterns
  const movementPatterns: ConstraintAnalysis['movementPatterns'] = {};
  let movementPatternsMet = 0;
  
  Object.entries(strategy.constraints.movementPatterns).forEach(([pattern, { min, max }]) => {
    const current = movementCounts.get(pattern) || 0;
    const status = current >= min ? (current > max ? 'over' : 'met') : 'under';
    const needed = Math.max(0, min - current);
    
    movementPatterns[pattern] = { current, min, max, status, needed };
    if (status === 'met') movementPatternsMet++;
  });
  
  // Analyze functional requirements
  const functionalRequirements: ConstraintAnalysis['functionalRequirements'] = {};
  let functionalRequirementsMet = 0;
  
  Object.entries(strategy.constraints.functionalRequirements).forEach(([requirement, required]) => {
    const current = functionalCounts.get(requirement) || 0;
    const status = current >= required ? 'met' : 'under';
    const needed = Math.max(0, required - current);
    
    functionalRequirements[requirement] = { current, required, status, needed };
    if (status === 'met') functionalRequirementsMet++;
  });
  
  // Calculate summary
  const movementPatternsTotal = Object.keys(strategy.constraints.movementPatterns).length;
  const functionalRequirementsTotal = Object.keys(strategy.constraints.functionalRequirements).length;
  
  const summary = {
    totalExercises: exercises.length,
    totalNeeded: strategy.constraints.totalExercises,
    movementPatternsmet: movementPatternsMet,
    movementPatternsTotal,
    functionalRequirementsMet,
    functionalRequirementsTotal,
    allConstraintsMet: 
      movementPatternsMet === movementPatternsTotal && 
      functionalRequirementsMet === functionalRequirementsTotal &&
      exercises.length >= strategy.constraints.totalExercises
  };
  
  return {
    movementPatterns,
    functionalRequirements,
    summary
  };
}

/**
 * Get remaining exercises needed to meet constraints
 */
export function getRemainingNeeds(analysis: ConstraintAnalysis): {
  movementPatterns: string[];
  functionalRequirements: string[];
  totalExercises: number;
} {
  const movementPatterns: string[] = [];
  const functionalRequirements: string[] = [];
  
  // Collect unmet movement patterns
  Object.entries(analysis.movementPatterns).forEach(([pattern, data]) => {
    if (data.status === 'under') {
      for (let i = 0; i < data.needed; i++) {
        movementPatterns.push(pattern);
      }
    }
  });
  
  // Collect unmet functional requirements
  Object.entries(analysis.functionalRequirements).forEach(([requirement, data]) => {
    if (data.status === 'under') {
      for (let i = 0; i < data.needed; i++) {
        functionalRequirements.push(requirement);
      }
    }
  });
  
  const totalExercises = Math.max(
    0,
    analysis.summary.totalNeeded - analysis.summary.totalExercises
  );
  
  return {
    movementPatterns,
    functionalRequirements,
    totalExercises
  };
}