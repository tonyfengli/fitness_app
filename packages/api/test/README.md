# API Backend Tests

This directory contains minimal backend test coverage for the fitness app's critical paths.

## Test Coverage (7 tests total)

### 1. Auth Flow Tests (`auth.test.ts`)
- ✅ Session includes role and businessId
- ✅ Role checking returns correct values (trainer/client)
- ✅ Unauthenticated requests are properly handled

### 2. Role-Based Access Tests (`role-based-access.test.ts`)
- ✅ Trainer role can access all routes
- ✅ Client role has restricted access
- ⚠️ Exercise endpoints need proper mocking

### 3. Workout Engine Tests (`workout-engine.test.ts`)
- Tests that filterExercisesFromInput requires authentication
- Tests that exercises are scoped to user's businessId
- Tests that businessId comes from session, not input

### 4. Business Scoping Tests (`business-scoping.test.ts`)
- Tests that users in Business A only see Business A data
- Tests that users in Business B only see Business B data
- Tests prevention of cross-business data access

## Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run only API tests
cd packages/api && pnpm test

# Run tests in watch mode
cd packages/api && pnpm test:watch

# Run with coverage
cd packages/api && pnpm test:coverage
```

## Test Structure

- Uses Vitest as the test runner
- Mocks BetterAuth, Drizzle ORM, and AI modules
- Focuses on API logic without hitting real databases
- Tests authentication, authorization, and business scoping

## Known Issues

Some tests may fail due to missing mock implementations. The test structure is in place and demonstrates the testing approach for:
- Authentication flows
- Role-based access control
- Business data isolation
- Protected endpoints

To fix failing tests, ensure proper mocking of:
- Database queries (especially for exercises)
- AI filter functions
- Auth session management