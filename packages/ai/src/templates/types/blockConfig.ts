import type { ScoredExercise } from "../../types/scoredExercise";

// Movement pattern categories
export const MOVEMENT_PATTERNS = {
  SQUAT_HINGE: ['squat', 'hinge'] as const,
  PUSH: ['horizontal_push', 'vertical_push'] as const,
  PULL: ['horizontal_pull', 'vertical_pull'] as const,
} as const;

// Muscle group categories
export const MUSCLE_GROUPS = {
  LOWER_BODY: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors'] as const,
  UPPER_BODY: ['chest', 'lats', 'biceps', 'triceps', 'delts', 'shoulders', 'traps', 'upper_back'] as const,
} as const;

export interface MovementConstraints {
  requireSquatHinge: boolean;
  requirePush: boolean;
  requirePull: boolean;
  requireLunge: boolean;
}

export interface MuscleConstraints {
  minLowerBody: number;
  minUpperBody: number;
}

export interface BlockConstraints {
  movements: MovementConstraints;
  muscles?: MuscleConstraints;
  functionTags?: {
    minCore?: number;
    minCapacity?: number;
  };
}

export interface BlockConfig {
  name: string;
  functionTag: string;
  maxExercises: number;
  penaltyForReuse: number;
  constraints: BlockConstraints;
  selectionStrategy: 'deterministic' | 'randomized';
}

export interface PenalizedExercise extends ScoredExercise {
  originalScore?: number;
  appliedPenalty?: number;
}

// Block configurations
export const BLOCK_CONFIGS = {
  A: {
    name: 'Block A - Primary Strength',
    functionTag: 'primary_strength',
    maxExercises: 5,
    penaltyForReuse: 0,
    constraints: {
      movements: {
        requireSquatHinge: true,
        requirePush: true,
        requirePull: true,
        requireLunge: false,
      },
    },
    selectionStrategy: 'deterministic',
  },
  B: {
    name: 'Block B - Secondary Strength',
    functionTag: 'secondary_strength',
    maxExercises: 8,
    penaltyForReuse: 2.0,
    constraints: {
      movements: {
        requireSquatHinge: true,
        requirePush: true,
        requirePull: true,
        requireLunge: true,
      },
    },
    selectionStrategy: 'randomized',
  },
  C: {
    name: 'Block C - Accessory',
    functionTag: 'accessory',
    maxExercises: 8,
    penaltyForReuse: 2.0,
    constraints: {
      movements: {
        requireSquatHinge: true,
        requirePush: true,
        requirePull: true,
        requireLunge: false,
      },
    },
    selectionStrategy: 'randomized',
  },
  D: {
    name: 'Block D - Core & Capacity',
    functionTag: 'core_capacity',
    maxExercises: 6,
    penaltyForReuse: 0,
    constraints: {
      movements: {
        requireSquatHinge: false,
        requirePush: false,
        requirePull: false,
        requireLunge: false,
      },
      functionTags: {
        minCore: 1,
        minCapacity: 2,
      },
    },
    selectionStrategy: 'randomized',
  },
} as const satisfies Record<string, BlockConfig>;