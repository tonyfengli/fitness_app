import type { Exercise, ClientContext } from "../types";
import type { ScoredExercise, ScoringCriteria } from "../types/scoredExercise";
import { applyClientFilters } from "./applyClientFilters";
import { scoreAndSortExercises } from "./scoreExercises";
import { fetchAllExercises, fetchExercisesByBusiness } from "../utils/fetchExercises";
import { createDefaultClientContext } from "../types/clientContext";

export interface DirectFilterOptions {
  exercises?: Exercise[]; // Optional: provide exercises directly
  businessId?: string; // Optional: fetch business-specific exercises
  clientContext?: ClientContext;
  includeScoring?: boolean; // Whether to apply scoring and sorting
  scoringCriteria?: ScoringCriteria; // Scoring criteria for Phase 2
}

/**
 * Main function to filter exercises
 * Applies client-based filtering and optionally scoring/sorting
 * 
 * @param options - Filtering and scoring options
 * @returns Filtered exercises (scored and sorted if scoring is enabled)
 */
export async function filterExercises(
  options: DirectFilterOptions
): Promise<Exercise[] | ScoredExercise[]> {
  console.log('🚀 filterExercises called');
  
  const { 
    exercises: providedExercises, 
    businessId, 
    clientContext,
    includeScoring = false,
    scoringCriteria 
  } = options;
  
  // Get exercises: either provided, business-specific, or all
  let exercises: Exercise[];
  if (providedExercises) {
    exercises = providedExercises;
  } else if (businessId) {
    exercises = await fetchExercisesByBusiness(businessId);
  } else if (clientContext?.business_id) {
    exercises = await fetchExercisesByBusiness(clientContext.business_id);
  } else {
    exercises = await fetchAllExercises();
  }
  
  if (!exercises || exercises.length === 0) {
    throw new Error('No exercises available');
  }
  
  // Use provided context or create default
  const finalClientContext = clientContext || createDefaultClientContext();
  
  // Apply client-based filtering only
  const filteredExercises = applyClientFilters(exercises, finalClientContext);
  
  // Apply scoring if requested
  if (includeScoring && scoringCriteria) {
    console.log('🎯 Applying scoring to filtered exercises');
    const scoredExercises = await scoreAndSortExercises(filteredExercises, scoringCriteria);
    return scoredExercises;
  }
  
  return filteredExercises;
}