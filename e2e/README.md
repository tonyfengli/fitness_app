# E2E Tests

This directory contains end-to-end tests using Playwright.

## Test Structure

```
e2e/
├── auth/                 # Authentication flow tests
│   ├── login.spec.ts    # Login functionality
│   ├── signup.spec.ts   # User registration
│   └── logout.spec.ts   # Logout functionality
├── workouts/            # Workout-related tests
│   └── create.spec.ts   # Workout creation with auth
├── fixtures/            # Test fixtures and helpers
│   └── auth.ts         # Authentication helpers
└── README.md
```

## Running Tests

```bash
# Install browsers (first time only)
npx playwright install

# Run all tests
pnpm test:e2e

# Run tests in UI mode
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e auth/login.spec.ts

# Run tests in headed mode (see browser)
pnpm test:e2e --headed
```

## Writing Tests

Tests use Playwright's test runner with TypeScript support. Example:

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  // ... test implementation
});
```