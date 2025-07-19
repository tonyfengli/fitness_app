import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createCaller, createMockContext, createAuthenticatedContext } from '../test-utils';
import { db } from '@acme/db/client';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the schema
vi.mock('@acme/db/schema', () => ({
  messages: {
    id: 'messages.id',
    userId: 'messages.userId',
    businessId: 'messages.businessId',
    direction: 'messages.direction',
    content: 'messages.content',
    metadata: 'messages.metadata',
    status: 'messages.status',
    createdAt: 'messages.createdAt',
  },
  user: {
    id: 'user.id',
    name: 'user.name',
    email: 'user.email',
    businessId: 'user.businessId',
    role: 'user.role',
    phone: 'user.phone',
  },
  CreateBusinessSchema: {
    parse: vi.fn((data) => data),
  },
  CreateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
  },
  UpdateTrainingSessionSchema: {
    parse: vi.fn((data) => data),
  },
  CreatePostSchema: {
    parse: vi.fn((data) => data),
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
  CreateWorkoutPreferencesSchema: {
    parse: vi.fn((data) => data),
  },
  TrainingSession: {},
  UserTrainingSession: {},
  Business: {},
  BusinessExercise: {},
  Post: {},
  Workout: {},
  WorkoutExercise: {},
  WorkoutPreferences: {},
}));

// Mock DB utilities
vi.mock('@acme/db', () => ({
  eq: vi.fn((column, value) => ({ _tag: 'eq', column, value })),
  desc: vi.fn((column) => ({ _tag: 'desc', column })),
}));

describe('MessagesRouter', () => {
  let caller: ReturnType<typeof createCaller>;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    businessId: 'business-456',
    role: 'client' as const,
    name: 'Test User',
  };

  const mockTrainer = {
    id: 'trainer-123',
    email: 'trainer@example.com',
    businessId: 'business-456',
    role: 'trainer' as const,
    name: 'Test Trainer',
  };

  const mockMessages = [
    {
      id: 'msg-1',
      userId: 'user-123',
      businessId: 'business-456',
      direction: 'inbound',
      content: 'here',
      phoneNumber: '+12345678901',
      status: 'delivered',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      metadata: {
        intent: { type: 'check_in', confidence: 0.95 },
      },
    },
    {
      id: 'msg-2',
      userId: 'user-123',
      businessId: 'business-456',
      direction: 'outbound',
      content: "You're checked in for Morning Workout. Welcome!",
      phoneNumber: '+12345678901',
      status: 'sent',
      createdAt: new Date('2024-01-15T10:00:01Z'),
      metadata: {
        checkInResult: { success: true, sessionId: 'session-123' },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByUser', () => {
    it('should allow trainers to view their clients messages', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Setup mock chain for all three database calls
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call - trainer check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockTrainer])
              })
            })
          } as any;
        } else if (callCount === 2) {
          // Second call - target user check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser])
              })
            })
          } as any;
        } else {
          // Third call - get messages
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockMessages)
                })
              })
            })
          } as any;
        }
      });

      caller = createCaller(ctx);

      const result = await caller.messages.getByUser({
        userId: 'user-123',
      });

      expect(result).toEqual(mockMessages);
    });

    it('should prevent non-trainers from viewing messages', async () => {
      const ctx = createAuthenticatedContext('client', 'business-456');
      
      // Mock client user check (not a trainer)
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser])
          })
        })
      } as any));

      caller = createCaller(ctx);

      await expect(
        caller.messages.getByUser({
          userId: 'user-123',
        })
      ).rejects.toThrow('Only trainers can view messages');
    });

    it('should prevent trainers from viewing messages outside their business', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const otherBusinessUser = { ...mockUser, businessId: 'other-business-789' };

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call - trainer check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockTrainer])
              })
            })
          } as any;
        } else {
          // Second call - target user from different business
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([otherBusinessUser])
              })
            })
          } as any;
        }
      });

      caller = createCaller(ctx);

      await expect(
        caller.messages.getByUser({
          userId: 'user-123',
        })
      ).rejects.toThrow('Can only view messages for users in your business');
    });

    it('should require authentication', async () => {
      const ctx = createMockContext(); // Unauthenticated
      caller = createCaller(ctx);

      await expect(
        caller.messages.getByUser({
          userId: 'user-123',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should handle empty message history', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call - trainer check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockTrainer])
              })
            })
          } as any;
        } else if (callCount === 2) {
          // Second call - target user check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser])
              })
            })
          } as any;
        } else {
          // Third call - no messages
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([])
                })
              })
            })
          } as any;
        }
      });

      caller = createCaller(ctx);

      const result = await caller.messages.getByUser({
        userId: 'user-123',
      });

      expect(result).toEqual([]);
    });

    it('should preserve message metadata structure', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');
      const messagesWithComplexMetadata = [
        {
          ...mockMessages[0],
          metadata: {
            intent: { type: 'check_in', confidence: 0.95 },
            twilioMessageSid: 'SM123456',
            llmParsing: {
              model: 'gpt-4o',
              parseTimeMs: 250,
              parsedData: { intensity: 'low' },
            },
          },
        },
      ];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call - trainer check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockTrainer])
              })
            })
          } as any;
        } else if (callCount === 2) {
          // Second call - target user check
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser])
              })
            })
          } as any;
        } else {
          // Third call - messages with metadata
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(messagesWithComplexMetadata)
                })
              })
            })
          } as any;
        }
      });

      caller = createCaller(ctx);

      const result = await caller.messages.getByUser({
        userId: 'user-123',
      });

      expect(result[0].metadata).toEqual(messagesWithComplexMetadata[0].metadata);
    });
  });

  describe('getUsersWithMessages', () => {
    it('should return users with messages for trainers', async () => {
      const ctx = createAuthenticatedContext('trainer', 'business-456');

      // Mock trainer check
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTrainer])
          })
        })
      } as any));

      // Mock distinct users query
      vi.mocked(db.selectDistinct).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  userId: 'user-123',
                  userName: 'Test User',
                  userPhone: '+12345678901',
                  lastMessageAt: new Date(),
                },
              ])
            })
          })
        })
      } as any));

      caller = createCaller(ctx);

      const result = await caller.messages.getUsersWithMessages();

      expect(result).toBeDefined();
    });
  });
});