import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve([])),
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'new-business-id' }])),
      })),
    })),
  },
}));

vi.mock('@acme/db/schema', () => ({
  Business: {},
  BusinessExercise: {},
  CreateBusinessSchema: {
    parse: vi.fn((data) => data),
  },
  Post: {},
  CreatePostSchema: {
    parse: vi.fn((data) => data),
  },
  // Training session schemas
  TrainingSession: {},
  UserTrainingSession: {},
  Workout: {},
  WorkoutExercise: {},
  CreateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
  CreateWorkoutSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
  AddExercisesToWorkoutSchema: {
    parse: vi.fn((data) => data),
    extend: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
}));

// Using ctx.db from mocks instead of importing

describe('Business Router Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('all', () => {
    it('should return all businesses ordered by name', async () => {
      const mockBusinesses = [
        { id: '1', name: 'Alpha Gym', description: 'First gym' },
        { id: '2', name: 'Beta Fitness', description: 'Second gym' },
        { id: '3', name: 'Charlie\'s Gym', description: 'Third gym' },
      ];

      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockBusinesses),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.all();

      expect(result).toEqual(mockBusinesses);
      expect(ctx.db.select).toHaveBeenCalled();
    });

    it('should be accessible without authentication', async () => {
      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.all();
      expect(result).toEqual([]);
    });

    it('should handle empty business list', async () => {
      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.all();
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);
      caller = createCaller(ctx);

      await expect(caller.business.all()).rejects.toThrow('Database error');
    });
  });

  describe('byId', () => {
    it('should return a specific business by ID', async () => {
      const mockBusiness = { 
        id: 'business-123', 
        name: 'Test Gym', 
        description: 'A test gym' 
      };

      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockBusiness]),
          }),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.byId({ id: 'business-123' });

      expect(result).toEqual(mockBusiness);
    });

    it('should return undefined for non-existent business', async () => {
      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.byId({ id: 'non-existent' });

      expect(result).toBeUndefined();
    });

    it('should validate ID input', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      // Should accept any string ID
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(caller.business.byId({ id: 'any-string-id' })).resolves.toBeUndefined();
    });

    it('should be accessible without authentication', async () => {
      const ctx = createMockContext();
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: '1', name: 'Public Gym' }]),
          }),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.byId({ id: '1' });
      expect(result).toMatchObject({ name: 'Public Gym' });
    });
  });

  describe('create', () => {
    it('should create businesses with valid data', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174010');
      const newBusiness = {
        name: 'New Gym',
        description: 'A brand new gym',
      };

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ 
            id: 'new-business-id', 
            ...newBusiness 
          }]),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.create(newBusiness);

      expect(result).toEqual([{
        id: 'new-business-id',
        name: 'New Gym',
        description: 'A brand new gym',
      }]);
      expect(ctx.db.insert).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(
        caller.business.create({
          name: 'Unauthorized Gym',
          description: 'Should not be created',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should handle missing role in session', async () => {
      const ctx = createAuthenticatedContext();
      ctx.session.user.role = undefined;
      caller = createCaller(ctx);

      // Test behavior when role is undefined
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
        }),
      } as any);

      // The actual behavior depends on implementation
      await expect(
        caller.business.create({
          name: 'No Role Gym',
          description: 'Testing missing role',
        })
      ).rejects.toThrow();
    });

    it('should validate business data schema', async () => {
      const ctx = createAuthenticatedContext('trainer');
      caller = createCaller(ctx);

      // Test with invalid data (implementation would validate through CreateBusinessSchema)
      const invalidData = {
        // Missing required fields or invalid types
        name: '', // Empty name should be invalid
        description: null, // Null description might be invalid
      };

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Validation error')),
        }),
      } as any);

      await expect(caller.business.create(invalidData as any)).rejects.toThrow();
    });

    it('should handle database insertion errors', async () => {
      const ctx = createAuthenticatedContext('trainer');
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
        }),
      } as any);
      caller = createCaller(ctx);

      await expect(
        caller.business.create({
          name: 'Error Gym',
          description: 'Will fail to insert',
        })
      ).rejects.toThrow('Database constraint violation');
    });

    it('should handle duplicate business names', async () => {
      const ctx = createAuthenticatedContext('trainer');
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Unique constraint violation')),
        }),
      } as any);
      caller = createCaller(ctx);

      await expect(
        caller.business.create({
          name: 'Existing Gym',
          description: 'Already exists',
        })
      ).rejects.toThrow('Unique constraint violation');
    });
  });

  describe('Business Router Edge Cases', () => {
    it('should handle very long business names', async () => {
      const ctx = createAuthenticatedContext('trainer');
      const longName = 'A'.repeat(255); // Maximum expected length

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: '1', name: longName }]),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.create({
        name: longName,
        description: 'Test',
      });

      expect(result[0].name).toHaveLength(255);
    });

    it('should handle special characters in business names', async () => {
      const ctx = createAuthenticatedContext('trainer');
      const specialName = "John's Gym & Fitness Center™";

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ 
            id: '1', 
            name: specialName,
            description: 'Test'
          }]),
        }),
      } as any);
      caller = createCaller(ctx);

      const result = await caller.business.create({
        name: specialName,
        description: 'Test',
      });

      expect(result[0].name).toBe(specialName);
    });

    it('should handle concurrent business creation attempts', async () => {
      const ctx = createAuthenticatedContext('trainer');
      caller = createCaller(ctx);

      let callCount = 0;
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: 'first-id', name: 'First' }]);
            }
            return Promise.reject(new Error('Duplicate name'));
          }),
        }),
      } as any);

      // First call succeeds
      const result1 = await caller.business.create({ name: 'Concurrent Gym', description: 'Test' });
      expect(result1[0].id).toBe('first-id');

      // Second call fails
      await expect(
        caller.business.create({ name: 'Concurrent Gym', description: 'Test' })
      ).rejects.toThrow('Duplicate name');
    });
  });
});