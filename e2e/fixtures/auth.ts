import { test as base } from '@playwright/test';

// Define the user types
export type UserRole = 'trainer' | 'client';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

// Test users that should be seeded in the database
export const testUsers = {
  trainer: {
    email: 'trainer@test.com',
    password: 'password123',
    name: 'Test Trainer',
    role: 'trainer' as UserRole,
  },
  client: {
    email: 'client@test.com', 
    password: 'password123',
    name: 'Test Client',
    role: 'client' as UserRole,
  },
};

// Extend the base test with auth helpers
export const test = base.extend<{
  authenticatedPage: any;
}>({
  authenticatedPage: async ({ page }, use, testInfo) => {
    // Determine which user to use based on test title or metadata
    const userRole = testInfo.title.includes('trainer') ? 'trainer' : 'client';
    const user = testUsers[userRole];

    // Log in before the test
    await page.goto('/login');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(userRole === 'trainer' ? '/trainer-dashboard' : '/client-dashboard');

    // Use the authenticated page in the test
    await use(page);
  },
});

export { expect } from '@playwright/test';