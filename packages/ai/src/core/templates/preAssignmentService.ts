import type { ScoredExercise } from "../../types/scoredExercise";
import type { ClientContext } from "../../types/clientContext";
import type { PreAssignedExercise } from "../../types/standardBlueprint";
import type { WorkoutType } from "../../types/clientTypes";

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
 * Service for deterministically pre-assigning exercises based on includes and favorites
 */
export class PreAssignmentService {
  /**
   * Check if an exercise targets lower body
   */
  private static isLowerBodyExercise(exercise: ScoredExercise): boolean {
    const lowerBodyPatterns = ['squat', 'lunge', 'hinge', 'calf_raise'];
    const lowerBodyMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
    
    return (
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
    
    return (
      (exercise.movementPattern && upperBodyPatterns.includes(exercise.movementPattern)) ||
      (exercise.primaryMuscle && upperBodyMuscles.includes(exercise.primaryMuscle))
    );
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
      
      console.log(`[PreAssignment] Added ${includeExerciseScored.length} include exercises for ${clientContext.name}`);
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
      
      console.log(`[PreAssignment] Added ${topFavoritesWithTieInfo.length} favorite exercises for ${clientContext.name}`);
    }
    
    // Log final pre-assignment
    console.log(`[PreAssignment] Total pre-assigned for ${clientContext.name}: ${preAssigned.length}`);
    preAssigned.forEach((pa, idx) => {
      console.log(`  ${idx + 1}. ${pa.exercise.name} (${pa.source}) - Score: ${pa.exercise.score.toFixed(1)}`);
    });
    
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
      
      console.log(`[PreAssignment] Added ${preAssigned.length} include exercises for ${clientContext.name}`);
    }
    
    // Check what constraints we still need to satisfy
    const hasLowerBody = preAssigned.some(pa => this.isLowerBodyExercise(pa.exercise));
    const hasUpperBody = preAssigned.some(pa => this.isUpperBodyExercise(pa.exercise));
    
    // Debug: Check if favorites have score breakdowns
    console.log(`[PreAssignment] Checking favorite exercises for ${clientContext.name}:`);
    const debugFavorites = scoredExercises.filter(ex => favoriteExerciseIds.includes(ex.id)).slice(0, 3);
    debugFavorites.forEach(ex => {
      console.log(`  - ${ex.name}: Score=${ex.score}, FavoriteBoost=${ex.scoreBreakdown?.favoriteExerciseBoost}`);
    });
    
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
          if (selected.length > 0) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: 'Favorite',
              tiedCount: selected[0].tiedCount
            });
            console.log(`[PreAssignment] Added lower body favorite: ${selected[0].exercise.name}`);
          }
        } else {
          // No favorite lower body, find best lower body from all exercises
          const allLowerBody = scoredExercises.filter(ex => 
            this.isLowerBodyExercise(ex) &&
            !preAssigned.some(pa => pa.exercise.id === ex.id)
          );
          
          if (allLowerBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(allLowerBody, 1);
            if (selected.length > 0) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: 'Constraint',
                tiedCount: selected[0].tiedCount
              });
              console.log(`[PreAssignment] Added lower body for constraint: ${selected[0].exercise.name}`);
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
          if (selected.length > 0) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: 'Favorite',
              tiedCount: selected[0].tiedCount
            });
            console.log(`[PreAssignment] Added upper body favorite: ${selected[0].exercise.name}`);
          }
        } else {
          // No favorite upper body, find best upper body from all exercises
          const allUpperBody = scoredExercises.filter(ex => 
            this.isUpperBodyExercise(ex) &&
            !preAssigned.some(pa => pa.exercise.id === ex.id)
          );
          
          if (allUpperBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(allUpperBody, 1);
            if (selected.length > 0) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: 'Constraint',
                tiedCount: selected[0].tiedCount
              });
              console.log(`[PreAssignment] Added upper body for constraint: ${selected[0].exercise.name}`);
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
        
        console.log(`[PreAssignment] Added ${selected.length} more favorite exercises`);
      }
    }
    
    // Log final pre-assignment with constraint satisfaction
    console.log(`[PreAssignment] Total pre-assigned for ${clientContext.name}: ${preAssigned.length}`);
    console.log(`[PreAssignment] Constraints satisfied - Lower body: ${preAssigned.some(pa => this.isLowerBodyExercise(pa.exercise))}, Upper body: ${preAssigned.some(pa => this.isUpperBodyExercise(pa.exercise))}`);
    preAssigned.forEach((pa, idx) => {
      const bodyPart = this.isLowerBodyExercise(pa.exercise) ? 'Lower' : this.isUpperBodyExercise(pa.exercise) ? 'Upper' : 'Core';
      console.log(`  ${idx + 1}. ${pa.exercise.name} (${pa.source}, ${bodyPart}) - Score: ${pa.exercise.score.toFixed(1)}`);
    });
    
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
            selected.push({ exercise: randomEx, tiedCount });
            used.add(randomEx.id);
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
            selected.push(randomEx);
            used.add(randomEx.id);
          }
        }
      }
    }
    
    return selected;
  }
}