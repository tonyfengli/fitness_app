/**
 * Interface for workout type specific prompt strategies
 */

import type { ClientContext } from "../../../../types/clientContext";
import type { ScoredExercise } from "../../../../types/scoredExercise";
import type { PreAssignedExercise } from "../../../../types/standardBlueprint";
import type { GroupScoredExercise } from "../../../../types/groupContext";

export interface PromptStrategyConfig {
  workoutType: string;
  intensity: 'low' | 'moderate' | 'high';
  totalExercisesNeeded: number;
  exercisesToSelect: number; // How many the LLM should select (2-5 based on intensity)
}

export interface PromptStrategy {
  /**
   * Build the constraints section of the prompt
   */
  buildConstraints(): string;
  
  /**
   * Build the workout flow section
   */
  buildWorkoutFlow(): string;
  
  /**
   * Build the selection priorities section
   */
  buildSelectionPriorities(): string;
  
  /**
   * Get the number of exercises LLM should select based on intensity
   */
  getExercisesToSelect(intensity: 'low' | 'moderate' | 'high'): number;
  
  /**
   * Format pre-assigned exercises for display
   */
  formatPreAssignedExercises(preAssigned: PreAssignedExercise[]): string;
  
  /**
   * Build guidance for shared exercise selection
   */
  buildSharedExerciseGuidance(sharedExercises: GroupScoredExercise[]): string;
}