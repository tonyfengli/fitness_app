/**
 * Client-safe types and constants that can be imported in browser code
 * This file should NOT import any server-side dependencies
 */

export enum WorkoutType {
  FULL_BODY_WITH_FINISHER = 'full_body_with_finisher',
  FULL_BODY_WITHOUT_FINISHER = 'full_body_without_finisher',
  TARGETED_WITH_FINISHER = 'targeted_with_finisher',
  TARGETED_WITHOUT_FINISHER = 'targeted_without_finisher'
}

export interface BucketConstraints {
  movementPatterns: Record<string, { min: number; max: number }>;
  functionalRequirements: Record<string, number>;
  flexSlots: number;
  totalExercises: number;
}

// Since all 4 categories have the same constraints for now
const DEFAULT_CONSTRAINTS: Omit<BucketConstraints, 'functionalRequirements'> = {
  movementPatterns: {
    'horizontal_push': { min: 1, max: 1 },
    'horizontal_pull': { min: 1, max: 1 },
    'vertical_push': { min: 1, max: 1 },
    'vertical_pull': { min: 1, max: 1 },
    'squat': { min: 1, max: 1 },
    'hinge': { min: 1, max: 1 },
    'lunge': { min: 1, max: 1 },
    'core': { min: 2, max: 2 }
  },
  flexSlots: 3,
  totalExercises: 13 // Updated to match total: 1+1+1+1+1+1+1+2+2+3 = 13
};

export const BUCKET_CONFIGS: Record<WorkoutType, BucketConstraints> = {
  [WorkoutType.FULL_BODY_WITH_FINISHER]: {
    ...DEFAULT_CONSTRAINTS,
    functionalRequirements: {
      'capacity': 2
    }
  },
  
  [WorkoutType.FULL_BODY_WITHOUT_FINISHER]: {
    ...DEFAULT_CONSTRAINTS,
    functionalRequirements: {
      'strength': 2
    }
  },
  
  [WorkoutType.TARGETED_WITH_FINISHER]: {
    ...DEFAULT_CONSTRAINTS,
    functionalRequirements: {
      'capacity': 2
    }
  },
  
  [WorkoutType.TARGETED_WITHOUT_FINISHER]: {
    ...DEFAULT_CONSTRAINTS,
    functionalRequirements: {
      'strength': 2
    }
  }
};