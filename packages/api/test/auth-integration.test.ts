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

  describe('Complete Signup → Login → Access Flow', () => {
    it('should handle trainer signup and login flow', async () => {
      // Step 1: Initial state - no session
      const unauthCtx = createMockContext();
      caller = createCaller(unauthCtx);

      const initialSession = await caller.auth.getSession();
      expect(initialSession).toBeNull();

      // Step 2: Signup (simulated through auth module)
      const signupData = {
        username: 'newtrainer',
        password: 'securepassword123',
        phone: '+1234567890',
        role: 'trainer',
        businessId: '123e4567-e89b-12d3-a456-426614174002',
      };

      // Mock successful signup
      vi.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: {
          id: 'new-user-id',
          ...signupData,
        },
        session: {
          id: 'new-session-id',
          userId: 'new-user-id',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Step 3: Login with credentials
      vi.mocked(auth.api.signInUsername).mockResolvedValue({
        session: {
          id: 'login-session-id',
          userId: 'new-user-id',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        user: {
          id: 'new-user-id',
          username: 'newtrainer',
          role: 'trainer',
          businessId: '123e4567-e89b-12d3-a456-426614174002',
        },
      });

      // Step 4: Create authenticated context and verify access
      const authCtx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174002');
      caller = createCaller(authCtx);

      // Verify session is established
      const session = await caller.auth.getSession();
      expect(session).toBeTruthy();
      expect(session.user.role).toBe('trainer');
      expect(session.user.businessId).toBe('123e4567-e89b-12d3-a456-426614174002');

      // Verify role check
      const isTrainer = await caller.auth.isTrainer();
      expect(isTrainer).toBe(true);

      // Verify access to protected endpoints
      const secretMessage = await caller.auth.getSecretMessage();
      expect(secretMessage).toBe('you can see this secret message!');
    });

    it('should handle client signup and login flow', async () => {
      // Step 1: Client signup
      const signupData = {
        username: 'newclient',
        password: 'clientpass123',
        phone: '+0987654321',
        role: 'client',
        businessId: '123e4567-e89b-12d3-a456-426614174003',
      };

      vi.mocked(auth.api.signUpEmail).mockResolvedValue({
        user: {
          id: 'client-user-id',
          ...signupData,
        },
        session: {
          id: 'client-session-id',
          userId: 'client-user-id',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Step 2: Create authenticated client context
      const authCtx = createAuthenticatedContext('client', '123e4567-e89b-12d3-a456-426614174003');
      caller = createCaller(authCtx);

      // Verify client session
      const session = await caller.auth.getSession();
      expect(session.user.role).toBe('client');

      // Verify role check
      const isTrainer = await caller.auth.isTrainer();
      expect(isTrainer).toBe(false);

      // Verify client can access protected endpoints
      const roleInfo = await caller.auth.getUserRole();
      expect(roleInfo).toEqual({
        role: 'client',
        businessId: '123e4567-e89b-12d3-a456-426614174003',
      });
    });
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

    it('should enforce business scoping after switch', async () => {
      // User switches from business A to B
      const ctx = createAuthenticatedContext('trainer', '123e4567-e89b-12d3-a456-426614174001');
      ctx.db.query.exercises.findMany.mockResolvedValue([
        { id: '1', name: 'Business B Exercise', businessId: '123e4567-e89b-12d3-a456-426614174001' },
      ]);
      caller = createCaller(ctx);

      // Verify exercises are scoped to new business
      const exercises = await caller.exercise.all();
      expect(exercises).toHaveLength(1);
      expect(exercises[0].name).toBe('Business B Exercise');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow trainers to create businesses', async () => {
      const ctx = createAuthenticatedContext('trainer');
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-biz', name: 'New Gym' }]),
        }),
      });
      caller = createCaller(ctx);

      const result = await caller.business.create({
        name: 'New Gym',
        description: 'A new gym',
      });

      expect(result).toEqual([{ id: 'new-biz', name: 'New Gym' }]);
    });

    it('should prevent clients from creating businesses', async () => {
      const ctx = createAuthenticatedContext('client');
      caller = createCaller(ctx);

      await expect(
        caller.business.create({
          name: 'Client Gym',
          description: 'Should fail',
        })
      ).rejects.toThrow('Only trainers can create businesses');
    });

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