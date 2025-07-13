import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext, mockUser } from './test-utils';

// Mock the auth module
vi.mock('@acme/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInUsername: vi.fn(),
    },
  },
}));

// Mock the database with proper structure
vi.mock('@acme/db/client', () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      Post: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    user: {},
  },
}));

import { db } from '@acme/db/client';
import { eq } from '@acme/db';

describe('Comprehensive Auth Router Tests', () => {
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return full session info for authenticated user', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      caller = createCaller(ctx);

      const result = await caller.auth.getSession();

      expect(result).toEqual({
        id: 'test-session-id',
        userId: 'test-user-id',
        expiresAt: expect.any(Date),
        user: expect.objectContaining({
          id: 'test-user-id',
          username: 'testuser',
          phone: '+1234567890',
          role: 'trainer',
          businessId: '123e4567-e89b-12d3-a456-426614174002',
        }),
      });
    });

    it('should return null for unauthenticated user', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      const result = await caller.auth.getSession();
      expect(result).toBeNull();
    });

  });

  describe('getSecretMessage', () => {
    it('should return secret message for authenticated user', async () => {
      const ctx = createAuthenticatedContext();
      caller = createCaller(ctx);

      const result = await caller.auth.getSecretMessage();
      expect(result).toBe('you can see this secret message!');
    });

    it('should throw UNAUTHORIZED for unauthenticated user', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.auth.getSecretMessage()).rejects.toThrow(TRPCError);
      await expect(caller.auth.getSecretMessage()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('getUserRole', () => {
    it('should return role and businessId for authenticated user', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174004');
      caller = createCaller(ctx);

      const result = await caller.auth.getUserRole();

      expect(result).toEqual({
        role: 'trainer',
        businessId: '123e4567-e89b-12d3-a456-426614174004',
      });
    });

    it('should return role with default client if not specified', async () => {
      const user = mockUser({ role: undefined });
      const ctx = createMockContext(user, { userId: user.id });
      caller = createCaller(ctx);

      const result = await caller.auth.getUserRole();

      expect(result).toEqual({
        role: 'client',
        businessId: user.businessId,
      });
    });

    it('should throw UNAUTHORIZED for unauthenticated user', async () => {
      const ctx = createMockContext();
      ctx.session = { user: null, id: 'session-id', userId: null, expiresAt: new Date() };
      caller = createCaller(ctx);

      await expect(caller.auth.getUserRole()).rejects.toThrow(TRPCError);
      await expect(caller.auth.getUserRole()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should throw UNAUTHORIZED for missing session', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.auth.getUserRole()).rejects.toThrow(TRPCError);
    });
  });

  describe('isTrainer', () => {
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

    it('should throw UNAUTHORIZED for unauthenticated user', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(caller.auth.isTrainer()).rejects.toThrow(TRPCError);
      await expect(caller.auth.isTrainer()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should handle missing role field', async () => {
      const user = mockUser({ role: undefined });
      const ctx = createMockContext(user, { userId: user.id });
      caller = createCaller(ctx);

      const result = await caller.auth.isTrainer();
      expect(result).toBe(false); // Should default to false if role is missing
    });
  });


  describe('updateUserBusiness', () => {
    it('should update user business ID successfully', async () => {
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174009');
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      ctx.db.update = mockUpdate;
      caller = createCaller(ctx);

      const result = await caller.auth.updateUserBusiness({ 
        businessId: '123e4567-e89b-12d3-a456-426614174000' 
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should reject invalid business ID format', async () => {
      const ctx = createAuthenticatedContext();
      caller = createCaller(ctx);

      await expect(
        caller.auth.updateUserBusiness({ businessId: 'invalid-id' })
      ).rejects.toThrow();
    });

    it('should throw error for unauthenticated user', async () => {
      const ctx = createMockContext();
      caller = createCaller(ctx);

      await expect(
        caller.auth.updateUserBusiness({ businessId: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when user ID is missing from session', async () => {
      const ctx = createAuthenticatedContext();
      ctx.session.user.id = undefined;
      caller = createCaller(ctx);

      await expect(
        caller.auth.updateUserBusiness({ businessId: '123e4567-e89b-12d3-a456-426614174000' })
      ).rejects.toThrow('No user ID in session');
    });
  });

});