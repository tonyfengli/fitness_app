# E2E Tests

This directory contains end-to-end tests using Playwright.

## Setup

### 1. Create a Test User

Before running E2E tests, you need to create a test user:

1. Start the development server:
   ```bash
   pnpm dev:next
   ```

2. Go to http://localhost:3000/signup

3. Create a trainer account with:
   - Email: `test-trainer@example.com`
   - Password: `test-password`
   - Or use your own credentials and set environment variables

### 2. Configure Test Credentials (Optional)

If you want to use different credentials, set these environment variables:

```bash
export TEST_TRAINER_EMAIL="your-test-email@example.com"
export TEST_TRAINER_PASSWORD="your-test-password"
```

## Running Tests

### From the Next.js directory:
```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (see tests running)
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# Use the helper script (includes prompts)
./test-e2e.sh
```

### From the root directory:
```bash
pnpm test:e2e
```

## Test Structure

- `helpers/auth.ts` - Authentication helper functions
- `global-setup.ts` - Runs before all tests to handle authentication
- `*.spec.ts` - Test files

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e` directory
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write your tests - authentication is handled automatically!

## Troubleshooting

### Tests timing out?
- Make sure the dev server is running
- Check that you've created the test user
- Verify the test user credentials match

### Authentication failing?
- Delete `playwright/.auth/user.json` and try again
- Make sure the test user exists in the database
- Check that the credentials are correct