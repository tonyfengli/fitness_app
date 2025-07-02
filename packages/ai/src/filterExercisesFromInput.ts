import { createFilterGraph } from "./graph";
import { fetchAllExercises, fetchExercisesByBusiness } from "./utils/fetchExercises";
import type { WorkoutStateType, FilterCriteria, ClientContext } from "./types";
import { ExerciseFilterError } from "./nodes/rulesBasedFilterNode";
import { createDefaultClientContext } from "./types/clientContext";

export interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  filterCriteria?: FilterCriteria; // Legacy support
}

/**
 * Filters exercises based on client context and optional user input
 * This is the main API-ready function for exercise filtering
 * 
 * @param options - Object containing client context, user input, or legacy filter criteria
 * @returns Promise<WorkoutStateType> - The filtered exercises
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
export async function filterExercisesFromInput(options: FilterExercisesOptions): Promise<WorkoutStateType> {
  try {
    const { userInput = "", clientContext, filterCriteria } = options;
    
    // Determine which exercises to fetch based on business context
    let allExercises;
    
    if (clientContext?.business_id) {
      // Fetch business-specific exercises
      allExercises = await fetchExercisesByBusiness(clientContext.business_id);
      console.log(`Fetched ${allExercises.length} exercises for business ${clientContext.business_id}`);
    } else {
      // Fallback to all exercises if no business context
      allExercises = await fetchAllExercises();
      console.log(`Fetched ${allExercises.length} exercises (no business context)`);
    }
    
    if (!allExercises || allExercises.length === 0) {
      throw new ExerciseFilterError('No exercises available for this business');
    }
    
    // Handle client context or create from legacy filter criteria
    let finalClientContext: ClientContext;
    
    if (clientContext) {
      finalClientContext = clientContext;
    } else if (filterCriteria) {
      // Legacy support: convert filter criteria to client context
      finalClientContext = createDefaultClientContext(
        filterCriteria.strength as any || "moderate",
        filterCriteria.skill as any || "moderate",
        { include: [], avoid: [] },
        undefined // no business ID for legacy
      );
    } else {
      // Default fallback
      finalClientContext = createDefaultClientContext();
    }
    
    // Create the filter graph
    const app = createFilterGraph();
    
    // Run the filtering workflow with client context
    const result = await app.invoke({
      userInput: userInput.trim(),
      workoutPlan: "",
      exercises: allExercises,
      clientContext: finalClientContext,
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