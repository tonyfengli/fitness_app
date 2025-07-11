import { describe, it, expect, beforeEach } from 'vitest';
import { setServices } from '../../src/services/container';
import { MockLLM } from '../helpers/mockLLM';
import { MockExerciseRepository } from '../helpers/mockExerciseRepository';
import { TestLogger } from '../helpers/testLogger';

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
        { 
          id: '1', 
          name: 'Squat', 
          strengthLevel: 'high',
          complexityLevel: 'moderate',
          primaryMuscle: 'quads',
          secondaryMuscles: ['glutes'],
          loadedJoints: ['knees', 'hips'],
          movementPattern: 'squat',
          modality: 'strength',
          movementTags: null,
          functionTags: ['primary_strength'],
          fatigueProfile: 'high_systemic',
          equipment: ['barbell'],
          createdAt: new Date()
        },
        {
          id: '2',
          name: 'Press', 
          strengthLevel: 'moderate',
          complexityLevel: 'moderate', 
          primaryMuscle: 'shoulders',
          secondaryMuscles: ['triceps'],
          loadedJoints: ['shoulders', 'elbows'],
          movementPattern: 'vertical_push',
          modality: 'strength',
          movementTags: null,
          functionTags: ['primary_strength'],
          fatigueProfile: 'moderate_local',
          equipment: ['barbell'],
          createdAt: new Date()
        }
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