import type { Exercise, ClientContext } from "../../types";
import type { ScoredExercise, ScoringCriteria } from "../../types/scoredExercise";
import { applyClientFilters } from "./applyClientFilters";
import { scoreAndSortExercises } from "../scoring/scoreExercises";
import { fetchAllExercises, fetchExercisesByBusiness } from "../../utils/fetchExercises";
import { createDefaultClientContext } from "../../types/clientContext";

export interface DirectFilterOptions {
  exercises?: Exercise[]; // Optional: provide exercises directly
  businessId?: string; // Optional: fetch business-specific exercises
  clientContext?: ClientContext;
  includeScoring?: boolean; // Whether to apply scoring and sorting
  scoringCriteria?: ScoringCriteria; // Scoring criteria for Phase 2
  enhancedMode?: boolean; // Enable enhanced debug mode
  customFilterFunction?: (exercises: Exercise[], criteria: ClientContext) => Exercise[]; // Custom filter function
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
  const startTime = performance.now();
  // Removed filterExercises call log
  
  const { 
    exercises: providedExercises, 
    businessId, 
    clientContext,
    includeScoring = false,
    scoringCriteria,
    enhancedMode = false,
    customFilterFunction
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
    // No exercises available to filter
    return [];
  }
  
  // Use provided context or create default
  const finalClientContext = clientContext || createDefaultClientContext('default-user');
  
  // Apply client-based filtering only
  const phase1StartTime = performance.now();
  const filteredExercises = customFilterFunction 
    ? customFilterFunction(exercises, finalClientContext)
    : applyClientFilters(exercises, finalClientContext);
  const phase1EndTime = performance.now();
  // Removed phase 1 timing log
  
  // Apply scoring if requested
  if (includeScoring && scoringCriteria) {
    // Applying scoring to filtered exercises
    const scoringStartTime = performance.now();
    const scoredExercises = await scoreAndSortExercises(filteredExercises, scoringCriteria);
    const scoringEndTime = performance.now();
    // Removed phase 2 timing log
    
    const totalTime = performance.now() - startTime;
    // Removed total timing log
    return scoredExercises;
  }
  
  const totalTime = performance.now() - startTime;
  // Removed total timing log (phase 1 only)
  return filteredExercises;
}