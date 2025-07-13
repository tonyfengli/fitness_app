import { afterEach, vi } from 'vitest';

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret';
process.env.AUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test@localhost/test';