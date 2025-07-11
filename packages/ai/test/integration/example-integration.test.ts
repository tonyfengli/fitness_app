import { describe, it, expect, beforeEach } from 'vitest';
import { setServices } from '../../src/services/container';
import { MockLLM } from '../helpers/mockLLM';
import { MockExerciseRepository } from '../helpers/mockExerciseRepository';
import { TestLogger } from '../helpers/testLogger';
import { createTestExercise } from '../helpers/testData';

describe('Integration Test Example', () => {
  let mockLLM: MockLLM;
  let mockRepo: MockExerciseRepository;
  let logger: TestLogger;
  
  beforeEach(() => {
    // Create fresh mocks for each test
    logger = new TestLogger();
    mockLLM = new MockLLM({
      defaultResponse: JSON.stringify({
        exercises: {
          blockA: [{ name: 'Squat', sets: '3x5' }],
          blockB: [{ name: 'Press', sets: '3x8' }],
        }
      })
    });
    mockRepo = new MockExerciseRepository({
      exercises: [
        createTestExercise({ name: 'Squat', strengthLevel: 'high' }),
        createTestExercise({ name: 'Press', strengthLevel: 'moderate' }),
      ]
    });
    
    // Set up services with mocks
    setServices({
      logger,
      llm: mockLLM,
      exerciseRepository: mockRepo,
    });
  });
  
  it('should demonstrate how to test with mocked dependencies', async () => {
    // Your test would go here
    // For example, calling filterExercisesFromInput with the mocked services
    
    // Verify no console output
    expect(logger.logs).toHaveLength(0);
    
    // Verify you can check what was logged
    logger.log('Test message');
    expect(logger.hasLog('Test message')).toBe(true);
  });
});