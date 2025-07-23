/**
 * Block and template types for workout organization
 */

import type { ScoredExercise } from "../../../types/scoredExercise";

/**
 * Movement pattern filter for blocks
 */
export interface MovementPatternFilter {
  include?: string[];  // Only allow these movement patterns
  exclude?: string[];  // Block these movement patterns
}

/**
 * Equipment filter for blocks
 */
export interface EquipmentFilter {
  required?: string[];  // Must have one of these equipment types
  forbidden?: string[]; // Cannot have any of these equipment types
}

/**
 * Defines a single block in a template
 */
export interface BlockDefinition {
  id: string;                    // "A", "B", "C", "D" or "Round1", "Round2", etc.
  name: string;                  // "Primary Strength" or "Circuit Round 1"
  functionTags: string[];        // ["primary_strength"] or ["circuit"]
  maxExercises: number;          // 5, 8, etc.
  selectionStrategy: 'deterministic' | 'randomized';
  movementPatternFilter?: MovementPatternFilter;  // Filter exercises by movement patterns
  equipmentFilter?: EquipmentFilter;              // Filter exercises by equipment
}

/**
 * Defines a complete workout template
 */
export interface WorkoutTemplate {
  id: string;                    // "workout", "full_body", "circuit_training"
  name: string;                  // "Standard Workout", "Circuit Training"
  description?: string;
  blocks: BlockDefinition[];
  blockOrder?: string[];         // Optional for backward compatibility
}

// Export aliases for compatibility
export type BlockConfig = BlockDefinition;
export type DynamicBlockDefinition = BlockDefinition;