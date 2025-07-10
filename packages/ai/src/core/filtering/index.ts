/**
 * Consolidated Exercise Filtering Module
 * 
 * This module provides a unified API for filtering exercises based on various criteria.
 * These are deterministic operations that don't require LangGraph
 */

// Core types
export type { 
  StrengthLevel, 
  SkillLevel, 
  IntensityLevel, 
  FilterCriteria 
} from "./types";

// Main filtering function
export { filterExercises } from "./filterExercises";
export type { DirectFilterOptions } from "./filterExercises";

// Client filtering
export { applyClientFilters, ExerciseFilterError } from "./applyClientFilters";

// Low-level filtering functions
export {
  filterByStrength,
  filterBySkill,
  filterByIntensity,
  filterByInclude,
  filterByExclude,
  filterByAvoidJoints,
  applyAllFilters,
  getAvailableFilterValues
} from "./filterFunctions";

// Scoring
export { scoreAndSortExercises } from "../scoring/scoreExercises";
export { SCORING_CONFIG } from "../scoring/scoringConfig";
export type { ScoredExercise, ScoringCriteria, ScoreBreakdown } from "../../types/scoredExercise";