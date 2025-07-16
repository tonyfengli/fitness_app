import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createAuthenticatedContext, createSelectMock } from './test-utils';
import { eq } from '@acme/db';
import { Workout, WorkoutExercise } from '@acme/db/schema';

describe('Workout Mutations', () => {
  let caller: ReturnType<typeof createCaller>;
  
  const mockWorkout = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    trainingSessionId: null,
    userId: 'user-123',
    businessId: '123e4567-e89b-12d3-a456-426614174001',
    createdByTrainerId: 'trainer-123',
    completedAt: new Date(),
    notes: 'Test workout',
    workoutType: 'standard',
    totalPlannedSets: 20,
    llmOutput: {},
    templateConfig: {},
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
      createdAt: new Date(),
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      workoutId: '123e4567-e89b-12d3-a456-426614174000',
      exerciseId: '323e4567-e89b-12d3-a456-426614174001',
      orderIndex: 2,
      setsCompleted: 3,
      groupName: 'Block A',
      createdAt: new Date(),
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174002',
      workoutId: '123e4567-e89b-12d3-a456-426614174000',
      exerciseId: '323e4567-e89b-12d3-a456-426614174002',
      orderIndex: 3,
      setsCompleted: 3,
      groupName: 'Block B',
      createdAt: new Date(),
    },
  ];
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('deleteExercise', () => {
    it('should delete an exercise and reorder remaining ones in the same group', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      // Mock workout lookup
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      
      // Mock exercise lookup
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      // Mock transaction
      const mockTx = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.deleteExercise({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result).toEqual({ success: true });
      expect(mockTx.delete).toHaveBeenCalled();
      // Should update we-2 to have orderIndex 1
      expect(mockTx.update).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should throw if workout not found', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.deleteExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174999',
          workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Workout not found');
    });
    
    it('should throw if exercise not found in workout', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.deleteExercise({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          workoutExerciseId: '323e4567-e89b-12d3-a456-426614174999',
        })
      ).rejects.toThrow('Exercise not found in workout');
    });
  });
  
  describe('updateExerciseOrder', () => {
    it('should move exercise up within the same block', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      ctx.db.transaction = vi.fn().mockImplementation(async (fn) => fn(mockTx));
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.updateExerciseOrder({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        workoutExerciseId: '223e4567-e89b-12d3-a456-426614174001',
        direction: 'up',
      });
      
      expect(result).toEqual({ success: true });
      expect(mockTx.update).toHaveBeenCalledTimes(2);
    });
    
    it('should throw when trying to move beyond block boundaries', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.updateExerciseOrder({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          workoutExerciseId: '223e4567-e89b-12d3-a456-426614174000',
          direction: 'up',
        })
      ).rejects.toThrow('Cannot move exercise up - already at boundary');
    });
  });
  
  describe('deleteBlock', () => {
    it('should delete all exercises in a block', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue(mockExercises),
      };
      
      ctx.db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.deleteBlock({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
        groupName: 'Block A',
      });
      
      expect(result).toEqual({ success: true });
      expect(ctx.db.delete).toHaveBeenCalledWith(WorkoutExercise);
    });
    
    it('should throw when trying to delete the only block', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      // All exercises in same block
      ctx.db.query.WorkoutExercise = {
        findMany: vi.fn().mockResolvedValue([
          { ...mockExercises[0], groupName: 'Block A' },
          { ...mockExercises[1], groupName: 'Block A' },
        ]),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.deleteBlock({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
          groupName: 'Block A',
        })
      ).rejects.toThrow('Cannot delete the only remaining block');
    });
  });
  
  describe('deleteWorkout', () => {
    it('should delete a workout', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue(mockWorkout),
      };
      
      ctx.db.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      
      caller = createCaller(ctx);
      
      const result = await caller.workout.deleteWorkout({
        workoutId: '123e4567-e89b-12d3-a456-426614174000',
      });
      
      expect(result).toEqual({ success: true });
      expect(ctx.db.delete).toHaveBeenCalledWith(Workout);
    });
    
    it('should not allow deleting assessment workouts', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      
      ctx.db.query.Workout = {
        findFirst: vi.fn().mockResolvedValue({
          ...mockWorkout,
          context: 'assessment',
        }),
      };
      
      caller = createCaller(ctx);
      
      await expect(
        caller.workout.deleteWorkout({
          workoutId: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Assessment workouts cannot be deleted');
    });
  });
});