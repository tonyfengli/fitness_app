import { createFilterGraph } from "./graph";
import { fetchAllExercises } from "./utils/fetchExercises";
import type { WorkoutStateType, FilterCriteria } from "./types";
import { ExerciseFilterError } from "./nodes/filterExercisesNode";

/**
 * Filters exercises based on provided criteria
 * This is the main API-ready function for exercise filtering
 * 
 * @param filterCriteria - Object containing strength, skill, and intensity filter values
 * @returns Promise<WorkoutStateType> - The filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 * 
 * @example
 * ```typescript
 * const result = await filterExercisesFromInput({
 *   strength: "moderate",
 *   skill: "low", 
 *   intensity: "low_local"
 * });
 * console.log(result.filteredExercises); // Array of filtered exercises
 * ```
 */
export async function filterExercisesFromInput(filterCriteria: FilterCriteria): Promise<WorkoutStateType> {
  try {
    // Fetch all exercises first
    const allExercises = await fetchAllExercises();
    
    if (!allExercises || allExercises.length === 0) {
      throw new ExerciseFilterError('No exercises available in database');
    }
    
    // Create the filter graph
    const app = createFilterGraph();
    
    // Run the filtering workflow
    const result = await app.invoke({
      userInput: "",
      workoutPlan: "",
      exercises: allExercises,
      filterCriteria,
      filteredExercises: [],
    });
    
    // Validate the result
    if (!result.filteredExercises) {
      throw new ExerciseFilterError('Failed to filter exercises');
    }
    
    return result;
  } catch (error) {
    // Re-throw ExerciseFilterError as-is
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    // Wrap any other errors
    throw new ExerciseFilterError(
      'Failed to filter exercises from input',
      error
    );
  }
}