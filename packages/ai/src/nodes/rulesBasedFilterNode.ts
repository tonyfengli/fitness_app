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
    // Extract data from state
    const { 
      exercises, 
      userInput,
      clientContext 
    } = state;
    
    if (!exercises || exercises.length === 0) {
      throw new ExerciseFilterError('No exercises available to filter');
    }
    
    // Log user input for context (future LLM enhancement)
    if (userInput) {
      console.log(`User input: "${userInput}"`);
    }
    
    // If no client context provided, return all exercises
    if (!clientContext) {
      console.log('No client context provided, returning all exercises');
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
    
    console.log(
      `Rules-based filtering: ${exercises.length} exercises → ${filteredExercises.length} exercises`,
      {
        clientName: clientContext.name,
        strengthCapacity: clientContext.strength_capacity,
        skillCapacity: clientContext.skill_capacity,
        includeExercises: clientContext.exercise_requests?.include || [],
        avoidExercises: clientContext.exercise_requests?.avoid || [],
        avoidJoints: clientContext.avoid_joints || [],
        userInput: userInput || 'No user input',
        filteringType: 'Rules-based (deterministic)',
        filteringNotes: 'Include filters override strength/skill restrictions, avoid joints filters apply to all exercises, exclude filters override everything'
      }
    );
    
    return {
      filteredExercises,
    };
  } catch (error) {
    // Re-throw known errors without wrapping
    if (error instanceof ExerciseFilterError) {
      throw error;
    }
    
    // Wrap unknown errors with context
    throw new ExerciseFilterError(
      'Unexpected error during rules-based filtering',
      error
    );
  }
}