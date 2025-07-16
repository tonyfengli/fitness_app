import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createAuthenticatedContext, createSelectMock } from './test-utils';
import { eq } from '@acme/db';
import { Workout, WorkoutExercise, exercises, BusinessExercise, user } from '@acme/db/schema';
import { sql } from '@acme/db';

describe('Workout Mutations Phase 2', () => {
  let caller: ReturnType<typeof createCaller>;
  
  const mockWorkout = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    trainingSessionId: '223e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    businessId: '123e4567-e89b-12d3-a456-426614174001',
    createdByTrainerId: 'trainer-123',
    completedAt: new Date(),
    notes: 'Test workout',
    workoutType: 'standard',
    totalPlannedSets: 20,
    llmOutput: { block1: [{ exercise: 'test', sets: 3 }] },
    templateConfig: { blocks: ['A', 'B'] },
    context: 'individual' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const mockExercises = [
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      workoutId: '123e4567-e89b-12d3-a456-426614174000',
      exerciseId: '323e4567-e89b-12d3-a456-426614174000',
      orderIndex: 1,
      setsCompleted: 3,
      groupName: 'Block A',
      notes: null,
      createdAt: new Date(),
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      workoutId: '123e4567-e89b-12d3-a456-426614174000',
      exerciseId: '323e4567-e89b-12d3-a456-426614174001',
      orderIndex: 2,
      setsCompleted: 3,
      groupName: 'Block A',
      notes: null,
      createdAt: new Date(),
    },
  ];
  
  const mockBusinessExercise = {
    id: '423e4567-e89b-12d3-a456-426614174000',
    name: 'Bench Press',
    primaryMuscle: 'chest',
    modality: 'strength',
    movementPattern: 'horizontal_push',
    equipment: ['barbell'],
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('replaceExercise', () => {
    it('should replace an exercise with another one', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      // Mock workout lookup
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      
      // Mock workout exercise lookup
      ctx.db.query.WorkoutExercise = {
        findFirst: vi.fn().mockResolvedValue(mockExercises[0]),
      };
      
      // Mock business exercise lookup
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ exercise: mockBusinessExercise }]),
            }),
          }),
        }),
      });
      
      // Mock update
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.replaceExercise({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
        newExerciseId: '423e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result).toEqual({ success: true });
      expect(ctx.db.update).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should throw if workout not found', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.replaceExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174999',
          workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
          newExerciseId: '423e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Workout not found');
    });
    
    it('should throw if workout exercise not found', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.replaceExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          workoutExerciseId: '223e4567-e89b-12d3-a456-426614174999',
          newExerciseId: '423e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Exercise not found in workout');
    });
    
    it('should throw if new exercise not available for business', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findFirst: vi.fn().mockResolvedValue(mockExercises[0]),
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.replaceExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
          newExerciseId: '423e4567-e89b-12d3-a456-426614174999',
        })
      ).rejects.toThrow('New exercise not found or not available for your business');
    });
  });
  
  describe('addExercise', () => {
    it('should add exercise at the end of a group', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ exercise: mockBusinessExercise }]),
            }),
          }),
        }),
      });
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.addExercise({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        exerciseId: '423e4567-e89b-12d3-a456-426614174000',
        groupName: 'Block A',
        position: 'end',
        sets: 4,
      });
      
      expect(result).toEqual({ success: true });
      expect(ctx.db.insert).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should add exercise at the beginning of a group', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ exercise: mockBusinessExercise }]),
            }),
          }),
        }),
      });
      
      // Mock transaction for beginning insertion
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.addExercise({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        exerciseId: '423e4567-e89b-12d3-a456-426614174000',
        groupName: 'Block A',
        position: 'beginning',
        sets: 4,
      });
      
      expect(result).toEqual({ success: true });
      expect(mockTx.update).toHaveBeenCalledWith(WorkoutExercise);
      expect(mockTx.insert).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should add exercise to empty workout', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue([]), // Empty workout
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ exercise: mockBusinessExercise }]),
            }),
          }),
        }),
      });
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.addExercise({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        exerciseId: '423e4567-e89b-12d3-a456-426614174000',
        groupName: 'Block A',
        position: 'end',
        sets: 3,
      });
      
      expect(result).toEqual({ success: true });
      expect(ctx.db.insert).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should throw if exercise not available for business', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.addExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          exerciseId: '423e4567-e89b-12d3-a456-426614174999',
          groupName: 'Block A',
          position: 'end',
          sets: 3,
        })
      ).rejects.toThrow('Exercise not found or not available for your business');
    });
  });
  
  describe('duplicateWorkout', () => {
    it('should duplicate workout for same user', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      const newWorkoutId = '523e4567-e89b-12d3-a456-426614174000';
      const mockTx = {
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((values) => ({
            returning: vi.fn().mockResolvedValue(
              table === Workout ? [{ ...mockWorkout, id: newWorkoutId, completedAt: null }] : undefined
            ),
          })),
        })),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.duplicateWorkout({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result).toEqual({ 
        success: true,
        workoutId: newWorkoutId
      });
      expect(mockTx.insert).toHaveBeenCalledTimes(2); // Once for workout, once for exercises
    });
    
    it('should duplicate workout for different user in same business', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-456',
          businessId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      const newWorkoutId = '523e4567-e89b-12d3-a456-426614174000';
      const mockTx = {
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((values) => ({
            returning: vi.fn().mockResolvedValue(
              table === Workout ? [{ ...mockWorkout, id: newWorkoutId, userId: 'user-456', completedAt: null }] : undefined
            ),
          })),
        })),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.duplicateWorkout({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        targetUserId: 'user-456',
        notes: 'Duplicated for client',
      });
      
      expect(result).toEqual({ 
        success: true,
        workoutId: newWorkoutId
      });
    });
    
    it('should throw if target user not in same business', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.user = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-456',
          businessId: '999e4567-e89b-12d3-a456-426614174999', // Different business
        }),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.duplicateWorkout({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          targetUserId: 'user-456',
        })
      ).rejects.toThrow('Target user not found in your business');
    });
    
    it('should handle workout with no exercises', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue([]), // No exercises
      };
      
      const newWorkoutId = '523e4567-e89b-12d3-a456-426614174000';
      const mockTx = {
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((values) => ({
            returning: vi.fn().mockResolvedValue(
              table === Workout ? [{ ...mockWorkout, id: newWorkoutId, completedAt: null }] : undefined
            ),
          })),
        })),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.duplicateWorkout({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result).toEqual({ 
        success: true,
        workoutId: newWorkoutId
      });
      expect(mockTx.insert).toHaveBeenCalledTimes(1); // Only workout, no exercises
    });
  });
});