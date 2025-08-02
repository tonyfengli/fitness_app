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
      { type: 'favorite', count: 2, priority: 2 },
      // Pre-assign a squat or hinge for strength focus
      {
        type: 'movement_pattern',
        count: 1,
        priority: 3,
        filter: (ex) => hasMovementPattern('squat')(ex) || hasMovementPattern('hinge')(ex)
      }
    ],
    maxPreAssignments: 3
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
  
  console.log('🎯 processPreAssignments:', {
    workoutType,
    includeIds: includeIds.length,
    favoriteIds: favoriteIds.length,
    maxPreAssignments: strategy.maxPreAssignments
  });
  
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
        // Special handling for Full Body With Finisher favorites
        // MUST select 1 upper body + 1 lower body (body part balance constraint)
        if (workoutType === WorkoutType.FULL_BODY_WITH_FINISHER) {
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
            
            // Special case: "core" as primary muscle typically means lower body
            if (primaryMuscle === 'core') return false;
            
            // Check primary muscle first
            if (upperBodyMuscles.includes(primaryMuscle)) return true;
            if (lowerBodyMuscles.includes(primaryMuscle)) return false;
            
            // Fallback to movement pattern
            return pattern.includes('push') || pattern.includes('pull') || 
                   pattern === 'shoulder_isolation' || pattern === 'arm_isolation';
          });
          
          const lowerBody = favoriteExercises.filter(ex => {
            const primaryMuscle = ex.primaryMuscle?.toLowerCase() || '';
            const pattern = ex.movementPattern?.toLowerCase() || '';
            
            // Special case: "core" as primary muscle typically means lower body
            if (primaryMuscle === 'core') return true;
            
            // Check primary muscle first
            if (lowerBodyMuscles.includes(primaryMuscle)) return true;
            if (upperBodyMuscles.includes(primaryMuscle)) return false;
            
            // Fallback to movement pattern
            return pattern === 'squat' || pattern === 'hinge' || 
                   pattern === 'lunge' || pattern === 'calf_isolation';
          });
          
          
          console.log('  Favorite body part separation:', {
            upperBody: upperBody.map(ex => ({ name: ex.name, muscle: ex.primaryMuscle, score: ex.score })),
            lowerBody: lowerBody.map(ex => ({ name: ex.name, muscle: ex.primaryMuscle, score: ex.score }))
          });
          
          // Select 1 from each category (with tie-breaking if needed)
          const selectedUpperWithTies = selectWithTieBreaking(upperBody, 1);
          const selectedLowerWithTies = selectWithTieBreaking(lowerBody, 1);
          
          console.log('  Selected favorites:', {
            upper: selectedUpperWithTies.map(item => item.exercise.name),
            lower: selectedLowerWithTies.map(item => item.exercise.name)
          });
          
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
    
    console.log(`  Rule ${rule.type} (priority ${rule.priority}):`, {
      candidatesFound: candidates.length,
      ruleCount: rule.count,
      currentPreAssigned: preAssigned.length,
      toAddCount: toAdd.length,
      exercises: toAdd.map(ex => ex.name)
    });
    
    toAdd.forEach(ex => {
      preAssigned.push(ex);
      usedIds.add(ex.id);
    });
  }
  
  console.log('  Final pre-assigned:', preAssigned.map(ex => ({ name: ex.name, id: ex.id })));
  
  return preAssigned;
}

/**
 * Get tie information for the last pre-assignment process
 */
export function getPreAssignmentTieInfo(): Map<string, number> | null {
  return globalTieInfo;
}