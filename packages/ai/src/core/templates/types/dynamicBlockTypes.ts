/**
 * Dynamic block system types
 * These types support flexible block configurations while maintaining backward compatibility
 */

import type { ScoredExercise } from "../../../types/scoredExercise";
import type { BlockConstraints } from "./blockConfig";

/**
 * Movement pattern filter for blocks
 */
export interface MovementPatternFilter {
  include?: string[];  // Only allow these movement patterns
  exclude?: string[];  // Block these movement patterns
}

/**
 * Defines a single block in a template
 */
export interface DynamicBlockDefinition {
  id: string;                    // "A", "B", "C", "D" or "Round1", "Round2", etc.
  name: string;                  // "Primary Strength" or "Circuit Round 1"
  functionTags: string[];        // ["primary_strength"] or ["circuit"]
  maxExercises: number;          // 5, 8, etc.
  constraints?: BlockConstraints;
  selectionStrategy: 'deterministic' | 'randomized';
  penaltyForReuse?: number;      // Penalty if exercise was selected in previous block
  movementPatternFilter?: MovementPatternFilter;  // Filter exercises by movement patterns
}

/**
 * Defines a complete workout template
 */
export interface WorkoutTemplate {
  id: string;                    // "workout", "full_body", "circuit_training"
  name: string;                  // "Standard Workout", "Circuit Training"
  description?: string;
  blocks: DynamicBlockDefinition[];
  blockOrder: string[];          // ["A", "B", "C", "D"] or ["Round1", "Round2", ...]
}

/**
 * Dynamic exercise organization structure
 */
export interface DynamicOrganizedExercises {
  blocks: Record<string, ScoredExercise[]>;
  metadata: {
    template: WorkoutTemplate;
    timestamp: string;
    totalExercises: number;
  };
}

// Export alias for compatibility
export type BlockConfig = DynamicBlockDefinition;

/**
 * Maps between legacy and dynamic formats
 */
export interface BlockAdapter {
  toDynamic(legacy: any): DynamicOrganizedExercises;
  toLegacy(dynamic: DynamicOrganizedExercises): any;
}