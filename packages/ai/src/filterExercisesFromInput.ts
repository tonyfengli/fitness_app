import { filterExercises } from "./filtering/filterExercises";
import type { WorkoutRoutineStateType, ClientContext, RoutineTemplate } from "./types";
import type { ScoredExercise, ScoringCriteria } from "./types/scoredExercise";
import { ExerciseFilterError } from "./filtering/rulesBasedFilter";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  routineTemplate?: RoutineTemplate;
  exercises?: any[]; // Pass exercises directly from API
}

/**
 * Filters exercises based on client context and optional user input
 * This is the main API-ready function for exercise filtering
 * 
 * @param options - Object containing client context, user input, or legacy filter criteria
 * @returns Promise<WorkoutRoutineStateType> - The filtered exercises
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
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutRoutineStateType> {
  try {
    console.log('🚀 filterExercisesFromInput called');
    const { userInput = "", clientContext, routineTemplate, exercises } = options;
    
    // Check if we have any scoring criteria (Phase 1 or Phase 2)
    // Scoring should be enabled if ANY criteria are provided
    const hasScoringCriteria = clientContext && (
      (clientContext.exercise_requests?.include && clientContext.exercise_requests.include.length > 0) ||
      (clientContext.muscle_target && clientContext.muscle_target.length > 0) ||
      (clientContext.muscle_lessen && clientContext.muscle_lessen.length > 0) ||
      clientContext.intensity // Enable scoring if intensity is selected (even if medium)
    );
    
    // Build scoring criteria if we have any scoring data
    let scoringCriteria: ScoringCriteria | undefined;
    if (hasScoringCriteria) {
      scoringCriteria = {
        includeExercises: clientContext.exercise_requests?.include || [],
        muscleTarget: clientContext.muscle_target || [],
        muscleLessen: clientContext.muscle_lessen || [],
        intensity: clientContext.intensity,
      };
    }
    
    // Use the new direct filtering function with optional scoring
    const filteredExercises = await filterExercises({
      exercises: exercises, // Use exercises passed from API
      businessId: clientContext?.business_id,
      clientContext,
      includeScoring: !!hasScoringCriteria,
      scoringCriteria,
    });
    
    // Return in the expected WorkoutRoutineStateType format
    return {
      userInput: userInput.trim(),
      programmedRoutine: "",
      exercises: [], // Original exercises not needed in response
      clientContext: clientContext!,
      filteredExercises,
      routineTemplate: routineTemplate || {
        routine_goal: "mixed_focus",
        muscle_target: [],
        routine_intensity: "moderate_local"
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