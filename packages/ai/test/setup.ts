import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setServices, resetServices } from '../src/services/container';
import { TestLogger } from './helpers/testLogger';
import { resetInterpretationLLM } from '../src/workout-interpretation/interpretExercisesNode';

// Global test logger
export const testLogger = new TestLogger();

// Global test setup
beforeAll(() => {
  // Set up test services
  setServices({
    logger: testLogger,
    // LLM and repository will be mocked per test as needed
  });
});

afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear test logger
  testLogger.clear();
  
  // Reset any global state
  resetServices();
  resetInterpretationLLM();
  
  // Reset exercise repository to default
  // This prevents test pollution between tests
});

afterAll(() => {
  // Final cleanup
});

// Add custom matchers or global test utilities here
declare global {
  namespace Vi {
    interface Assertion<T> {
      toContainExerciseWithComplexity(complexity: string): T;
      toContainJointLoad(joint: string): T;
    }
  }
}

// Example custom matchers
expect.extend({
  toContainExerciseWithComplexity(received: any[], complexity: string) {
    const hasComplexity = received.some(
      exercise => exercise.complexityLevel === complexity
    );
    
    return {
      pass: hasComplexity,
      message: () =>
        hasComplexity
          ? `Expected exercises not to contain complexity level "${complexity}"`
          : `Expected exercises to contain at least one with complexity level "${complexity}"`,
    };
  },
  
  toContainJointLoad(received: any[], joint: string) {
    const hasJoint = received.some(
      exercise => exercise.loadedJoints?.includes(joint)
    );
    
    return {
      pass: hasJoint,
      message: () =>
        hasJoint
          ? `Expected exercises not to load joint "${joint}"`
          : `Expected exercises to contain at least one that loads joint "${joint}"`,
    };
  },
});