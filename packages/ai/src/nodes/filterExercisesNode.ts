import type { WorkoutStateType } from "../types";
import { applyAllFilters, type StrengthLevel, type SkillLevel, type IntensityLevel } from "../utils/filterExercises";

export class ExerciseFilterError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ExerciseFilterError';
  }
}

/**
 * LangGraph node that filters exercises based on user criteria
 * Applies strength, skill, and intensity filters to the exercises list
 * @param state - Current workflow state containing exercises and filter criteria
 * @returns Updated state with filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 */
export async function filterExercisesNode(state: WorkoutStateType) {
  try {
    // Extract filter criteria from state
    const { 
      exercises, 
      filterCriteria 
    } = state;
    
    if (!exercises || exercises.length === 0) {
      throw new ExerciseFilterError('No exercises available to filter');
    }
    
    // If no filter criteria provided, return all exercises
    if (!filterCriteria) {
      return {
        filteredExercises: exercises,
      };
    }
    
    // Apply filters using the utility function
    const filteredExercises = applyAllFilters(exercises, {
      strength: (filterCriteria.strength || "all") as StrengthLevel,
      skill: (filterCriteria.skill || "all") as SkillLevel,
      intensity: (filterCriteria.intensity || "all") as IntensityLevel,
    });
    
    console.log(`Filtered ${exercises.length} exercises down to ${filteredExercises.length} based on criteria:`, filterCriteria);
    
    return {
      filteredExercises,
    };
  } catch (error) {
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    throw new ExerciseFilterError(
      'Unexpected error during exercise filtering',
      error
    );
  }
}