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
  maxExercises: number;          // Maximum exercises the LLM can select
  candidateCount?: number;       // Number of candidate exercises to show (defaults to maxExercises)
  selectionStrategy: 'deterministic' | 'randomized';
  movementPatternFilter?: MovementPatternFilter;  // Filter exercises by movement patterns
  equipmentFilter?: EquipmentFilter;              // Filter exercises by equipment
}

/**
 * SMS configuration for templates
 */
export interface SMSConfig {
  checkInResponse: string;
  preferencePrompt: string;
  followUpPrompts: {
    sessionGoal?: string;
    muscleTargets?: string;
    intensity?: string;
    avoidance?: string; // Combined for joints/exercises to avoid
  };
  confirmationMessage: string;
  priorityFields: string[]; // Which fields to prioritize for this template
  showDeterministicSelections?: boolean; // Show deterministic exercise selections in check-in
  customCheckIn?: boolean; // Use completely custom check-in logic
}

/**
 * Linear flow step definition
 */
export interface LinearFlowStep {
  id: string;
  question: string;
  fieldToCollect: string;
  required: boolean;
  options?: string[]; // For multiple choice
  validation?: 'text' | 'number' | 'choice';
}

/**
 * Linear flow definition
 */
export interface LinearFlow {
  steps: LinearFlowStep[];
  confirmationMessage: string;
}

/**
 * State machine state definition
 */
export interface StateMachineState {
  id: string;
  prompt: string;
  handler?: 'preference' | 'disambiguation' | 'custom';
  nextStates: {
    [condition: string]: string; // condition -> next state
  };
  metadata?: Record<string, any>;
}

/**
 * State machine flow definition
 */
export interface StateMachineFlow {
  states: Record<string, StateMachineState>;
  initialState: string;
  finalStates: string[]; // Can have multiple final states
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
  smsConfig?: SMSConfig;         // Legacy SMS configuration
  smsFlowType?: 'legacy' | 'linear' | 'stateMachine'; // Flow type
  smsLinearFlow?: LinearFlow;    // Linear flow definition
  smsStateMachine?: StateMachineFlow; // State machine flow definition
}

// Export aliases for compatibility
export type BlockConfig = BlockDefinition;
export type DynamicBlockDefinition = BlockDefinition;