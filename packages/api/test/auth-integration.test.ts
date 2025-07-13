import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext, mockUser, mockSession } from './test-utils';

// Mock the auth module
vi.mock('@acme/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInUsername: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      business: {
        findFirst: vi.fn(),
      },
      exercises: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

import { auth } from '@acme/auth';

describe('Auth Integration Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });



  describe('Business Association Flow', () => {
    it('should handle user switching businesses', async () => {
      // Start with user in one business
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174000');
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      ctx.db.update = mockUpdate;
      caller = createCaller(ctx);

      // Verify initial business
      const initialRole = await caller.auth.getUserRole();
      expect(initialRole.businessId).toBe('123e4567-e89b-12d3-a456-426614174000');

      // Update business association
      await caller.auth.updateUserBusiness({ 
        businessId: '123e4567-e89b-12d3-a456-426614174001' 
      });

      // Simulate updated session
      ctx.session.user.businessId = '123e4567-e89b-12d3-a456-426614174001';

      // Verify business updated
      const updatedRole = await caller.auth.getUserRole();
      expect(updatedRole.businessId).toBe('123e4567-e89b-12d3-a456-426614174001');
    });

  });

  describe('Role-Based Access Control', () => {
    it('should allow both roles to view exercises', async () => {
      // Trainer access
      const trainerCtx = createAuthenticatedContext('trainer');
      trainerCtx.db.query.exercises.findMany.mockResolvedValue([
        { id: '1', name: 'Exercise 1' },
      ]);
      const trainerCaller = createCaller(trainerCtx);
      
      const trainerExercises = await trainerCaller.exercise.all();
      expect(trainerExercises).toHaveLength(1);

      // Client access
      const clientCtx = createAuthenticatedContext('client');
      clientCtx.db.query.exercises.findMany.mockResolvedValue([
        { id: '1', name: 'Exercise 1' },
      ]);
      const clientCaller = createCaller(clientCtx);
      
      const clientExercises = await clientCaller.exercise.all();
      expect(clientExercises).toHaveLength(1);
    });

    it('should require auth for exercise filtering', async () => {
      const unauthCtx = createMockContext();
      caller = createCaller(unauthCtx);

      await expect(
        caller.exercise.filter({ clientName: 'Test' })
      ).rejects.toThrow(TRPCError);
    });
  });


});