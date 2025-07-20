import { describe, it, expect } from 'vitest';
import { 
  transformLLMOutputToDB, 
  validateExerciseLookup,
  type LLMWorkoutOutput 
} from '../../../src/workout-generation/transformers/workoutTransformer';
import type { exercises } from '@acme/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

type Exercise = InferSelectModel<typeof exercises>;

// Mock exercises for testing
const mockExercises: Exercise[] = [
  {
    id: 'ex1',
    name: 'Barbell Squat',
    exerciseType: 'squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    loadedJoints: ['knees', 'hips'],
    movementPattern: 'squat',
    modality: 'strength',
    movementTags: ['bilateral'],
    functionTags: ['primary_strength'],
    fatigueProfile: 'high_systemic',
    complexityLevel: 'moderate',
    equipment: ['barbell'],
    strengthLevel: 'moderate',
    createdAt: new Date()
  },
  {
    id: 'ex2',
    name: 'Bench Press',
    exerciseType: 'bench_press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    loadedJoints: ['shoulders', 'elbows'],
    movementPattern: 'horizontal_push',
    modality: 'strength',
    movementTags: ['bilateral'],
    functionTags: ['primary_strength'],
    fatigueProfile: 'moderate_local',
    complexityLevel: 'moderate',
    equipment: ['barbell', 'bench'],
    strengthLevel: 'moderate',
    createdAt: new Date()
  },
  {
    id: 'ex3',
    name: 'Romanian Deadlift',
    exerciseType: 'deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower_back'],
    loadedJoints: ['hips', 'lower_back'],
    movementPattern: 'hinge',
    modality: 'strength',
    movementTags: ['bilateral'],
    functionTags: ['primary_strength'],
    fatigueProfile: 'high_systemic',
    complexityLevel: 'moderate',
    equipment: ['barbell'],
    strengthLevel: 'moderate',
    createdAt: new Date()
  },
  {
    id: 'ex4',
    name: 'Pull-Ups',
    exerciseType: 'pull_up',
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'upper_back'],
    loadedJoints: ['shoulders', 'elbows'],
    movementPattern: 'vertical_pull',
    modality: 'strength',
    movementTags: ['bilateral'],
    functionTags: ['primary_strength'],
    fatigueProfile: 'moderate_local',
    complexityLevel: 'high',
    equipment: ['pull_up_bar'],
    strengthLevel: 'high',
    createdAt: new Date()
  },
  {
    id: 'ex5',
    name: 'Plank',
    exerciseType: 'plank',
    primaryMuscle: 'core',
    secondaryMuscles: ['shoulders'],
    loadedJoints: ['spine'],
    movementPattern: 'core',
    modality: 'core',
    movementTags: ['isometric_control', 'core_stability'],
    functionTags: ['core'],
    fatigueProfile: 'low_local',
    complexityLevel: 'low',
    equipment: [],
    strengthLevel: 'low',
    createdAt: new Date()
  },
  {
    id: 'ex6',
    name: 'Jump Squats',
    exerciseType: 'squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'calves'],
    loadedJoints: ['knees', 'hips', 'ankles'],
    movementPattern: 'squat',
    modality: 'power',
    movementTags: ['explosive', 'bilateral'],
    functionTags: ['capacity'],
    fatigueProfile: 'metabolic',
    complexityLevel: 'moderate',
    equipment: [],
    strengthLevel: 'moderate',
    createdAt: new Date()
  }
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
        ]
      };
      (llmOutput as any).reasoning = 'Balanced workout targeting all major muscle groups';

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
        round2: [
          { exercise: 'Jump Squats', sets: 1, reps: '45 seconds' },
          { exercise: 'Bench Press', sets: 1, reps: '45 seconds' },
          { exercise: 'Pull-Ups', sets: 1, reps: '45 seconds' },
          { exercise: 'Plank', sets: 1, reps: '45 seconds' }
        ],
        round3: [
          { exercise: 'Jump Squats', sets: 1, reps: '45 seconds' },
          { exercise: 'Bench Press', sets: 1, reps: '45 seconds' },
          { exercise: 'Pull-Ups', sets: 1, reps: '45 seconds' },
          { exercise: 'Plank', sets: 1, reps: '45 seconds' }
        ]
      };

      const result = await transformLLMOutputToDB(
        llmOutput,
        exerciseLookup,
        'circuit'
      );

      expect(result.workout.workoutType).toBe('circuit');
      expect(result.workout.totalPlannedSets).toBe(12); // 4 exercises * 3 rounds
      expect(result.workout.name).toContain('Circuit Training');

      expect(result.exercises).toHaveLength(12);
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

      expect(result.exercises[0]?.exerciseId).toBe('ex1');
      expect(result.exercises[1]?.exerciseId).toBe('ex2');
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