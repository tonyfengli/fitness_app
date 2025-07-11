import type { Exercise, ClientContext } from '../../src/types';
import type { ScoredExercise } from '../../src/types/scoredExercise';

/**
 * Factory functions for creating test data
 */

export function createTestExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: '1',
    name: 'Test Exercise',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    equipment: ['barbell'],
    movementPattern: 'squat',
    movementTags: ['bilateral'],
    functionTags: ['primary_strength'],
    complexityLevel: 'moderate',
    strengthLevel: 'moderate',
    fatigueProfile: 'moderate_local',
    loadedJoints: ['knees', 'hips'],
    modality: 'strength',
    ...overrides,
  };
}

export function createTestScoredExercise(
  overrides: Partial<ScoredExercise> = {}
): ScoredExercise {
  const exercise = createTestExercise(overrides);
  return {
    ...exercise,
    score: 5.0,
    ...overrides,
  };
}

export function createTestClientContext(
  overrides: Partial<ClientContext> = {}
): ClientContext {
  return {
    name: 'Test Client',
    business_id: 'test-business',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate',
    fitness_profile: {
      strength_capacity: 'moderate',
      skill_capacity: 'moderate',
    },
    muscle_target: [],
    muscle_lessen: [],
    avoid_joints: [],
    exercise_requests: {
      include: [],
      avoid: [],
    },
    ...overrides,
  };
}

/**
 * Common test scenarios
 */
export const testScenarios = {
  beginner: {
    clientContext: createTestClientContext({
      strength_capacity: 'low',
      skill_capacity: 'low',
      fitness_profile: {
        strength_capacity: 'low',
        skill_capacity: 'low',
      },
    }),
    expectedExercises: [
      createTestExercise({
        name: 'Bodyweight Squat',
        strengthLevel: 'low',
        complexityLevel: 'low',
      }),
      createTestExercise({
        name: 'Wall Sit',
        strengthLevel: 'very_low',
        complexityLevel: 'very_low',
      }),
    ],
  },
  
  advanced: {
    clientContext: createTestClientContext({
      strength_capacity: 'high',
      skill_capacity: 'high',
      fitness_profile: {
        strength_capacity: 'high',
        skill_capacity: 'high',
      },
    }),
    expectedExercises: [
      createTestExercise({
        name: 'Barbell Squat',
        strengthLevel: 'high',
        complexityLevel: 'moderate',
      }),
      createTestExercise({
        name: 'Front Squat',
        strengthLevel: 'high',
        complexityLevel: 'high',
      }),
    ],
  },
  
  kneeIssues: {
    clientContext: createTestClientContext({
      avoid_joints: ['knees'],
    }),
    expectedToExclude: ['knees'],
  },
};

/**
 * Mock data sets
 */
export const mockExerciseDatabase: Exercise[] = [
  // Beginner exercises
  createTestExercise({
    id: '1',
    name: 'Bodyweight Squat',
    strengthLevel: 'low',
    complexityLevel: 'low',
  }),
  createTestExercise({
    id: '2',
    name: 'Wall Sit',
    strengthLevel: 'very_low',
    complexityLevel: 'very_low',
  }),
  
  // Intermediate exercises
  createTestExercise({
    id: '3',
    name: 'Goblet Squat',
    strengthLevel: 'moderate',
    complexityLevel: 'moderate',
  }),
  
  // Advanced exercises
  createTestExercise({
    id: '4',
    name: 'Barbell Squat',
    strengthLevel: 'high',
    complexityLevel: 'moderate',
  }),
  createTestExercise({
    id: '5',
    name: 'Front Squat',
    strengthLevel: 'high',
    complexityLevel: 'high',
  }),
  
  // Exercises that don't load knees
  createTestExercise({
    id: '6',
    name: 'Hip Thrust',
    primaryMuscle: 'glutes',
    loadedJoints: ['hips'],
    strengthLevel: 'moderate',
    complexityLevel: 'low',
  }),
];