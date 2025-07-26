import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    exercise: {
      findMany: vi.fn(),
    },
    businessExercise: {
      findMany: vi.fn(),
    },
  },
}));

describe('Role-Based Access Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trainer Dashboard Access', () => {
    it('should allow trainer to access exercise management endpoints', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      caller = createCaller(ctx);

      // Mock database response using new select pattern
      ctx.db.selectMockChain.then.mockImplementation((resolve) => 
        resolve([{ 
          exercise: { 
            id: '1', 
            name: 'Push-up', 
            description: 'Basic push-up', 
            createdAt: new Date(), 
            updatedAt: new Date() 
          } 
        }])
      );

      const result = await caller.exercise.all({ limit: 10 });

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Push-up' }),
        ]),
      );
    });

  });

  describe('Protected Procedures', () => {

    it('should require authentication for protected endpoints', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      // Try to access a protected endpoint (filter requires auth)
      await expect(
        caller.exercise.filter({ clientName: 'Test' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('Role-Specific Endpoints', () => {
    it('should allow trainer to access all routes', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      caller = createCaller(ctx);

      // Test accessing various endpoints
      const sessionResult = await caller.auth.getSession();
      expect(sessionResult).toBeDefined();

      const roleCheck = await caller.auth.isTrainer();
      expect(roleCheck).toBe(true);
    });

    it('should restrict client access to certain routes', async () => {
      const ctx = createAuthenticatedContext('client', 'business-123');
      caller = createCaller(ctx);

      // Client can check their session
      const sessionResult = await caller.auth.getSession();
      expect(sessionResult).toBeDefined();

      // Client role check should return false
      const roleCheck = await caller.auth.isTrainer();
      expect(roleCheck).toBe(false);
    });
  });
});