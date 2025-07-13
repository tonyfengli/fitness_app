import { describe, it, expect } from 'vitest';
import { 
  transformLLMOutputToDB, 
  validateExerciseLookup,
  type LLMWorkoutOutput 
} from '../../../src/workout-generation/transformers/workoutTransformer';
import type { Exercise } from '@acme/db/schema';

// Mock exercises for testing
const mockExercises: Exercise[] = [
  { id: 'ex1', name: 'Barbell Squat', type: 'strength' },
  { id: 'ex2', name: 'Bench Press', type: 'strength' },
  { id: 'ex3', name: 'Romanian Deadlift', type: 'strength' },
  { id: 'ex4', name: 'Pull-Ups', type: 'strength' },
  { id: 'ex5', name: 'Plank', type: 'core' },
  { id: 'ex6', name: 'Jump Squats', type: 'power' }
];

const exerciseLookup = new Map(mockExercises.map(ex => [ex.id, ex]));

describe('workoutTransformer', () => {
  describe('transformLLMOutputToDB', () => {
    it('should transform standard workout format correctly', async () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [
          { exercise: 'Barbell Squat', sets: 4, reps: '8-10', rest: '3 min' }
        ],
        blockB: [
          { exercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: '2 min' },
          { exercise: 'Bench Press', sets: 3, reps: '10-12', rest: '2 min' }
        ],
        blockC: [
          { exercise: 'Pull-Ups', sets: 3, reps: '8-12', rest: '90s' }
        ],
        blockD: [
          { exercise: 'Plank', sets: 3, reps: '30-60s', rest: '1 min' }
        ],
        reasoning: 'Balanced workout targeting all major muscle groups'
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'standard',
        'Test Workout',
        'A test workout description'
      );

      expect(result.workout.name).toBe('Test Workout');
      expect(result.workout.workoutType).toBe('standard');
      expect(result.workout.totalPlannedSets).toBe(16); // 4 + 3 + 3 + 3 + 3
      expect(result.workout.llmOutput).toEqual(llmOutput);

      expect(result.exercises).toHaveLength(5);
      expect(result.exercises[0]).toMatchObject({
        exerciseId: 'ex1',
        exerciseName: 'Barbell Squat',
        sets: 4,
        reps: '8-10',
        restPeriod: '3 min',
        orderIndex: 0,
        groupName: 'Block A'
      });

      expect(result.exercises[3]).toMatchObject({
        exerciseId: 'ex4',
        groupName: 'Block C'
      });
    });

    it('should transform circuit workout format correctly', async () => {
      const llmOutput: LLMWorkoutOutput = {
        round1: [
          { exercise: 'Jump Squats', sets: 1, reps: '45 seconds' },
          { exercise: 'Bench Press', sets: 1, reps: '45 seconds' },
          { exercise: 'Pull-Ups', sets: 1, reps: '45 seconds' },
          { exercise: 'Plank', sets: 1, reps: '45 seconds' }
        ],
        round2: 'Same as Round 1',
        round3: 'Same as Round 1'
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'circuit'
      );

      expect(result.workout.workoutType).toBe('circuit');
      expect(result.workout.totalPlannedSets).toBe(4); // Only counts actual exercise arrays
      expect(result.workout.name).toContain('Circuit Training');

      expect(result.exercises).toHaveLength(4);
      expect(result.exercises[0]).toMatchObject({
        exerciseId: 'ex6',
        exerciseName: 'Jump Squats',
        groupName: 'Round 1'
      });
    });

    it('should handle case-insensitive exercise name matching', async () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [
          { exercise: 'barbell squat', sets: 4 }, // lowercase
          { exercise: 'BENCH PRESS', sets: 3 }    // uppercase
        ]
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'standard'
      );

      expect(result.exercises[0].exerciseId).toBe('ex1');
      expect(result.exercises[1].exerciseId).toBe('ex2');
    });

    it('should handle unknown exercises gracefully', async () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [
          { exercise: 'Unknown Exercise', sets: 3 }
        ]
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'standard'
      );

      expect(result.exercises[0]).toMatchObject({
        exerciseId: 'unknown',
        exerciseName: 'Unknown Exercise',
        sets: 3
      });
    });

    it('should generate appropriate default workout names', async () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [{ exercise: 'Barbell Squat', sets: 4 }]
      };

      const standardResult = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'standard'
      );
      expect(standardResult.workout.name).toContain('Strength Training');

      const circuitResult = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'circuit'
      );
      expect(circuitResult.workout.name).toContain('Circuit Training');

      const fullBodyResult = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'full_body'
      );
      expect(fullBodyResult.workout.name).toContain('Full Body Workout');
    });

    it('should include template configuration', async () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [{ exercise: 'Barbell Squat', sets: 4 }]
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'circuit'
      );

      expect(result.workout.templateConfig).toEqual({
        rounds: 3,
        workRestRatio: '45s/15s',
        format: 'time-based'
      });
    });
  });

  describe('validateExerciseLookup', () => {
    it('should validate all exercises are found', () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [
          { exercise: 'Barbell Squat', sets: 4 },
          { exercise: 'Bench Press', sets: 3 }
        ]
      };

      const result = validateExerciseLookup(llmOutput, exerciseLookup);

      expect(result.valid).toBe(true);
      expect(result.missingExercises).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should identify missing exercises', () => {
      const llmOutput: LLMWorkoutOutput = {
        blockA: [
          { exercise: 'Barbell Squat', sets: 4 },
          { exercise: 'Unknown Exercise 1', sets: 3 }
        ],
        blockB: [
          { exercise: 'Unknown Exercise 2', sets: 3 }
        ]
      };

      const result = validateExerciseLookup(llmOutput, exerciseLookup);

      expect(result.valid).toBe(false);
      expect(result.missingExercises).toEqual(['Unknown Exercise 1', 'Unknown Exercise 2']);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('Unknown Exercise 1');
      expect(result.warnings[0]).toContain('blockA');
    });
  });
});