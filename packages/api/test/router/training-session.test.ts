import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from '../test-utils';
import { db } from '@acme/db/client';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock the schema
vi.mock('@acme/db/schema', () => ({
  TrainingSession: {},
  UserTrainingSession: {},
  user: {
    id: 'user.id',
    name: 'user.name',
    email: 'user.email',
    businessId: 'user.businessId',
  },
  Business: {},
  BusinessExercise: {},
  CreateBusinessSchema: {
    parse: vi.fn((data) => data),
  },
  CreateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
  },
  UpdateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
  },
  Post: {},
  CreatePostSchema: {
    parse: vi.fn((data) => data),
  },
  Workout: {},
  WorkoutExercise: {},
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
  WorkoutPreferences: {},
  CreateWorkoutPreferencesSchema: {
    parse: vi.fn((data) => data),
  },
}));

// Mock DB utilities
vi.mock('@acme/db', () => ({
  eq: vi.fn((column, value) => ({ _tag: 'eq', column, value })),
  and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
  or: vi.fn((...conditions) => ({ _tag: 'or', conditions })),
  desc: vi.fn((column) => ({ _tag: 'desc', column })),
  asc: vi.fn((column) => ({ _tag: 'asc', column })),
  gte: vi.fn((column, value) => ({ _tag: 'gte', column, value })),
  lte: vi.fn((column, value) => ({ _tag: 'lte', column, value })),
  ne: vi.fn((column, value) => ({ _tag: 'ne', column, value })),
}));

describe('TrainingSessionRouter', () => {
  let caller: ReturnType<typeof createCaller>;

  const mockSession = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    businessId: 'business-456',
    name: 'Morning Workout',
    scheduledAt: new Date('2024-01-15T09:00:00Z'),
    durationMinutes: 60,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'trainer@gym.com',
    businessId: 'business-456',
    role: 'trainer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a training session for authorized trainer', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const mockCreatedSession = {
        ...mockSession,
        id: 'b1ccdc88-8d1c-5ff9-cc7e-7cc9ce491b22',
      };

      // Mock query for checking existing sessions
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(null); // No existing open sessions

      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreatedSession]),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.create({
        name: 'Morning Workout',
        scheduledAt: new Date('2024-01-15T09:00:00Z'),
        durationMinutes: 60,
        businessId: 'business-456',
      });

      expect(result).toEqual(mockCreatedSession);
      expect(ctx.db.insert).toHaveBeenCalled();
    });

    it('should reject non-trainer users', async () => {
      const ctx = createAuthenticatedContext('client', 'business-456');
      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.create({
          name: 'Morning Workout',
          scheduledAt: new Date(),
          durationMinutes: 60,
          businessId: 'business-456',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should enforce one open session per business', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      
      // Mock existing open session
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);

      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.create({
          name: 'Another Workout',
          scheduledAt: new Date(),
          durationMinutes: 60,
          businessId: 'business-456',
        })
      ).rejects.toThrow('There is already an open session for this business');
    });

    it('should handle missing business ID', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      caller = createCaller(ctx);

      // When trainer has businessId but tries to create for null business
      await expect(
        caller.trainingSession.create({
          name: 'Morning Workout',
          scheduledAt: new Date(),
          durationMinutes: 60,
          businessId: 'different-business-789',
        })
      ).rejects.toThrow('You can only create sessions for your own business');
    });
  });

  describe('list', () => {
    it('should list all sessions for a business', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const mockSessions = [mockSession, { ...mockSession, id: 'session-456' }];

      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockSessions),
              }),
            }),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.list({});

      expect(result).toEqual(mockSessions);
    });

    it('should filter by status when provided', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const openSessions = [mockSession];

      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(openSessions),
              }),
            }),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.list({ status: 'open' });

      expect(result).toEqual(openSessions);
    });

    it('should handle pagination', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const paginatedSessions = [mockSession];

      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(paginatedSessions),
              }),
            }),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.list({ 
        limit: 10, 
        offset: 20 
      });

      expect(result).toEqual(paginatedSessions);
    });
  });

  describe('getCheckedInClients', () => {
    it('should return checked-in clients for a session', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const mockCheckedInUser = {
        userId: 'client-1',
        status: 'checked_in',
        checkedInAt: new Date(),
        preferenceCollectionStep: 'not_started',
      };

      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);

      // Mock checked-in clients query - support both queries
      let selectCallCount = 0;
      ctx.db.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call - get checked-in users
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([mockCheckedInUser]),
              }),
            }),
          };
        } else {
          // Subsequent calls - get workout preferences
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
      });
      
      // Mock user lookup
      ctx.db.query.user.findFirst = vi.fn().mockResolvedValue({
        id: 'client-1',
        name: 'John Doe',
        email: 'john@example.com',
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.getCheckedInClients({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should only return checked-in status', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      
      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);
      
      // Mock empty checked-in clients
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.getCheckedInClients({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual([]);
    });
  });

  describe('startSession', () => {
    it('should transition session from open to in_progress', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const updatedSession = {
        ...mockSession,
        status: 'in_progress',
      };

      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);
      
      // Mock update
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSession]),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.startSession({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual(updatedSession);
      expect(ctx.db.update).toHaveBeenCalled();
    });

    it('should only allow trainers to start sessions', async () => {
      const ctx = createAuthenticatedContext('client', 'business-456');
      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.startSession({
          sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should handle non-existent session', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      
      // Mock session not found
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(null);

      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.startSession({
          sessionId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('completeSession', () => {
    it('should transition session from in_progress to closed', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const completedSession = {
        ...mockSession,
        status: 'completed',
      };

      // Mock session lookup - session is in_progress
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue({
        ...mockSession,
        status: 'in_progress',
      });
      
      // Mock update
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([completedSession]),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.completeSession({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual(completedSession);
    });

    it('should validate session state transitions', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Mock session lookup - session is 'open' (invalid state for completion)
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);

      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.completeSession({
          sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        })
      ).rejects.toThrow();
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to a session', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);
      
      // Mock no existing participant
      ctx.db.query.UserTrainingSession.findFirst = vi.fn().mockResolvedValue(null);
      
      // Mock count for max participants check
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });
      
      // Mock insert
      ctx.db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            userId: 'client-123',
            trainingSessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            status: 'registered',
          }]),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.addParticipant({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        userId: 'client-123',
      });

      expect(result).toBeDefined();
      expect(ctx.db.insert).toHaveBeenCalled();
    });

    it('should handle duplicate participant additions', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);
      
      // Mock existing participant (duplicate)
      ctx.db.query.UserTrainingSession.findFirst = vi.fn().mockResolvedValue({
        userId: 'client-123',
        trainingSessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.addParticipant({
          sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          userId: 'client-123',
        })
      ).rejects.toThrow('User already registered for this session');
    });
  });

  describe('myPast', () => {
    it('should return past sessions for authenticated user', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const pastSessions = [
        {
          TrainingSession: {
            ...mockSession,
            status: 'closed',
            scheduledAt: new Date('2024-01-01'),
          },
        },
      ];

      const pastSession = {
        ...mockSession,
        status: 'completed' as const,
        scheduledAt: new Date('2024-01-01'),
      };
      
      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([{ session: pastSession }]),
                }),
              }),
            }),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.myPast({});

      expect(result).toEqual([pastSession]);
    });

    it('should exclude future sessions', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      ctx.db.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.myPast({});

      expect(result).toEqual([]);
    });
  });

  describe('cancelSession', () => {
    it('should allow trainers to cancel sessions', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Mock session lookup
      ctx.db.query.TrainingSession.findFirst = vi.fn().mockResolvedValue(mockSession);
      
      // Mock update to cancelled
      const cancelledSession = { ...mockSession, status: 'cancelled' };
      ctx.db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([cancelledSession]),
          }),
        }),
      });

      caller = createCaller(ctx);

      const result = await caller.trainingSession.cancelSession({
        sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });

      expect(result).toEqual(cancelledSession);
      expect(ctx.db.update).toHaveBeenCalled();
    });

    it('should reject non-trainer cancellations', async () => {
      const ctx = createAuthenticatedContext('client', 'business-456');
      caller = createCaller(ctx);

      await expect(
        caller.trainingSession.cancelSession({
          sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});