import { vi } from 'vitest';
import { appRouter } from '../src';

type User = {
  id: string;
  username?: string;
  phone?: string;
  role: 'client' | 'trainer';
  businessId: string | null;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
};

type Session = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export const mockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  username: 'testuser',
  phone: '+1234567890',
  role: 'client',
  businessId: 'test-business-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  name: 'Test User',
  ...overrides,
});

export const mockSession = (overrides?: Partial<Session>): Session => ({
  id: 'test-session-id',
  userId: 'test-user-id',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  ...overrides,
});

// Helper to create chainable select mock for business-filtered queries
export const createSelectMock = (returnData: any[] = []) => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve(returnData)),
  };

  // Make the select function return the chain
  const selectFn = vi.fn(() => mockChain);
  
  return { selectFn, mockChain };
};

export const createMockContext = (
  user?: Partial<User>,
  session?: Partial<Session>
): any => {
  const mockUser = user ? { 
    id: 'test-user-id', 
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...user 
  } as User : null;
  const mockSession = session ? { id: 'test-session-id', userId: mockUser?.id || 'test-user-id', ...session } as Session : null;
  
  // Create the select mock
  const { selectFn, mockChain } = createSelectMock([]);

  return {
    session: mockSession ? { ...mockSession, user: mockUser } : null,
    authApi: {
      getSession: vi.fn().mockResolvedValue(mockSession ? { ...mockSession, user: mockUser } : null),
    },
    db: {
      query: {
        exercises: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        businessExercise: {
          findMany: vi.fn(),
        },
        user: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        Post: {
          findMany: vi.fn(),
        },
        TrainingSession: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        UserTrainingSession: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
      // For direct queries
      businessExercise: {
        findMany: vi.fn(),
      },
      exercise: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      // New select pattern for business filtering
      select: selectFn,
      selectMockChain: mockChain, // Expose for test configuration
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
    } as any,
  };
};

export const createAuthenticatedContext = (
  role: 'trainer' | 'client' = 'client',
  businessId: string | null = 'test-business-id'
): any => {
  const user = mockUser({ role, businessId });
  const session = mockSession({ userId: user.id });
  
  return createMockContext(user, session);
};

export const createCaller = (ctx: any): ReturnType<typeof appRouter.createCaller> => {
  return appRouter.createCaller(ctx);
};