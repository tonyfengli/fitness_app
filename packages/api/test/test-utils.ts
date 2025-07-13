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

export const createMockContext = (
  user?: Partial<User>,
  session?: Partial<Session>
): any => {
  const mockUser = user ? { id: 'test-user-id', ...user } as User : null;
  const mockSession = session ? { id: 'test-session-id', userId: mockUser?.id || 'test-user-id', ...session } as Session : null;

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
    } as any,
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
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve([])),
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
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

export const createCaller = (ctx: any) => {
  return appRouter.createCaller(ctx);
};