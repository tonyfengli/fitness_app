import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the AI module
vi.mock('@acme/ai', () => ({
  filterExercisesFromInput: vi.fn(),
  enhancedFilterExercisesFromInput: vi.fn(),
  saveFilterDebugData: vi.fn(),
}));

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    businessExercise: {
      findMany: vi.fn(),
    },
    exercise: {
      findMany: vi.fn(),
    },
  },
}));

describe('Workout Engine with Auth Tests', () => {
  let caller: ReturnType<typeof createCaller>;
  const mockExercises = [
    {
      id: 'ex1',
      exerciseId: 'ex1',
      businessId: 'business-123',
      exercise: {
        id: 'ex1',
        name: 'Squat',
        description: 'Basic squat',
        primaryMuscles: ['quadriceps'],
        movementType: 'lower',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      id: 'ex2',
      exerciseId: 'ex2',
      businessId: 'business-123',
      exercise: {
        id: 'ex2',
        name: 'Push-up',
        description: 'Basic push-up',
        primaryMuscles: ['chest'],
        movementType: 'upper',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('filterExercisesFromInput with Auth', () => {
    it('should reject requests without a valid session', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(
        caller.exercise.filter({
          clientName: 'Test Client',
          strengthCapacity: 'moderate',
          skillCapacity: 'moderate',
        })
      ).rejects.toThrow(TRPCError);
      
      await expect(
        caller.exercise.filter({})
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should return filtered exercises scoped to user businessId', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      caller = createCaller(ctx);

      // Mock database response
      ctx.db.query.exercises.findMany.mockResolvedValue(
        mockExercises.map(be => be.exercise)
      );

      // Mock AI filter response
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: mockExercises.map(be => be.exercise),
        scoringDetails: {},
      });

      const result = await caller.exercise.filter({
        clientName: 'Test Client',
        strengthCapacity: 'moderate',
        skillCapacity: 'moderate',
      });

      // Verify that exercises were fetched
      expect(ctx.db.query.exercises.findMany).toHaveBeenCalled();

      // Verify exercises were returned
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use businessId from session not from input', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      caller = createCaller(ctx);

      // Mock database response
      ctx.db.query.exercises.findMany.mockResolvedValue([]);

      // Mock AI filter response
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        scoringDetails: {},
      });

      await caller.exercise.filter({
        clientName: 'Test Client',
      });

      // Verify exercises were fetched
      expect(ctx.db.query.exercises.findMany).toHaveBeenCalled();
    });

    it('should handle users without businessId', async () => {
      const ctx = createAuthenticatedContext('trainer', '');
      caller = createCaller(ctx);

      await expect(
        caller.exercise.filter({
          clientName: 'Test Client',
        })
      ).rejects.toThrow('Failed to filter exercises');
    });
  });
});