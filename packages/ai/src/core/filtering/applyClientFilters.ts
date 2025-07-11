import type { Exercise, ClientContext } from "../../types";
import { applyAllFilters } from "./filterFunctions";
import type { StrengthLevel, SkillLevel } from "./types";
import { extractFilterCriteriaFromContext } from "../../types/clientContext";

export class ExerciseFilterError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ExerciseFilterError';
  }
}

/**
 * Apply client-based filtering to exercises based on client context
 * This is a direct function call, not a LangGraph node
 * 
 * @param exercises - Array of exercises to filter
 * @param clientContext - Client context with fitness profile and preferences
 * @returns Filtered exercises array
 */
export function applyClientFilters(
  exercises: Exercise[],
  clientContext: ClientContext
): Exercise[] {
  console.log('📐 Applying client filters');
  
  if (!exercises || exercises.length === 0) {
    console.log('⚠️ No exercises available to filter');
    return [];
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