/**
 * Workout Type Strategy Pattern
 * Defines constraints and pre-assignment rules per workout type
 */

import type { Exercise } from '../../types/exercise';
import type { ScoredExercise } from '../../types/scoredExercise';
import type { ClientContext } from '../../types/clientContext';
import { WorkoutType, BUCKET_CONFIGS } from '../../types/clientTypes';

export interface PreAssignmentRule {
  type: 'include' | 'favorite' | 'movement_pattern' | 'function_tag' | 'muscle_target';
  count: number;
  priority: number; // Lower number = higher priority
  filter?: (exercise: ScoredExercise, client: ClientContext) => boolean;
}

export interface WorkoutTypeStrategy {
  // Constraints
  constraints: {
    movementPatterns: Record<string, { min: number; max: number }>;
    functionalRequirements: Record<string, number>;
    flexSlots: number;
    totalExercises: number;
  };
  
  // Pre-assignment rules
  preAssignmentRules: PreAssignmentRule[];
  
  // Maximum pre-assignments allowed
  maxPreAssignments: number;
}

// Helper functions for pre-assignment filters
const hasMovementPattern = (pattern: string) => (ex: ScoredExercise) => 
  ex.movementPattern?.toLowerCase() === pattern.toLowerCase();

const hasFunctionTag = (tag: string) => (ex: ScoredExercise) => 
  ex.functionTags?.includes(tag) || false;

const targetsMuscle = (client: ClientContext) => (ex: ScoredExercise) => {
  const targets = client.muscle_target || [];
  return targets.some(muscle => 
    ex.primaryMuscle === muscle || 
    (ex.secondaryMuscles && ex.secondaryMuscles.includes(muscle))
  );
};

// Workout Type Strategies
export const WORKOUT_TYPE_STRATEGIES: Record<WorkoutType, WorkoutTypeStrategy> = {
  [WorkoutType.FULL_BODY_WITH_FINISHER]: {
    constraints: BUCKET_CONFIGS[WorkoutType.FULL_BODY_WITH_FINISHER],
    preAssignmentRules: [
      // Priority 1: Always include user's include requests
      { type: 'include', count: 10, priority: 1 }, // Up to 10 includes
      
      // Priority 2: Add 2 favorites (MUST be 1 upper body + 1 lower body)
      { type: 'favorite', count: 2, priority: 2 }
    ],
    maxPreAssignments: 4 // Don't pre-assign more than 4 exercises
  },
  
  [WorkoutType.FULL_BODY_WITHOUT_FINISHER]: {
    constraints: BUCKET_CONFIGS[WorkoutType.FULL_BODY_WITHOUT_FINISHER],
    preAssignmentRules: [
      { type: 'include', count: 10, priority: 1 },
      { type: 'favorite', count: 2, priority: 2 }
    ],
    maxPreAssignments: 2
  },
  
  [WorkoutType.TARGETED_WITH_FINISHER]: {
    constraints: BUCKET_CONFIGS[WorkoutType.TARGETED_WITH_FINISHER],
    preAssignmentRules: [
      { type: 'include', count: 10, priority: 1 },
      // Pre-assign exercises targeting user's muscle focus
      {
        type: 'muscle_target',
        count: 2,
        priority: 2,
        filter: (ex, client) => targetsMuscle(client)(ex)
      },
      // Ensure at least one capacity exercise
      {
        type: 'function_tag',
        count: 1,
        priority: 3,
        filter: hasFunctionTag('capacity')
      }
    ],
    maxPreAssignments: 4
  },
  
  [WorkoutType.TARGETED_WITHOUT_FINISHER]: {
    constraints: BUCKET_CONFIGS[WorkoutType.TARGETED_WITHOUT_FINISHER],
    preAssignmentRules: [
      { type: 'include', count: 10, priority: 1 },
      // Focus on muscle targets for targeted workout
      {
        type: 'muscle_target',
        count: 3,
        priority: 2,
        filter: (ex, client) => targetsMuscle(client)(ex)
      }
    ],
    maxPreAssignments: 4
  }
};

/**
 * Get strategy for a workout type
 */
export function getWorkoutTypeStrategy(workoutType: WorkoutType): WorkoutTypeStrategy {
  return WORKOUT_TYPE_STRATEGIES[workoutType];
}

/**
 * Select exercises with tie-breaking for same scores
 * Returns exercises with tie count information
 */
function selectWithTieBreaking(exercises: ScoredExercise[], count: number): Array<{ exercise: ScoredExercise; tiedCount?: number }> {
  if (exercises.length === 0 || count <= 0) return [];
  if (exercises.length <= count) return exercises.map(ex => ({ exercise: ex }));
  
  const selected: Array<{ exercise: ScoredExercise; tiedCount?: number }> = [];
  const used = new Set<string>();
  
  while (selected.length < count) {
    // Find highest score among remaining
    let highestScore = -Infinity;
    for (const ex of exercises) {
      if (!used.has(ex.id) && ex.score > highestScore) {
        highestScore = ex.score;
      }
    }
    
    // Get all exercises with the highest score
    const tied = exercises.filter(ex => 
      !used.has(ex.id) && ex.score === highestScore
    );
    
    if (tied.length === 0) break;
    
    // Randomly select from tied exercises
    const randomIndex = Math.floor(Math.random() * tied.length);
    const selectedEx = tied[randomIndex];
    
    if (selectedEx) {
      selected.push({
        exercise: selectedEx,
        tiedCount: tied.length > 1 ? tied.length : undefined
      });
      used.add(selectedEx.id);
    }
  }
  
  return selected;
}

// Store tie information globally for the current pre-assignment process
let globalTieInfo: Map<string, number> | null = null;

/**
 * Process pre-assignments based on workout type rules
 */
export function processPreAssignments(
  exercises: ScoredExercise[],
  client: ClientContext,
  workoutType: WorkoutType,
  includeIds: string[],
  favoriteIds: string[]
): ScoredExercise[] {
  const strategy = getWorkoutTypeStrategy(workoutType);
  const preAssigned: ScoredExercise[] = [];
  const usedIds = new Set<string>();
  
  // Initialize global tie info for this process
  globalTieInfo = new Map<string, number>();
  
  // console.log('🎯 processPreAssignments:', {
  //   workoutType,
  //   includeIds: includeIds.length,
  //   favoriteIds: favoriteIds.length,
  //   maxPreAssignments: strategy.maxPreAssignments
  // });
  
  // Sort rules by priority
  const sortedRules = [...strategy.preAssignmentRules].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (preAssigned.length >= strategy.maxPreAssignments) break;
    
    let candidates: ScoredExercise[] = [];
    let requestedIds: string[] = [];
    
    switch (rule.type) {
      case 'include':
        requestedIds = includeIds.filter(id => !usedIds.has(id));
        candidates = exercises.filter(ex => requestedIds.includes(ex.id));
        break;
        
      case 'favorite':
        // Special handling for Full Body workout types favorites
        // MUST select 1 upper body + 1 lower body (body part balance constraint)
        if (workoutType === WorkoutType.FULL_BODY_WITH_FINISHER || 
            workoutType === WorkoutType.FULL_BODY_WITHOUT_FINISHER) {
          requestedIds = favoriteIds.filter(id => !usedIds.has(id));
          const favoriteExercises = exercises.filter(ex => requestedIds.includes(ex.id));
          
          // Sort by score (descending) for highest scoring favorites
          favoriteExercises.sort((a, b) => b.score - a.score);
          
          // Separate into upper and lower body based on primary muscle
          const upperBodyMuscles = ['chest', 'back', 'shoulders', 'delts', 'biceps', 'triceps', 
                                    'lats', 'traps', 'upper_back', 'middle_back', 'rhomboids', 
                                    'pectorals', 'anterior_delts', 'lateral_delts', 'posterior_delts'];
          const lowerBodyMuscles = ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 
                                    'adductors', 'abductors', 'lower_back'];
          
          const upperBody = favoriteExercises.filter(ex => {
            const primaryMuscle = ex.primaryMuscle?.toLowerCase() || '';
            const pattern = ex.movementPattern?.toLowerCase() || '';
            
            // Check primary muscle first (takes precedence)
            if (upperBodyMuscles.includes(primaryMuscle)) return true;
            if (lowerBodyMuscles.includes(primaryMuscle)) return false;
            
            // Special case: "core" as primary muscle means lower body
            if (primaryMuscle === 'core') return false;
            
            // If no clear muscle classification, use movement pattern
            if (pattern === 'core') return false;
            
            // Fallback to movement pattern
            return pattern.includes('push') || pattern.includes('pull') || 
                   pattern === 'shoulder_isolation' || pattern === 'arm_isolation';
          });
          
          const lowerBody = favoriteExercises.filter(ex => {
            const primaryMuscle = ex.primaryMuscle?.toLowerCase() || '';
            const pattern = ex.movementPattern?.toLowerCase() || '';
            
            // Check primary muscle first (takes precedence)
            if (lowerBodyMuscles.includes(primaryMuscle)) return true;
            if (upperBodyMuscles.includes(primaryMuscle)) return false;
            
            // Special case: "core" as primary muscle means lower body
            if (primaryMuscle === 'core') return true;
            
            // If no clear muscle classification, use movement pattern
            if (pattern === 'core') return true;
            
            // Fallback to movement pattern
            return pattern === 'squat' || pattern === 'hinge' || 
                   pattern === 'lunge' || pattern === 'calf_isolation';
          });
          
          
          // Removed verbose favorite exercise listing
          
          // Removed verbose body part separation logging
          
          // Select 1 from each category (with tie-breaking if needed)
          const selectedUpperWithTies = selectWithTieBreaking(upperBody, 1);
          const selectedLowerWithTies = selectWithTieBreaking(lowerBody, 1);
          
          // Removed verbose selected favorites logging
          
          // Ensure we have 1 upper and 1 lower (fallback if needed)
          if (selectedUpperWithTies.length === 0 && selectedLowerWithTies.length === 2) {
            // No upper body favorites available, using 2 lower body
          } else if (selectedLowerWithTies.length === 0 && selectedUpperWithTies.length === 2) {
            // No lower body favorites available, using 2 upper body
          } else if (selectedUpperWithTies.length === 0 && selectedLowerWithTies.length === 0) {
            // No favorites available for body part balance
          }
          
          // Store tie information in global map
          [...selectedUpperWithTies, ...selectedLowerWithTies].forEach(item => {
            if (item.tiedCount && globalTieInfo) {
              globalTieInfo.set(item.exercise.id, item.tiedCount);
            }
          });
          
          candidates = [
            ...selectedUpperWithTies.map(item => item.exercise),
            ...selectedLowerWithTies.map(item => item.exercise)
          ];
        } else {
          // Default favorite handling for other workout types
          requestedIds = favoriteIds.filter(id => !usedIds.has(id));
          candidates = exercises.filter(ex => requestedIds.includes(ex.id));
        }
        break;
        
      case 'movement_pattern':
      case 'function_tag':
      case 'muscle_target':
        if (rule.filter) {
          candidates = exercises.filter(ex => 
            !usedIds.has(ex.id) && rule.filter!(ex, client)
          );
        }
        break;
    }
    
    // Take up to rule.count exercises
    const toAdd = candidates.slice(0, Math.min(
      rule.count, 
      strategy.maxPreAssignments - preAssigned.length
    ));
    
    // Removed verbose rule processing logging
    
    toAdd.forEach(ex => {
      preAssigned.push(ex);
      usedIds.add(ex.id);
    });
  }
  
  // Keep essential pre-assignment summary
  console.log(`  Pre-assigned ${preAssigned.length} exercises for workout type ${workoutType}`);
  
  return preAssigned;
}

/**
 * Get tie information for the last pre-assignment process
 */
export function getPreAssignmentTieInfo(): Map<string, number> | null {
  return globalTieInfo;
}