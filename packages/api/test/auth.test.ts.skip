import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from './test-utils';

// Mock the auth module
vi.mock('@acme/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInUsername: vi.fn(),
    },
  },
}));

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
    business: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Auth Flow Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should return session info for authenticated user', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-123');
      caller = createCaller(ctx);

      const result = await caller.auth.getSession();

      expect(result).toEqual(expect.objectContaining({
        id: 'test-session-id',
        userId: 'test-user-id',
        user: expect.objectContaining({
          id: 'test-user-id',
          username: 'testuser',
          role: 'trainer',
          businessId: 'business-123',
        }),
      }));
    });

    it('should throw error for unauthenticated user', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      const result = await caller.auth.getSession();
      expect(result).toBeNull();
    });

    it('should include role and businessId in session', async () => {
      const ctx = createAuthenticatedContext('client', 'business-456');
      caller = createCaller(ctx);

      const result = await caller.auth.getSession();

      expect(result.user).toHaveProperty('role', 'client');
      expect(result.user).toHaveProperty('businessId', 'business-456');
    });
  });

  describe('Role Checking', () => {
    it('should return true for trainer role', async () => {
      const ctx = createAuthenticatedContext('trainer');
      caller = createCaller(ctx);

      const result = await caller.auth.isTrainer();
      expect(result).toBe(true);
    });

    it('should return false for client role', async () => {
      const ctx = createAuthenticatedContext('client');
      caller = createCaller(ctx);

      const result = await caller.auth.isTrainer();
      expect(result).toBe(false);
    });

    it('should require authentication for role check', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.auth.isTrainer()).rejects.toThrow(TRPCError);
      await expect(caller.auth.isTrainer()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });
});