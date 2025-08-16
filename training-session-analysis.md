# Training-Session.ts Database Query Pattern Analysis

## 1. Query Method Usage Count

### ctx.db.query Usage
- **Total occurrences**: 41 instances
- Primary tables queried:
  - `TrainingSession`: 18 instances
  - `UserTrainingSession`: 13 instances
  - `Workout`: 2 instances
  - `WorkoutExercise`: 2 instances
  - `WorkoutPreferences`: 1 instance
  - `user`: 1 instance
  - `exercises`: 2 instances

### ctx.db.select/insert/update/delete Usage
- **select()**: 15 instances
- **insert()**: 3 instances
- **update()**: 5 instances
- **delete()**: 8 instances

## 2. UserTrainingSession Query Patterns

### Query Builder Usage (ctx.db.query)
- `findFirst`: 11 instances
- `findMany`: 3 instances

### Direct Operations
- `select`: 3 instances
- `insert`: 1 instance
- `update`: 3 instances
- `delete`: 2 instances

## 3. Pattern: Query Builder After Database Updates

Found a critical pattern where query builder is used immediately after updates:

```typescript
// Line 2335-2350: markAllClientsAsReady
const result = await ctx.db
  .update(UserTrainingSession)
  .set({ status: 'ready' })
  .where(
    and(
      eq(UserTrainingSession.trainingSessionId, input.sessionId),
      eq(UserTrainingSession.status, 'checked_in')
    )
  );

// Immediately after update, query is used to get updated data
const allUserSessions = await ctx.db.query.UserTrainingSession.findMany({
  where: eq(UserTrainingSession.trainingSessionId, input.sessionId),
});
```

This pattern appears in multiple places where after an update/insert/delete operation, the code uses `ctx.db.query` to fetch the updated state.

## 4. Error Handling Patterns

Error handling is implemented using try-catch blocks in several places:
- Lines 791-795: Error handling for delete operations
- Lines 850-853: Basic error handling
- Lines 1087-1207: Nested try-catch for complex operations
- Lines 1273-1276: Error handling for batch operations

Most error handling follows this pattern:
```typescript
try {
  // database operations
} catch (error) {
  console.error('Operation failed:', error);
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Error message'
  });
}
```

## 5. Relationship Queries with Query Builder

Complex relationship queries are found using the `with` clause:

```typescript
// Lines 3307-3320: Complex nested relationships
const fullSession = await ctx.db.query.TrainingSession.findFirst({
  where: eq(TrainingSession.id, input.sessionId),
  with: {
    workouts: {
      with: {
        exercises: {
          with: {
            exercise: true
          }
        }
      }
    }
  }
});
```

This pattern is used to fetch deeply nested relationships in a single query, particularly for:
- Session with workouts and exercises
- UserTrainingSession with user details
- Workout preferences with user information

## Key Findings

1. **Heavy Query Builder Usage**: The file uses `ctx.db.query` (41 times) more frequently than direct operations (31 times combined).

2. **Post-Update Query Pattern**: There's a consistent pattern of using query builder after update operations to fetch the updated state, which could potentially be optimized.

3. **Complex Relationships**: The query builder is extensively used for fetching relationships, especially for nested data structures.

4. **Mixed Approaches**: The codebase mixes query builder and direct operations, sometimes within the same function.

5. **Error Handling**: While error handling exists, it's not consistently applied across all database operations.