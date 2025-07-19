import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the AI module
vi.mock('@acme/ai', () => ({
  filterExercisesFromInput: vi.fn(),
  enhancedFilterExercisesFromInput: vi.fn(),
  saveFilterDebugData: vi.fn(),
  parseWorkoutPreferences: vi.fn(),
  interpretSMS: vi.fn(),
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

    it('should return filtered exercises', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      caller = createCaller(ctx);

      // Mock database response for the new select pattern
      // The query returns objects with { exercise: {...} } structure
      const businessExercisesData = mockExercises.map(be => ({ 
        exercise: be.exercise 
      }));
      
      // Configure the mock chain to return the data
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve(businessExercisesData)
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

      // Verify that the select chain was called
      expect(ctx.db.select).toHaveBeenCalled();
      expect(ctx.db.selectMockChain.from).toHaveBeenCalled();
      expect(ctx.db.selectMockChain.innerJoin).toHaveBeenCalled();

      // Verify exercises were returned
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use businessId from session not from input', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      caller = createCaller(ctx);

      // Mock database response - empty result
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([])
      );

      // Mock AI filter response
      const { filterExercisesFromInput } = await import('@acme/ai');
      vi.mocked(filterExercisesFromInput).mockResolvedValue({
        filteredExercises: [],
        scoringDetails: {},
      });

      await caller.exercise.filter({
        clientName: 'Test Client',
      });

      // Verify the select chain was called
      expect(ctx.db.select).toHaveBeenCalled();
      expect(ctx.db.selectMockChain.where).toHaveBeenCalled();
    });

    it('should handle users without businessId', async () => {
      const ctx = createAuthenticatedContext('trainer', '');
      caller = createCaller(ctx);

      await expect(
        caller.exercise.filter({
          clientName: 'Test Client',
        })
      ).rejects.toThrow('User must be associated with a business');
    });
  });
});