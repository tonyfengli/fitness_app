import type { Exercise, ClientContext } from '../../../src/types';
import type { ExerciseRequests } from '../../../src/types/clientContext';
import { setServices } from '../../../src/services/container';
import { MockLLM } from '../../helpers/mockLLM';
import { MockExerciseRepository } from '../../helpers/mockExerciseRepository';
import { TestLogger } from '../../helpers/testLogger';
import { getExerciseDataHelper } from '../../helpers/exerciseDataHelper';

/**
 * Get test exercises from real database data
 * Uses ExerciseDataHelper to intelligently select representative exercises
 */
function getTestExercises(): Exercise[] {
  const helper = getExerciseDataHelper();
  // Get a diverse set of 30 exercises for standard testing
  return helper.getBasicTestSet(30);
}

// Lazy-loaded test exercises
let _testExercises: Exercise[] | null = null;
export function getTestExercisesLazy(): Exercise[] {
  if (!_testExercises) {
    _testExercises = getTestExercises();
  }
  return _testExercises;
}

// Export real test exercises from database
export const testExercises: Exercise[] = getTestExercisesLazy();

/**
 * Helper to create a test exercise with overrides, ensuring all required fields
 */
export function createTestExerciseWithOverrides(overrides: Partial<Exercise>): Exercise {
  const defaultExercise: Exercise = {
    id: 'default-id',
    name: 'Default Exercise',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    loadedJoints: [],
    movementPattern: 'horizontal_push',
    modality: 'strength',
    movementTags: [],
    functionTags: ['secondary_strength'],
    fatigueProfile: 'moderate_local',
    complexityLevel: 'moderate',
    equipment: [],
    strengthLevel: 'moderate',
    createdAt: new Date('2024-01-01')
  };
  
  return {
    ...defaultExercise,
    ...overrides
  } as Exercise;
}

/**
 * Helper to create a mock exercise repository with our test data
 */
export function createMockRepository(exercises?: Exercise[]) {
  // Use provided exercises or get test exercises from helper
  const exerciseData = exercises || getTestExercisesLazy();
  return new MockExerciseRepository({ exercises: exerciseData });
}

/**
 * Helper to create a default LLM mock that returns a valid workout
 */
export function createMockLLM(customResponse?: any) {
  const defaultResponse = {
    exercises: {
      blockA: [
        { name: 'Barbell Back Squat', sets: '3', reps: '5', notes: 'Primary strength focus' },
        { name: 'Barbell Bench Press', sets: '3', reps: '5', notes: 'Primary strength focus' }
      ],
      blockB: [
        { name: 'Dumbbell Lunge', sets: '3', reps: '8', notes: 'Secondary strength' },
        { name: 'Dumbbell Row', sets: '3', reps: '8', notes: 'Secondary strength' }
      ],
      blockC: [
        { name: 'Bicep Curl', sets: '3', reps: '12', notes: 'Accessory work' },
        { name: 'Face Pulls', sets: '3', reps: '15', notes: 'Accessory work' }
      ],
      blockD: [
        { name: 'Plank', sets: '3', reps: '30s', notes: 'Core stability' },
        { name: 'Farmers Carry', sets: '2', reps: '40m', notes: 'Capacity work' }
      ]
    }
  };
  
  return new MockLLM({
    defaultResponse: JSON.stringify(customResponse || defaultResponse)
  });
}

/**
 * Helper to create test client contexts for common scenarios
 */
export const testContexts = {
  // Default moderate user
  default: (): ClientContext => ({
    user_id: 'test-user-default',
    name: 'Test User',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate'
  }),
  
  // Beginner user
  beginner: (): ClientContext => ({
    user_id: 'test-user-beginner',
    name: 'Beginner User',
    strength_capacity: 'very_low',
    skill_capacity: 'very_low'
  }),
  
  // Advanced user
  advanced: (): ClientContext => ({
    user_id: 'test-user-advanced',
    name: 'Advanced User',
    strength_capacity: 'high',
    skill_capacity: 'high'
  }),
  
  // User with joint restrictions
  withJointRestrictions: (joints: string[]): ClientContext => ({
    user_id: 'test-user-restricted',
    name: 'Restricted User',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate',
    avoid_joints: joints
  }),
  
  // User with muscle targets
  withMuscleTargets: (target: string[], lessen: string[] = []): ClientContext => ({
    user_id: 'test-user-targeted',
    name: 'Targeted User',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate',
    muscle_target: target,
    muscle_lessen: lessen
  }),
  
  // User with exercise requests
  withExerciseRequests: (include: string[], avoid: string[] = []): ClientContext => ({
    user_id: 'test-user-specific',
    name: 'Specific User',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate',
    exercise_requests: { include, avoid }
  }),
  
  // Alias for withExerciseRequests
  withRequests: (include: string[], avoid: string[] = []): ClientContext => ({
    user_id: 'test-user-specific',
    name: 'Specific User',
    strength_capacity: 'moderate',
    skill_capacity: 'moderate',
    exercise_requests: { include, avoid }
  }),
  
  // User with specific strength level
  withStrength: (strength: 'very_low' | 'low' | 'moderate' | 'high'): ClientContext => ({
    user_id: 'test-user-strength',
    name: 'Strength User',
    strength_capacity: strength,
    skill_capacity: 'moderate'
  })
};

/**
 * Standard test setup that configures mocks
 */
export function setupMocks(
  llmOrExercises?: MockLLM | Exercise[],
  llmResponse?: any
) {
  let llm: MockLLM;
  let exercises: Exercise[];
  
  // Handle overloaded parameters
  if (llmOrExercises && 'invoke' in llmOrExercises) {
    // First param is MockLLM
    llm = llmOrExercises;
    exercises = getTestExercisesLazy();
  } else {
    // First param is exercises array (or undefined)
    exercises = (llmOrExercises as Exercise[]) || getTestExercisesLazy();
    llm = createMockLLM(llmResponse);
  }
  
  const logger = new TestLogger();
  const repository = createMockRepository(exercises);
  
  setServices({
    logger,
    llm,
    exerciseRepository: repository
  });
  
  return { logger, llm, repository };
}

/**
 * Helper to extract exercises by block from results
 */
export function getExercisesByBlock(exercises: any[]) {
  return {
    blockA: exercises.filter(ex => ex.isSelectedBlockA),
    blockB: exercises.filter(ex => ex.isSelectedBlockB),
    blockC: exercises.filter(ex => ex.isSelectedBlockC),
    blockD: exercises.filter(ex => ex.isSelectedBlockD)
  };
}

/**
 * Helper to create a test scenario from debug file data
 * This implements the "smart approach" - converting debug snapshots to test cases
 */
export function createTestFromDebugData(debugData: any) {
  const { filters, results } = debugData;
  
  const clientContext: ClientContext = {
    user_id: "test-user-123", // Default test user ID
    name: filters.clientName,
    strength_capacity: filters.strengthCapacity,
    skill_capacity: filters.skillCapacity,
    muscle_target: filters.muscleTarget,
    muscle_lessen: filters.muscleLessen,
    avoid_joints: filters.avoidJoints,
    exercise_requests: {
      include: filters.includeExercises,
      avoid: filters.avoidExercises
    }
  };
  
  const expectedCounts = {
    total: results.totalExercises,
    blockA: results.blockA.count,
    blockB: results.blockB.count,
    blockC: results.blockC.count,
    blockD: results.blockD.count
  };
  
  return { clientContext, expectedCounts };
}