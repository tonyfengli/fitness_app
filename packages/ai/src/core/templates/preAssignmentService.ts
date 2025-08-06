import type { ScoredExercise } from "../../types/scoredExercise";
import type { ClientContext } from "../../types/clientContext";
import type { PreAssignedExercise } from "../../types/standardBlueprint";
import type { WorkoutType } from "../../types/clientTypes";
import type { GroupScoredExercise } from "../../types/groupContext";
import { categorizeSharedExercises } from "../../workout-generation/standard/sharedExerciseFilters";

/**
 * Constraints for pre-assignment based on workout type
 */
interface PreAssignmentConstraints {
  requireLowerBody?: boolean;
  requireUpperBody?: boolean;
  maxPerMuscleGroup?: number;
  requiredMovementPatterns?: string[];
}

/**
 * Workout type specific constraints
 */
const WORKOUT_TYPE_CONSTRAINTS: Record<string, PreAssignmentConstraints> = {
  'full_body': {
    requireLowerBody: true,
    requireUpperBody: true,
    maxPerMuscleGroup: 1
  },
  'full_body_with_finisher': {
    requireLowerBody: true,
    requireUpperBody: true,
    maxPerMuscleGroup: 1
  }
};

/**
 * Body category types
 */
export type BodyCategory = 'upper' | 'lower' | 'core_full';

/**
 * Service for deterministically pre-assigning exercises based on includes and favorites
 */
export class PreAssignmentService {
  /**
   * Check if an exercise targets lower body
   */
  private static isLowerBodyExercise(exercise: ScoredExercise): boolean {
    const lowerBodyPatterns = ['squat', 'lunge', 'hinge', 'calf_raise'];
    const lowerBodyMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
    
    return Boolean(
      (exercise.movementPattern && lowerBodyPatterns.includes(exercise.movementPattern)) ||
      (exercise.primaryMuscle && lowerBodyMuscles.includes(exercise.primaryMuscle))
    );
  }
  
  /**
   * Check if an exercise targets upper body
   */
  private static isUpperBodyExercise(exercise: ScoredExercise): boolean {
    const upperBodyPatterns = ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'];
    const upperBodyMuscles = ['chest', 'back', 'shoulders', 'lats', 'triceps', 'biceps', 'traps'];
    
    return Boolean(
      (exercise.movementPattern && upperBodyPatterns.includes(exercise.movementPattern)) ||
      (exercise.primaryMuscle && upperBodyMuscles.includes(exercise.primaryMuscle))
    );
  }

  /**
   * Get body category for an exercise
   */
  private static getBodyCategory(exercise: ScoredExercise): BodyCategory {
    const primaryMuscle = exercise.primaryMuscle?.toLowerCase() || '';
    const hasCapacityTag = exercise.functionTags?.includes('capacity') || false;
    
    // Core/Full body classification
    if (primaryMuscle === 'core' || primaryMuscle === 'abs' || primaryMuscle === 'obliques' || hasCapacityTag) {
      return 'core_full';
    }
    
    // Check if upper body
    if (this.isUpperBodyExercise(exercise)) return 'upper';
    
    // Check if lower body
    if (this.isLowerBodyExercise(exercise)) return 'lower';
    
    // Default to core/full if unclear
    return 'core_full';
  }

  /**
   * Determine pre-assigned exercises for a client
   * Priority: 1) Include exercises, 2) Top-scored favorites
   * 
   * @param clientContext Client preferences and context
   * @param scoredExercises All scored exercises for this client
   * @param favoriteExerciseIds List of exercise IDs marked as favorites
   * @param workoutType Optional workout type for applying constraints
   * @returns Array of pre-assigned exercises with source labels
   */
  static determinePreAssignedExercises(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = [],
    workoutType?: WorkoutType
  ): PreAssignedExercise[] {
    // Check if we need to apply constraints
    const constraints = workoutType ? WORKOUT_TYPE_CONSTRAINTS[workoutType] : null;
    
    if (constraints) {
      return this.determineConstrainedPreAssignment(
        clientContext,
        scoredExercises,
        favoriteExerciseIds,
        constraints
      );
    }
    
    // Otherwise use standard logic
    return this.determineStandardPreAssignment(
      clientContext,
      scoredExercises,
      favoriteExerciseIds
    );
  }
  
  /**
   * Standard pre-assignment without constraints (original logic)
   */
  private static determineStandardPreAssignment(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = []
  ): PreAssignedExercise[] {
    const preAssigned: PreAssignedExercise[] = [];
    const includeExercises = clientContext.exercise_requests?.include || [];
    
    // Step 1: Add all include exercises (if any)
    if (includeExercises.length > 0) {
      // Find the scored versions of include exercises
      const includeExerciseScored = scoredExercises.filter(ex => 
        includeExercises.includes(ex.name)
      );
      
      // Add all includes as pre-assigned
      includeExerciseScored.forEach(exercise => {
        preAssigned.push({
          exercise,
          source: 'Include'
        });
      });
      
      // Added include exercises
    }
    
    // Step 2: If we need more pre-assigned (less than 2), add top favorites
    if (preAssigned.length < 2 && favoriteExerciseIds.length > 0) {
      // Get favorite exercises that aren't already pre-assigned
      const favoriteExercises = scoredExercises.filter(ex => 
        favoriteExerciseIds.includes(ex.id) &&
        !preAssigned.some(pa => pa.exercise.id === ex.id)
      );
      
      // Sort by score (they already have favorite boost applied)
      favoriteExercises.sort((a, b) => b.score - a.score);
      
      // Take enough to reach 2 total pre-assigned
      const needed = 2 - preAssigned.length;
      const topFavoritesWithTieInfo = this.selectTopWithTieBreakingAndCount(favoriteExercises, needed);
      
      topFavoritesWithTieInfo.forEach(({ exercise, tiedCount }) => {
        preAssigned.push({
          exercise,
          source: 'Favorite',
          tiedCount
        });
      });
      
      // Added favorite exercises
    }
    
    // Keep essential pre-assignment summary
    console.log(`[PreAssignment] ${clientContext.name}: ${preAssigned.length} exercises (${preAssigned.map(pa => pa.source).join(', ')})`);
    
    return preAssigned;
  }
  
  /**
   * Pre-assignment with constraints (for full body workouts)
   */
  private static determineConstrainedPreAssignment(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = [],
    constraints: PreAssignmentConstraints
  ): PreAssignedExercise[] {
    const preAssigned: PreAssignedExercise[] = [];
    const includeExercises = clientContext.exercise_requests?.include || [];
    
    // Step 1: Process include exercises first
    if (includeExercises.length > 0) {
      const includeExerciseScored = scoredExercises.filter(ex => 
        includeExercises.includes(ex.name)
      );
      
      // Add includes but check if we're meeting constraints
      includeExerciseScored.forEach(exercise => {
        if (preAssigned.length < 2) {
          preAssigned.push({
            exercise,
            source: 'Include'
          });
        }
      });
      
      // Added include exercises with constraints
    }
    
    // Check what constraints we still need to satisfy
    const hasLowerBody = preAssigned.some(pa => this.isLowerBodyExercise(pa.exercise));
    const hasUpperBody = preAssigned.some(pa => this.isUpperBodyExercise(pa.exercise));
    
    // Removed debug favorite score breakdown logging
    
    // Step 2: If we need to satisfy constraints and have room, do so
    if (preAssigned.length < 2) {
      const favoriteExercises = scoredExercises.filter(ex => 
        favoriteExerciseIds.includes(ex.id) &&
        !preAssigned.some(pa => pa.exercise.id === ex.id)
      );
      
      // Sort favorites by score
      favoriteExercises.sort((a, b) => b.score - a.score);
      
      // If we need lower body and don't have it
      if (constraints.requireLowerBody && !hasLowerBody && preAssigned.length < 2) {
        const lowerBodyFavorites = favoriteExercises.filter(ex => this.isLowerBodyExercise(ex));
        
        if (lowerBodyFavorites.length > 0) {
          const selected = this.selectTopWithTieBreakingAndCount(lowerBodyFavorites, 1);
          if (selected.length > 0 && selected[0]) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: 'Favorite',
              tiedCount: selected[0].tiedCount
            });
            // Added lower body favorite
          }
        } else {
          // No favorite lower body, find best lower body from all exercises
          const allLowerBody = scoredExercises.filter(ex => 
            this.isLowerBodyExercise(ex) &&
            !preAssigned.some(pa => pa.exercise.id === ex.id)
          );
          
          if (allLowerBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(allLowerBody, 1);
            if (selected.length > 0 && selected[0]) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: 'Constraint',
                tiedCount: selected[0].tiedCount
              });
              // Added lower body for constraint
            }
          }
        }
      }
      
      // If we need upper body and don't have it
      if (constraints.requireUpperBody && !hasUpperBody && preAssigned.length < 2) {
        const upperBodyFavorites = favoriteExercises.filter(ex => 
          this.isUpperBodyExercise(ex) &&
          !preAssigned.some(pa => pa.exercise.id === ex.id)
        );
        
        if (upperBodyFavorites.length > 0) {
          const selected = this.selectTopWithTieBreakingAndCount(upperBodyFavorites, 1);
          if (selected.length > 0 && selected[0]) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: 'Favorite',
              tiedCount: selected[0].tiedCount
            });
            // Added upper body favorite
          }
        } else {
          // No favorite upper body, find best upper body from all exercises
          const allUpperBody = scoredExercises.filter(ex => 
            this.isUpperBodyExercise(ex) &&
            !preAssigned.some(pa => pa.exercise.id === ex.id)
          );
          
          if (allUpperBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(allUpperBody, 1);
            if (selected.length > 0 && selected[0]) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: 'Constraint',
                tiedCount: selected[0].tiedCount
              });
              // Added upper body for constraint
            }
          }
        }
      }
      
      // Step 3: Fill remaining slots with top favorites (if still under 2)
      if (preAssigned.length < 2) {
        const remainingFavorites = favoriteExercises.filter(ex =>
          !preAssigned.some(pa => pa.exercise.id === ex.id)
        );
        
        const needed = 2 - preAssigned.length;
        const selected = this.selectTopWithTieBreakingAndCount(remainingFavorites, needed);
        
        selected.forEach(({ exercise, tiedCount }) => {
          preAssigned.push({
            exercise,
            source: 'Favorite',
            tiedCount
          });
        });
        
        // Added remaining favorite exercises
      }
    }
    
    // Keep essential constraint satisfaction summary
    const hasLower = preAssigned.some(pa => this.isLowerBodyExercise(pa.exercise));
    const hasUpper = preAssigned.some(pa => this.isUpperBodyExercise(pa.exercise));
    console.log(`[PreAssignment] ${clientContext.name}: ${preAssigned.length} exercises (L:${hasLower} U:${hasUpper})`);
    // Removed detailed exercise-by-exercise logging
    
    return preAssigned;
  }
  
  /**
   * Select top N exercises with tie-breaking randomization and tie count tracking
   */
  private static selectTopWithTieBreakingAndCount(
    exercises: ScoredExercise[], 
    count: number
  ): Array<{ exercise: ScoredExercise; tiedCount: number }> {
    if (exercises.length === 0 || count <= 0) return [];
    if (exercises.length <= count) {
      return exercises.map(ex => ({ exercise: ex, tiedCount: 1 }));
    }
    
    const selected: Array<{ exercise: ScoredExercise; tiedCount: number }> = [];
    const used = new Set<string>();
    
    while (selected.length < count && exercises.length > used.size) {
      // Find the highest score among unused exercises
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
      
      const tiedCount = tied.length;
      
      // If we need more exercises than tied, take all tied
      const remaining = count - selected.length;
      if (tied.length <= remaining) {
        tied.forEach(ex => {
          selected.push({ exercise: ex, tiedCount });
          used.add(ex.id);
        });
      } else {
        // Randomly select from tied exercises
        for (let i = 0; i < remaining; i++) {
          const availableTied = tied.filter(ex => !used.has(ex.id));
          if (availableTied.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableTied.length);
            const randomEx = availableTied[randomIndex];
            if (randomEx) {
              selected.push({ exercise: randomEx, tiedCount });
              used.add(randomEx.id);
            }
          }
        }
      }
    }
    
    return selected;
  }
  
  /**
   * Select top N exercises with tie-breaking randomization
   */
  private static selectTopWithTieBreaking(
    exercises: ScoredExercise[], 
    count: number
  ): ScoredExercise[] {
    if (exercises.length === 0 || count <= 0) return [];
    if (exercises.length <= count) return exercises;
    
    const selected: ScoredExercise[] = [];
    const used = new Set<string>();
    
    while (selected.length < count && exercises.length > used.size) {
      // Find the highest score among unused exercises
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
      
      // If we need more exercises than tied, take all tied
      const remaining = count - selected.length;
      if (tied.length <= remaining) {
        tied.forEach(ex => {
          selected.push(ex);
          used.add(ex.id);
        });
      } else {
        // Randomly select from tied exercises
        for (let i = 0; i < remaining; i++) {
          const availableTied = tied.filter(ex => !used.has(ex.id));
          if (availableTied.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableTied.length);
            const randomEx = availableTied[randomIndex];
            if (randomEx) {
              selected.push(randomEx);
              used.add(randomEx.id);
            }
          }
        }
      }
    }
    
    return selected;
  }

  /**
   * Process pre-assignments for full body workouts with shared exercise logic
   * This is the new implementation for Exercise #1 and Exercise #2 selection
   */
  static processFullBodyPreAssignmentsWithShared(
    clientsData: Map<string, {
      context: ClientContext;
      exercises: ScoredExercise[];
      favoriteIds: string[];
    }>,
    sharedExercisePool: GroupScoredExercise[]
  ): Map<string, PreAssignedExercise[]> {
    const result = new Map<string, PreAssignedExercise[]>();
    const allClientIds = Array.from(clientsData.keys());
    
    // Step 1: Each client selects Exercise #1 (highest favorite)
    const exercise1Selections = new Map<string, { exercise: ScoredExercise; bodyCategory: BodyCategory }>();
    
    for (const [clientId, data] of clientsData) {
      const { exercises, favoriteIds } = data;
      
      // Get favorites sorted by score
      const favorites = exercises
        .filter(ex => favoriteIds.includes(ex.id))
        .sort((a, b) => b.score - a.score);
      
      if (favorites.length > 0) {
        // Select highest with tie-breaking
        const tied = favorites.filter(ex => ex.score === favorites[0]!.score);
        const selected = tied[Math.floor(Math.random() * tied.length)];
        
        if (selected) {
          exercise1Selections.set(clientId, {
            exercise: selected,
            bodyCategory: this.getBodyCategory(selected)
          });
          
          result.set(clientId, [{
            exercise: selected,
            source: 'favorite',
            tiedCount: tied.length > 1 ? tied.length : undefined
          }]);
        }
      } else {
        // No favorites available
        result.set(clientId, []);
      }
    }
    
    // Step 2: Select Exercise #2 from shared pool (globally coordinated)
    const categorized = categorizeSharedExercises(sharedExercisePool);
    const otherSharedExercises = categorized.other; // Only use "Other Shared", not Core & Finisher
    
    // Determine which clients need shared exercises and their constraints
    const clientConstraints = new Map<string, 'upper' | 'lower' | null>();
    
    for (const [clientId, selection] of exercise1Selections) {
      const exercise1BodyType = selection.bodyCategory;
      
      if (exercise1BodyType === 'upper') {
        clientConstraints.set(clientId, 'lower');
      } else if (exercise1BodyType === 'lower') {
        clientConstraints.set(clientId, 'upper');
      } else {
        // core_full can be either upper or lower
        clientConstraints.set(clientId, null);
      }
    }
    
    // Try cascading selection for shared Exercise #2
    let sharedExercise2: GroupScoredExercise | null = null;
    let participatingClients: string[] = [];
    
    // Start with exercises shared by all clients, then cascade down
    for (let shareCount = allClientIds.length; shareCount >= 2; shareCount--) {
      const candidatesAtLevel = otherSharedExercises
        .filter(ex => ex.clientsSharing.length === shareCount)
        .filter(ex => {
          // Check if this exercise satisfies constraints for all sharing clients
          const bodyCategory = this.getBodyCategory(ex);
          
          // For clients with specific constraints (upper/lower)
          for (const clientId of ex.clientsSharing) {
            const constraint = clientConstraints.get(clientId);
            if (constraint === 'upper' && bodyCategory !== 'upper') return false;
            if (constraint === 'lower' && bodyCategory !== 'lower') return false;
          }
          
          return true;
        })
        .sort((a, b) => b.groupScore - a.groupScore);
      
      if (candidatesAtLevel.length > 0) {
        // Select highest scoring with tie-breaking
        const tied = candidatesAtLevel.filter(ex => ex.groupScore === candidatesAtLevel[0]!.groupScore);
        const selected = tied[Math.floor(Math.random() * tied.length)];
        if (selected) {
          sharedExercise2 = selected;
          participatingClients = selected.clientsSharing;
        }
        break;
      }
    }
    
    // Step 3: Assign Exercise #2 to participating clients
    if (sharedExercise2) {
      for (const clientId of participatingClients) {
        const currentPreAssigned = result.get(clientId) || [];
        const clientExercise = clientsData.get(clientId)?.exercises.find(ex => ex.id === sharedExercise2!.id);
        
        if (clientExercise) {
          currentPreAssigned.push({
            exercise: clientExercise,
            source: 'shared_other',
            sharedWith: participatingClients
          });
          result.set(clientId, currentPreAssigned);
        }
      }
    }
    
    // Step 4: Handle "left behind" clients (those who couldn't participate in shared)
    for (const [clientId, data] of clientsData) {
      const currentPreAssigned = result.get(clientId) || [];
      
      // If client has less than 2 exercises, they were "left behind"
      if (currentPreAssigned.length < 2) {
        const { exercises, favoriteIds } = data;
        const usedIds = new Set(currentPreAssigned.map(p => p.exercise.id));
        
        // Get remaining favorites
        const remainingFavorites = exercises
          .filter(ex => favoriteIds.includes(ex.id) && !usedIds.has(ex.id))
          .sort((a, b) => b.score - a.score);
        
        // If Exercise #1 exists, apply body type constraint for Exercise #2
        if (currentPreAssigned.length === 1) {
          const exercise1BodyType = this.getBodyCategory(currentPreAssigned[0]!.exercise);
          let constrainedFavorites = remainingFavorites;
          
          if (exercise1BodyType === 'upper') {
            constrainedFavorites = remainingFavorites.filter(ex => this.getBodyCategory(ex) === 'lower');
          } else if (exercise1BodyType === 'lower') {
            constrainedFavorites = remainingFavorites.filter(ex => this.getBodyCategory(ex) === 'upper');
          }
          
          // Use constrained if available, otherwise fall back to any favorite
          const candidatesForExercise2 = constrainedFavorites.length > 0 ? constrainedFavorites : remainingFavorites;
          
          if (candidatesForExercise2.length > 0) {
            const tied = candidatesForExercise2.filter(ex => ex.score === candidatesForExercise2[0]!.score);
            const selected = tied[Math.floor(Math.random() * tied.length)];
            
            if (selected) {
              currentPreAssigned.push({
                exercise: selected,
                source: 'favorite',
                tiedCount: tied.length > 1 ? tied.length : undefined
              });
            }
          }
        } else if (currentPreAssigned.length === 0) {
          // No Exercise #1, select up to 2 favorites
          const topTwo = this.selectTopWithTieBreakingAndCount(remainingFavorites, 2);
          topTwo.forEach(({ exercise, tiedCount }) => {
            currentPreAssigned.push({
              exercise,
              source: 'favorite',
              tiedCount
            });
          });
        }
        
        result.set(clientId, currentPreAssigned);
      }
    }
    
    // Log results
    console.log('[PreAssignment] Full body with shared results:');
    for (const [clientId, preAssigned] of result) {
      const client = clientsData.get(clientId)?.context;
      console.log(`  ${client?.name}: ${preAssigned.length} exercises`);
      if (preAssigned[1]?.source === 'shared_other' && preAssigned[1]?.sharedWith) {
        console.log(`    Shared with: ${preAssigned[1].sharedWith.map((id: string) => 
          clientsData.get(id)?.context.name || id
        ).join(', ')}`);
      }
    }
    
    return result;
  }
}