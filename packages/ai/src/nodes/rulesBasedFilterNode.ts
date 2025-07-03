import type { WorkoutRoutineStateType } from "../types";
import { applyAllFilters, type StrengthLevel, type SkillLevel } from "../utils/filterExercises";
import { extractFilterCriteriaFromContext } from "../types/clientContext";

export class ExerciseFilterError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ExerciseFilterError';
  }
}

/**
 * LangGraph node that applies rules-based filtering to exercises
 * Uses deterministic rules based on client context (strength, skill, joints, etc.)
 * @param state - Current workflow state containing exercises and client context
 * @returns Updated state with filtered exercises
 * @throws {ExerciseFilterError} If filtering fails
 */
export async function rulesBasedFilterNode(state: WorkoutRoutineStateType) {
  try {
    console.log('📐 rulesBasedFilterNode called');
    // Extract data from state
    const { 
      exercises, 
      userInput,
      clientContext 
    } = state;
    
    if (!exercises || exercises.length === 0) {
      throw new ExerciseFilterError('No exercises available to filter');
    }
    
    // If no client context provided, return all exercises
    if (!clientContext) {
      return {
        filteredExercises: exercises,
      };
    }
    
    // Extract filter criteria from client context
    const filterCriteria = extractFilterCriteriaFromContext(clientContext);
    
    // Apply client context filtering (strength, skill, exercise requests, and joint restrictions)
    const filteredExercises = applyAllFilters(exercises, {
      strength: filterCriteria.strength as StrengthLevel,
      skill: filterCriteria.skill as SkillLevel,
      include: clientContext.exercise_requests?.include || [],
      avoid: clientContext.exercise_requests?.avoid || [],
      avoidJoints: clientContext.avoid_joints || [],
    });
    
    
    
    return {
      ...state, // Preserve all existing state
      filteredExercises, // Update only the filtered exercises
    };
  } catch (error) {
    // Re-throw known errors without wrapping
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    // Log unexpected errors
    console.error('❌ Unexpected error in rulesBasedFilterNode:', error);
    
    // Wrap unknown errors with context
    throw new ExerciseFilterError(
      'Unexpected error during rules-based filtering',
      error
    );
  }
}