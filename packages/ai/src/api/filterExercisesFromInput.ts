import { filterExercises } from "../core/filtering/filterExercises";
import type { WorkoutSessionStateType, ClientContext, FilterWorkoutTemplate } from "../types";
import type { ScoredExercise } from "../types/scoredExercise";
import { ExerciseFilterError } from "../core/filtering/applyClientFilters";
import { buildScoringCriteria } from "../utils/scoringCriteria";
// Template organization removed - individual workouts not template-aware yet
import { addPresentationFlagsAuto } from "../formatting/exerciseFlags";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  workoutTemplate?: FilterWorkoutTemplate;
  exercises?: any[]; // Pass exercises directly from API
  intensity?: "low" | "moderate" | "high"; // Optional override for client's intensity preference
}

/**
 * Filters exercises based on client context and optional user input
 * This is the main API-ready function for exercise filtering
 * 
 * @param options - Object containing client context, user input, or legacy filter criteria
 * @returns Promise<WorkoutSessionStateType> - The filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 * 
 * @example
 * ```typescript
 * const result = await filterExercisesFromInput({
 *   clientContext: {
 *     name: "John Doe",
 *     fitness_profile: {
 *       strength_capacity: "moderate",
 *       skill_capacity: "low"
 *     }
 *   },
 *   userInput: "I want to work out today"
 * });
 * // console.log(result.filteredExercises); // Array of filtered exercises
 * ```
 */
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutSessionStateType> {
  try {
    const startTime = performance.now();
    // console.log('🚀 filterExercisesFromInput called');
    const { userInput = "", clientContext, workoutTemplate, exercises, intensity } = options;
    
    // Step 1: Build scoring criteria
    console.log('[filterExercisesFromInput] ClientContext favoriteExerciseIds:', clientContext?.favoriteExerciseIds);
    const scoringCriteria = buildScoringCriteria(clientContext, intensity);
    console.log('[filterExercisesFromInput] ScoringCriteria favoriteExerciseIds:', scoringCriteria?.favoriteExerciseIds);
    
    // Step 2: Filter and score exercises
    const filterStartTime = performance.now();
    const filteredExercises = await filterExercises({
      exercises: exercises,
      businessId: clientContext?.business_id,
      clientContext,
      includeScoring: true, // Always enable scoring for proper organization
      scoringCriteria,
    });
    const filterEndTime = performance.now();
    // console.log(`⏱️ Filtering took: ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    
    // Step 3: Add presentation flags for UI (no template organization for now)
    const exercisesWithFlags = addPresentationFlagsAuto(
      filteredExercises as ScoredExercise[],
      null // No template organization for individual workouts yet
    );
    
    const totalTime = performance.now() - startTime;
    // console.log(`⏱️ TOTAL filterExercisesFromInput time: ${totalTime.toFixed(2)}ms`);
    
    // Return in the expected WorkoutSessionStateType format
    return {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: [], // Original exercises not needed in response
      clientContext: clientContext ?? {} as ClientContext,
      filteredExercises: exercisesWithFlags,
      workoutTemplate: workoutTemplate ?? {
        workout_goal: "mixed_focus",
        muscle_target: [],
        workout_intensity: "moderate_local"
      }
    };
  } catch (error) {
    // Re-throw ExerciseFilterError as-is
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    // Log unexpected errors
    console.error('❌ Unexpected error in filterExercisesFromInput:', error);
    
    // Wrap any other errors
    throw new ExerciseFilterError(
      'Failed to filter exercises from input',
      error
    );
  }
}