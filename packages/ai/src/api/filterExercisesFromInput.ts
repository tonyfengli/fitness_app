import { filterExercises } from "../core/filtering/filterExercises";
import type { WorkoutSessionStateType, ClientContext, WorkoutTemplate } from "../types";
import type { ScoredExercise } from "../types/scoredExercise";
import { ExerciseFilterError } from "../core/filtering/applyClientFilters";
import { buildScoringCriteria } from "../utils/scoringCriteria";
import { applyTemplateOrganization } from "../utils/templateOrganization";
import { addPresentationFlagsAuto } from "../formatting/exerciseFlags";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  workoutTemplate?: WorkoutTemplate;
  exercises?: any[]; // Pass exercises directly from API
  intensity?: "low" | "moderate" | "high"; // Pass intensity separately for scoring
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
 * console.log(result.filteredExercises); // Array of filtered exercises
 * ```
 */
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutSessionStateType> {
  try {
    const startTime = performance.now();
    console.log('🚀 filterExercisesFromInput called');
    const { userInput = "", clientContext, workoutTemplate, exercises, intensity } = options;
    
    // Step 1: Build scoring criteria
    const scoringCriteria = buildScoringCriteria(clientContext, intensity);
    
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
    console.log(`⏱️ Filtering took: ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
    
    // Step 3: Apply template organization if provided
    const templateStartTime = performance.now();
    const templateResult = applyTemplateOrganization(
      filteredExercises as ScoredExercise[], 
      workoutTemplate
    );
    
    // Step 4: Add presentation flags for UI
    const exercisesWithFlags = addPresentationFlagsAuto(
      filteredExercises as ScoredExercise[],
      templateResult?.organizedExercises ?? null
    );
    
    if (templateResult) {
      const templateEndTime = performance.now();
      console.log(`⏱️ Template organization took: ${(templateEndTime - templateStartTime).toFixed(2)}ms`);
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`⏱️ TOTAL filterExercisesFromInput time: ${totalTime.toFixed(2)}ms`);
    
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