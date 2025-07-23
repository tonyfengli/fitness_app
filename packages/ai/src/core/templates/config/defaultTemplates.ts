/**
 * Default workout templates
 * These match the existing hardcoded structure for backward compatibility
 */

import type { WorkoutTemplate, DynamicBlockDefinition } from "../types/dynamicBlockTypes";
import { BLOCK_CONFIGS } from "../types/blockConfig";

/**
 * Convert existing block config to dynamic format
 */
function convertBlockConfig(
  id: string,
  config: typeof BLOCK_CONFIGS[keyof typeof BLOCK_CONFIGS]
): DynamicBlockDefinition {
  return {
    id,
    name: config.name,
    functionTags: config.functionTag === 'core_capacity' 
      ? ['core', 'capacity'] 
      : [config.functionTag],
    maxExercises: config.maxExercises,
    constraints: config.constraints,
    selectionStrategy: config.selectionStrategy,
    penaltyForReuse: config.penaltyForReuse
  };
}

/**
 * Default workout template - matches existing hardcoded structure
 */
export const DEFAULT_WORKOUT_TEMPLATE: WorkoutTemplate = {
  id: 'workout',
  name: 'Standard Workout',
  description: 'Traditional strength training workout with 4 blocks',
  blocks: [
    convertBlockConfig('A', BLOCK_CONFIGS.A),
    convertBlockConfig('B', BLOCK_CONFIGS.B),
    convertBlockConfig('C', BLOCK_CONFIGS.C),
    convertBlockConfig('D', BLOCK_CONFIGS.D)
  ],
  blockOrder: ['A', 'B', 'C', 'D']
};

/**
 * Full body workout template - adds muscle constraints
 */
export const FULL_BODY_TEMPLATE: WorkoutTemplate = {
  id: 'full_body',
  name: 'Full Body Workout',
  description: 'Balanced workout with muscle group constraints',
  blocks: [
    {
      ...convertBlockConfig('A', BLOCK_CONFIGS.A),
      constraints: {
        ...BLOCK_CONFIGS.A.constraints,
        muscles: {
          minLowerBody: 2,
          minUpperBody: 2
        }
      }
    },
    {
      ...convertBlockConfig('B', BLOCK_CONFIGS.B),
      constraints: {
        ...BLOCK_CONFIGS.B.constraints,
        muscles: {
          minLowerBody: 2,
          minUpperBody: 2
        }
      }
    },
    {
      ...convertBlockConfig('C', BLOCK_CONFIGS.C),
      constraints: {
        ...BLOCK_CONFIGS.C.constraints,
        muscles: {
          minLowerBody: 2,
          minUpperBody: 2
        }
      }
    },
    convertBlockConfig('D', BLOCK_CONFIGS.D) // Block D doesn't use muscle constraints
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
      functionTags: ['primary_strength'],
      maxExercises: 1,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge']
      }
    },
    {
      id: 'Round2',
      name: 'Round 2',
      functionTags: ['primary_strength'],  // Placeholder
      maxExercises: 3,  // Placeholder
      selectionStrategy: 'randomized'  // Placeholder
    },
    {
      id: 'Round3',
      name: 'Round 3',
      functionTags: ['secondary_strength'],  // Placeholder
      maxExercises: 4,  // Placeholder
      selectionStrategy: 'randomized'  // Placeholder
    },
    {
      id: 'FinalRound',
      name: 'Final Round',
      functionTags: ['capacity'],  // Placeholder
      maxExercises: 2,  // Placeholder
      selectionStrategy: 'randomized'  // Placeholder
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