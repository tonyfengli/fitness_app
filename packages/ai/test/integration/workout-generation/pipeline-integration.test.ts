import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runWorkoutPipeline, prepareWorkoutForAPI } from '../../../src/workout-generation/integration/workoutPipeline';
import { setInterpretationLLM } from '../../../src/workout-generation/generateWorkoutFromExercises';
import type { ClientContext } from '../../../src/types/clientContext';
import type { Exercise } from '@acme/db/schema';
import type { ScoredExercise } from '../../../src/types/scoredExercise';

describe('Complete Workout Pipeline Integration', () => {
  let mockLLM: any;
  
  // Mock exercises database
  const mockExercises: Exercise[] = [
    { id: 'ex1', name: 'Barbell Squat', type: 'strength' },
    { id: 'ex2', name: 'Bench Press', type: 'strength' },
    { id: 'ex3', name: 'Romanian Deadlift', type: 'strength' },
    { id: 'ex4', name: 'Pull-Ups', type: 'strength' },
    { id: 'ex5', name: 'Plank', type: 'core' },
    { id: 'ex6', name: 'Jump Squats', type: 'power' },
    { id: 'ex7', name: 'Push-Ups', type: 'strength' },
    { id: 'ex8', name: 'Mountain Climbers', type: 'cardio' }
  ];
  
  const exerciseLookup = new Map(mockExercises.map(ex => [ex.id, ex]));
  
  beforeEach(() => {
    // Reset mock LLM
    mockLLM = {
      invoke: vi.fn()
    };
    setInterpretationLLM(mockLLM);
  });
  
  describe('Standard Workout Pipeline', () => {
    it('should complete full pipeline from exercise selection to DB format', async () => {
      // Setup client context
      const clientContext: ClientContext = {
        user_id: 'test-user-123',
        name: 'John Doe',
        strength_capacity: 'moderate',
        skill_capacity: 'moderate',
        templateType: 'standard',
        intensity: 'moderate',
        primary_goal: 'strength'
      };
      
      // Setup selected exercises
      const selectedExercises = {
        blockA: [
          { id: 'ex1', name: 'Barbell Squat', score: 9 }
        ],
        blockB: [
          { id: 'ex2', name: 'Bench Press', score: 8 },
          { id: 'ex3', name: 'Romanian Deadlift', score: 8 }
        ],
        blockC: [
          { id: 'ex4', name: 'Pull-Ups', score: 7 },
          { id: 'ex7', name: 'Push-Ups', score: 6 }
        ],
        blockD: [
          { id: 'ex5', name: 'Plank', score: 7 }
        ]
      };
      
      // Mock LLM response
      mockLLM.invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          blockA: [
            { exercise: 'Barbell Squat', sets: 4, reps: '8-10', rest: '3 min' }
          ],
          blockB: [
            { exercise: 'Bench Press', sets: 3, reps: '10-12', rest: '2 min' },
            { exercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '2 min' }
          ],
          blockC: [
            { exercise: 'Pull-Ups', sets: 3, reps: '8-12', rest: '90s' },
            { exercise: 'Push-Ups', sets: 3, reps: '12-15', rest: '60s' }
          ],
          blockD: [
            { exercise: 'Plank', sets: 3, reps: '30-60s', rest: '1 min' }
          ],
          reasoning: 'Balanced workout targeting all major muscle groups with progressive overload'
        })
      });
      
      // Run pipeline
      const result = await runWorkoutPipeline({
        clientContext,
        exercises: selectedExercises,
        exerciseLookup,
        workoutName: 'Monday Strength Session',
        workoutDescription: 'Full body strength workout'
      });
      
      // Verify success
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      
      // Verify LLM output
      expect(result.llmOutput).toBeDefined();
      expect(result.llmOutput?.blockA).toHaveLength(1);
      expect(result.llmOutput?.blockB).toHaveLength(2);
      
      // Verify DB format
      expect(result.dbFormat).toBeDefined();
      expect(result.dbFormat?.workout.name).toBe('Monday Strength Session');
      expect(result.dbFormat?.workout.workoutType).toBe('standard');
      expect(result.dbFormat?.workout.totalPlannedSets).toBe(19); // 4+3+3+3+3+3
      
      // Verify exercises transformation
      expect(result.dbFormat?.exercises).toHaveLength(6);
      expect(result.dbFormat?.exercises[0]).toMatchObject({
        exerciseId: 'ex1',
        exerciseName: 'Barbell Squat',
        sets: 4,
        groupName: 'Block A',
        orderIndex: 0
      });
      
      // Verify validation
      expect(result.validation?.valid).toBe(true);
      expect(result.validation?.missingExercises).toHaveLength(0);
      
      // Verify timing data
      expect(result.timing).toBeDefined();
      expect(result.timing?.totalPipeline).toBeGreaterThan(0);
    });
    
    it('should handle missing exercises gracefully', async () => {
      const clientContext: ClientContext = {
        user_id: 'test-user-123',
        name: 'John Doe',
        strength_capacity: 'moderate',
        skill_capacity: 'moderate',
        templateType: 'standard'
      };
      
      // Mock LLM response with unknown exercise
      mockLLM.invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          blockA: [
            { exercise: 'Unknown Exercise XYZ', sets: 4, reps: '8-10' }
          ],
          blockB: [
            { exercise: 'Bench Press', sets: 3, reps: '10-12' }
          ]
        })
      });
      
      const result = await runWorkoutPipeline({
        clientContext,
        exercises: { blockA: [], blockB: [] },
        exerciseLookup
      });
      
      expect(result.success).toBe(true);
      expect(result.validation?.valid).toBe(false);
      expect(result.validation?.missingExercises).toContain('Unknown Exercise XYZ');
      expect(result.validation?.warnings).toHaveLength(1);
      
      // Should still transform known exercises
      expect(result.dbFormat?.exercises).toHaveLength(2);
      expect(result.dbFormat?.exercises[0].exerciseId).toBe('unknown');
      expect(result.dbFormat?.exercises[1].exerciseId).toBe('ex2');
    });
  });
  
  describe('Circuit Workout Pipeline', () => {
    it('should handle circuit template correctly', async () => {
      const clientContext: ClientContext = {
        user_id: 'test-user-456',
        name: 'Jane Smith',
        strength_capacity: 'moderate',
        skill_capacity: 'high',
        templateType: 'circuit',
        intensity: 'high'
      };
      
      const selectedExercises = {
        blockA: [
          { id: 'ex6', name: 'Jump Squats', score: 9 },
          { id: 'ex7', name: 'Push-Ups', score: 8 },
          { id: 'ex8', name: 'Mountain Climbers', score: 8 },
          { id: 'ex5', name: 'Plank', score: 7 }
        ]
      };
      
      // Mock circuit LLM response
      mockLLM.invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          round1: [
            { exercise: 'Jump Squats', sets: 1, reps: '45 seconds' },
            { exercise: 'Push-Ups', sets: 1, reps: '45 seconds' },
            { exercise: 'Mountain Climbers', sets: 1, reps: '45 seconds' },
            { exercise: 'Plank', sets: 1, reps: '45 seconds' }
          ],
          round2: 'Same as Round 1',
          round3: 'Same as Round 1',
          reasoning: 'High-intensity circuit for cardiovascular and muscular endurance'
        })
      });
      
      const result = await runWorkoutPipeline({
        clientContext,
        exercises: selectedExercises,
        exerciseLookup,
        workoutName: 'HIIT Circuit'
      });
      
      expect(result.success).toBe(true);
      expect(result.dbFormat?.workout.workoutType).toBe('circuit');
      expect(result.dbFormat?.workout.name).toBe('HIIT Circuit');
      
      // Circuit should have Round naming
      expect(result.dbFormat?.exercises[0].groupName).toBe('Round 1');
      expect(result.dbFormat?.exercises).toHaveLength(4);
      
      // Template config should be circuit-specific
      expect(result.dbFormat?.workout.templateConfig).toMatchObject({
        rounds: 3,
        workRestRatio: '45s/15s',
        format: 'time-based'
      });
    });
  });
  
  describe('API Preparation', () => {
    it('should prepare data for saveWorkout API endpoint', async () => {
      const clientContext: ClientContext = {
        user_id: 'test-user-789',
        name: 'Bob Johnson',
        strength_capacity: 'high',
        skill_capacity: 'moderate',
        templateType: 'standard'
      };
      
      mockLLM.invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          blockA: [{ exercise: 'Barbell Squat', sets: 4 }]
        })
      });
      
      const pipelineResult = await runWorkoutPipeline({
        clientContext,
        exercises: { blockA: [{ id: 'ex1', name: 'Barbell Squat', score: 9 }] },
        exerciseLookup
      });
      
      const apiData = prepareWorkoutForAPI(
        pipelineResult,
        'session-123',
        'test-user-789'
      );
      
      expect(apiData).toMatchObject({
        trainingSessionId: 'session-123',
        userId: 'test-user-789',
        workoutType: 'standard',
        llmOutput: pipelineResult.llmOutput
      });
      
      // This data structure should match what the saveWorkout endpoint expects
      expect(apiData.workoutName).toBeDefined();
      expect(apiData.llmOutput).toBeDefined();
    });
    
    it('should throw error when pipeline fails', () => {
      const failedPipelineResult = {
        success: false,
        error: 'Pipeline failed'
      };
      
      expect(() => {
        prepareWorkoutForAPI(failedPipelineResult, 'session-123', 'user-123');
      }).toThrow('Pipeline output is not valid for API submission');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      const clientContext: ClientContext = {
        user_id: 'test-user',
        name: 'Test User',
        strength_capacity: 'moderate',
        skill_capacity: 'moderate'
      };
      
      mockLLM.invoke.mockRejectedValueOnce(new Error('LLM service unavailable'));
      
      const result = await runWorkoutPipeline({
        clientContext,
        exercises: { blockA: [] },
        exerciseLookup
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM service unavailable');
    });
    
    it('should handle malformed LLM responses', async () => {
      const clientContext: ClientContext = {
        user_id: 'test-user',
        name: 'Test User',
        strength_capacity: 'moderate',
        skill_capacity: 'moderate'
      };
      
      mockLLM.invoke.mockResolvedValueOnce({
        content: 'Not valid JSON'
      });
      
      const result = await runWorkoutPipeline({
        clientContext,
        exercises: { blockA: [] },
        exerciseLookup
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});