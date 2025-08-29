# Exercise Swap Flow Analysis

## Overview
The exercise swap functionality allows clients to replace exercises in their workout through a public TRPC endpoint. The system handles both individual and shared (circuit) exercises with real-time updates.

## 1. TRPC Endpoint: `swapExercisePublic`

### Location
`/packages/api/src/router/workout-selections.ts` (lines 275-400)

### Input Schema
```typescript
{
  sessionId: string,
  clientId: string,
  originalExerciseId: string,
  newExerciseId: string,
  reason?: string
}
```

### Process Flow
1. **Client Verification** (lines 288-307)
   - Verifies client is checked into the session
   - Checks for status: "checked_in", "ready", or "workout_ready"
   - Throws NOT_FOUND error if client not properly checked in

2. **Exercise Validation** (lines 309-320)
   - Fetches the new exercise from database to ensure it exists
   - Gets exercise name for the selection record

3. **Transaction Operations** (lines 322-399)
   - **Swap Logging** (lines 323-343)
     - Records swap in `workout_exercise_swaps` table
     - Stores: sessionId, clientId, original/new exerciseId, reason, timestamp
     - Sets `swappedBy` as the client themselves
   
   - **Workout Lookup** (lines 346-376)
     - Finds the client's workout (draft, ready, or completed status)
     - Ensures workout exists before proceeding
   
   - **Exercise Update** (lines 379-392)
     - Updates the `workout_exercise` table
     - Sets new exerciseId
     - **Important**: Sets `isShared: false` and `sharedWithClients: null`
     - Updates `selectionSource` to "manual_swap"

## 2. Client-Side Implementation

### Location
`/apps/nextjs/src/app/client-workout-overview/page.tsx`

### Key Components
- **Mutation Setup** (lines 68-142)
  - Uses `trpc.workoutSelections.swapExercisePublic.mutationOptions()`
  - Implements optimistic updates for immediate UI feedback
  - Handles rollback on error

- **Real-time Updates** (lines 198-215)
  - Uses `useRealtimeExerciseSwaps` hook
  - Listens for swap events on the session
  - Invalidates queries to refresh data when swaps occur

## 3. Database Schema

### workout_exercise_swaps Table
```sql
- id: UUID (primary key)
- training_session_id: UUID (references TrainingSession)
- client_id: TEXT (references user)
- original_exercise_id: UUID (references exercises)
- new_exercise_id: UUID (references exercises)
- swap_reason: VARCHAR(255)
- swapped_at: TIMESTAMP
- swapped_by: TEXT (references user)
```

### workout_exercise Table (relevant fields)
```sql
- isShared: BOOLEAN (default false)
- sharedWithClients: TEXT[] (array of client IDs)
- selectionSource: VARCHAR(50) ('llm_phase1', 'manual_swap', 'pre_assigned')
```

## 4. Real-time Update Mechanism

### Hook: `useRealtimeExerciseSwaps`
Location: `/packages/ui-shared/src/hooks/useRealtimeExerciseSwaps.ts`

- Creates Supabase real-time channel for session
- Listens to INSERT events on `workout_exercise_swaps` table
- Fetches exercise names when swap detected
- Triggers callback with swap details

## 5. Circuit-Specific Considerations

### Current Implementation
1. **No Special Circuit Handling**
   - The swap logic treats all exercises the same
   - When a shared exercise is swapped, it becomes individual (`isShared: false`)
   - No propagation to other clients sharing the exercise

2. **Circuit Exercise Creation**
   - Initially created with `isShared: true`
   - `sharedWithClients` contains array of other client IDs
   - All circuit exercises marked as shared during generation

3. **Post-Swap Behavior**
   - Swapped exercise is no longer shared
   - Other clients keep the original exercise
   - Creates divergence in circuit synchronization

## 6. Data Storage

### Swap History
- All swaps recorded in `workout_exercise_swaps` table
- Includes timestamp, reason, and who performed the swap
- Can be queried via `getSwapHistory` endpoint

### Exercise State
- Updated directly in `workout_exercise` table
- Original exercise reference lost (except in swap history)
- Selection source changed to "manual_swap"

## 7. Client vs Trainer Swaps

### Client Swaps (swapExercisePublic)
- No authentication required (public endpoint)
- Client must be checked into session
- `swappedBy` set to client's ID
- Limited to own exercises

### Trainer Swaps (swapExercise)
- Requires authentication (protected endpoint)
- Can swap for any client in session
- `swappedBy` set to trainer's ID
- Same underlying logic

## 8. Limitations & Considerations

1. **No Circuit Synchronization**
   - Shared exercises become individual after swap
   - No option to maintain sharing with new exercise
   - Other clients unaffected by swap

2. **No Undo Mechanism**
   - Swaps are permanent
   - History tracked but no built-in reversal

3. **No Equipment/Space Validation**
   - New exercise not validated against constraints
   - Could introduce equipment conflicts

4. **Template Config Not Updated**
   - Comment indicates skipping templateConfig update
   - Visualization data may become stale

## 9. Query Invalidation

After successful swap:
- `workoutSelections.getSelectionsPublic`
- `trainingSession.getSavedVisualizationDataPublic`

This ensures UI reflects latest exercise selections.