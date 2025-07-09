import type { Exercise, ClientContext } from "../types";
import { applyAllFilters, type StrengthLevel, type SkillLevel } from "../utils/filterExercises";
import { extractFilterCriteriaFromContext } from "../types/clientContext";

export class ExerciseFilterError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ExerciseFilterError';
  }
}

/**
 * Apply rules-based filtering to exercises based on client context
 * This is a direct function call, not a LangGraph node
 * 
 * @param exercises - Array of exercises to filter
 * @param clientContext - Client context with fitness profile and preferences
 * @returns Filtered exercises array
 */
export async function applyRulesBasedFilter(
  exercises: Exercise[],
  clientContext: ClientContext
): Promise<Exercise[]> {
  console.log('📐 Applying rules-based filter');
  
  if (!exercises || exercises.length === 0) {
    throw new ExerciseFilterError('No exercises available to filter');
  }
  
  // If no client context provided, return all exercises
  if (!clientContext) {
    return exercises;
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
    
  return filteredExercises;
}