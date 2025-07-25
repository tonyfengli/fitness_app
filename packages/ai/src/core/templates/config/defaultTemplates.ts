/**
 * Default workout templates
 * These match the existing hardcoded structure for backward compatibility
 */

import type { WorkoutTemplate, BlockDefinition } from "../types/dynamicBlockTypes";

/**
 * Default workout template - matches existing hardcoded structure
 */
export const DEFAULT_WORKOUT_TEMPLATE: WorkoutTemplate = {
  id: 'workout',
  name: 'Standard Workout',
  description: 'Traditional strength training workout with 4 blocks',
  blocks: [
    {
      id: 'A',
      name: 'Block A - Primary Strength',
      functionTags: ['primary_strength'],
      maxExercises: 5,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'B',
      name: 'Block B - Secondary Strength',
      functionTags: ['secondary_strength'],
      maxExercises: 8,
      selectionStrategy: 'randomized',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'C',
      name: 'Block C - Accessory',
      functionTags: ['accessory'],
      maxExercises: 8,
      selectionStrategy: 'randomized'
    },
    {
      id: 'D',
      name: 'Block D - Core & Capacity',
      functionTags: ['core', 'capacity'],
      maxExercises: 6,
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['A', 'B', 'C', 'D']
};

/**
 * Full body workout template
 */
export const FULL_BODY_TEMPLATE: WorkoutTemplate = {
  id: 'full_body',
  name: 'Full Body Workout',
  description: 'Balanced full body workout',
  blocks: [
    {
      id: 'A',
      name: 'Block A - Primary Strength',
      functionTags: ['primary_strength'],
      maxExercises: 5,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'B',
      name: 'Block B - Secondary Strength',
      functionTags: ['secondary_strength'],
      maxExercises: 8,
      selectionStrategy: 'randomized',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'C',
      name: 'Block C - Accessory',
      functionTags: ['accessory'],
      maxExercises: 8,
      selectionStrategy: 'randomized'
    },
    {
      id: 'D',
      name: 'Block D - Core & Capacity',
      functionTags: ['core', 'capacity'],
      maxExercises: 6,
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['A', 'B', 'C', 'D']
};

/**
 * Circuit training template - placeholder
 * 6 rounds, nothing else
 */
export const CIRCUIT_TRAINING_TEMPLATE: WorkoutTemplate = {
  id: 'circuit_training',
  name: 'Circuit Training',
  description: '6-round circuit workout',
  blocks: Array.from({ length: 6 }, (_, i) => ({
    id: `Round${i + 1}`,
    name: `Round ${i + 1}`,
    functionTags: ['primary_strength'],
    maxExercises: 1,
    selectionStrategy: 'randomized' as const
  })),
  blockOrder: Array.from({ length: 6 }, (_, i) => `Round${i + 1}`)
};

/**
 * Full Body BMF (Bold Movement Fitness) template
 * 4 sequential rounds with movement pattern filtering
 */
export const FULL_BODY_BMF_TEMPLATE: WorkoutTemplate = {
  id: 'full_body_bmf',
  name: 'Full Body BMF',
  description: 'Bold Movement Fitness full body workout with 4 sequential rounds',
  blocks: [
    {
      id: 'Round1',
      name: 'Round 1',
      functionTags: ['primary_strength', 'secondary_strength'],
      maxExercises: 1,
      candidateCount: 1,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge']
      }
    },
    {
      id: 'Round2',
      name: 'Round 2',
      functionTags: [],  // No function tag filters
      maxExercises: 1,  // LLM can select max 1 exercise
      candidateCount: 1,  // Show only top candidate
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['vertical_pull', 'horizontal_pull']  // Only pulling movements
      }
    },
    {
      id: 'Round3',
      name: 'Round 3',
      functionTags: [],  // No function tag filter - show everything
      maxExercises: 2,  // LLM can select max 2 exercises
      candidateCount: 8,  // Show 8 candidates
      selectionStrategy: 'randomized'
      // No movement pattern filter - show all exercises
    },
    {
      id: 'FinalRound',
      name: 'Final Round',
      functionTags: ['core', 'capacity'],  // Core or capacity exercises
      maxExercises: 2,  // LLM can select max 2 exercises
      candidateCount: 8,  // Show 8 candidates
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['Round1', 'Round2', 'Round3', 'FinalRound']
};

/**
 * Template registry
 */
export const WORKOUT_TEMPLATES: Record<string, WorkoutTemplate> = {
  'workout': DEFAULT_WORKOUT_TEMPLATE,
  'full_body': FULL_BODY_TEMPLATE,
  'circuit_training': CIRCUIT_TRAINING_TEMPLATE,
  'full_body_bmf': FULL_BODY_BMF_TEMPLATE
};

/**
 * Get template by ID
 */
export function getWorkoutTemplate(templateId: string): WorkoutTemplate | null {
  return WORKOUT_TEMPLATES[templateId] || null;
}

/**
 * Get default template
 */
export function getDefaultWorkoutTemplate(): WorkoutTemplate {
  return DEFAULT_WORKOUT_TEMPLATE;
}