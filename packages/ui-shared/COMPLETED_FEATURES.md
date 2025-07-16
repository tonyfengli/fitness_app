# Completed Workout Management Features

This document comprehensively details all the workout management features that have been successfully implemented in the fitness app. These features span across multiple packages and provide a complete solution for workout creation, management, and manipulation.

## Table of Contents
1. [API Mutations](#api-mutations)
2. [Shared UI Hooks](#shared-ui-hooks)
3. [Test Coverage](#test-coverage)
4. [Architecture Decisions](#architecture-decisions)
5. [Integration Examples](#integration-examples)

## API Mutations

### Location: `packages/api/src/router/workout.ts`

The workout router now includes comprehensive mutations for workout management:

#### 1. Delete Exercise (`deleteExercise`)
- **Purpose**: Remove a specific exercise from a workout
- **Features**:
  - Validates workout exists and user has access
  - Automatically reorders remaining exercises in the same block
  - Uses transactions for atomic operations
  - Maintains block/group integrity
- **Input**: `workoutId`, `workoutExerciseId`
- **Authorization**: Workout owner or trainer only

#### 2. Update Exercise Order (`updateExerciseOrder`)
- **Purpose**: Move exercises up or down within their block
- **Features**:
  - Swaps orderIndex values between exercises
  - Enforces block boundaries (can't move between blocks)
  - Validates movement boundaries (can't move beyond first/last position)
  - Transaction-based for consistency
- **Input**: `workoutId`, `workoutExerciseId`, `direction` ('up' | 'down')
- **Authorization**: Workout owner or trainer only

#### 3. Delete Block (`deleteBlock`)
- **Purpose**: Remove an entire exercise block/group
- **Features**:
  - Deletes all exercises within a block
  - Prevents deletion of the last remaining block
  - Validates block existence
- **Input**: `workoutId`, `groupName`
- **Authorization**: Workout owner or trainer only

#### 4. Delete Workout (`deleteWorkout`)
- **Purpose**: Remove an entire workout
- **Features**:
  - Cascade deletes all associated workout exercises
  - Prevents deletion of assessment workouts
  - Validates business scope
- **Input**: `workoutId`
- **Authorization**: Workout owner or trainer only

#### 5. Replace Exercise (`replaceExercise`)
- **Purpose**: Swap one exercise for another
- **Features**:
  - Validates new exercise exists and is available to business
  - Maintains all existing exercise properties (sets, order, group)
  - Atomic replacement operation
- **Input**: `workoutId`, `workoutExerciseId`, `newExerciseId`
- **Authorization**: Workout owner or trainer only

#### 6. Add Exercise (`addExercise`)
- **Purpose**: Insert a new exercise into an existing workout
- **Features**:
  - Add to beginning or end of any block
  - Automatically adjusts orderIndex for all affected exercises
  - Creates new blocks if needed
  - Configurable sets parameter
- **Input**: `workoutId`, `exerciseId`, `groupName`, `position`, `sets`
- **Authorization**: Workout owner or trainer only

#### 7. Duplicate Workout (`duplicateWorkout`)
- **Purpose**: Create a copy of an existing workout
- **Features**:
  - Can duplicate to same or different user (within business)
  - Copies all exercises with their properties
  - Preserves workout structure and configuration
  - New workout starts as uncompleted
  - Customizable notes for the duplicate
- **Input**: `workoutId`, `targetUserId?`, `notes?`
- **Authorization**: Trainer only (for cross-user duplication)

## Shared UI Hooks

### Location: `packages/ui-shared/src/hooks/`

Platform-agnostic React hooks that work with any API implementation:

#### 1. `useWorkoutMutations`
- **Purpose**: Low-level hook providing wrapped mutation functions
- **Features**:
  - Automatic cache invalidation on success
  - Consistent error handling
  - Loading state aggregation
  - Platform-agnostic API interface
- **Exports**:
  - Individual mutation functions
  - Raw mutation objects for advanced use
  - Aggregated `isLoading` state

#### 2. `useWorkoutActions`
- **Purpose**: High-level hook with optimistic updates and toast notifications
- **Features**:
  - Optimistic UI updates for instant feedback
  - Automatic rollback on errors
  - Toast notifications for all actions
  - Action-specific loading states
  - Success/error callbacks
- **Key Methods**:
  - `deleteExercise`: Remove with optimistic update
  - `reorderExercise`: Move with instant UI feedback
  - `deleteBlock`: Remove entire block optimistically
  - `deleteWorkout`: Delete with navigation callback
  - `replaceExercise`: Swap with optimistic update
  - `addExercise`: Insert with instant UI update
  - `duplicateWorkout`: Copy with success callback

#### 3. `useOptimisticWorkout`
- **Purpose**: Manages optimistic updates and rollbacks
- **Features**:
  - Local state management for instant UI updates
  - Snapshot-based rollback mechanism
  - Preserves original data for error recovery
  - Works with workout query data
- **Methods**:
  - `optimisticDeleteExercise`
  - `optimisticReorderExercise`
  - `optimisticDeleteBlock`
  - `optimisticReplaceExercise`
  - `optimisticAddExercise`
  - `rollback`: Restore original state

#### 4. `useWorkoutBlocks`
- **Purpose**: Transform flat exercise list into block structure
- **Features**:
  - Groups exercises by `groupName`
  - Maintains exercise order within blocks
  - Provides block-level operations
  - Real-time block statistics
- **Returns**:
  - Organized block structure
  - Block metadata (exercise count, etc.)

#### 5. `useExerciseSelection`
- **Purpose**: Manage exercise selection for replacement/addition
- **Features**:
  - Search and filter available exercises
  - Business-scoped exercise list
  - Selection state management
  - Integration with exercise queries

## Test Coverage

### API Tests
**Location**: `packages/api/test/`

1. **workout-mutations.test.ts**
   - Complete coverage of all mutation endpoints
   - Error handling scenarios
   - Business scope validation
   - Authorization checks
   - Transaction integrity tests

2. **workout-mutations-phase2.test.ts**
   - Advanced mutation scenarios
   - Complex reordering operations
   - Edge cases and boundary conditions

### UI Hook Tests
**Location**: `packages/ui-shared/test/hooks/`

1. **useWorkoutMutations.test.ts**
   - Mutation wrapper functionality
   - Cache invalidation logic
   - Error propagation
   - Loading state management

2. **useWorkoutActions.test.ts**
   - Optimistic update behavior
   - Toast notification triggers
   - Rollback mechanisms
   - Callback execution

3. **useOptimisticWorkout.test.ts**
   - State snapshot management
   - Rollback functionality
   - Data transformation logic

4. **useWorkoutBlocks.test.ts**
   - Block grouping algorithm
   - Order preservation
   - Dynamic block updates

## Architecture Decisions

### 1. Transaction-Based Operations
All mutations use database transactions to ensure data consistency:
- Atomic operations for multi-step processes
- Automatic rollback on failures
- Consistent state across related tables

### 2. Optimistic Updates
UI updates happen immediately while mutations process:
- Instant user feedback
- Automatic rollback on errors
- Snapshot-based recovery mechanism
- Seamless error handling

### 3. Platform-Agnostic Design
Shared hooks work with any API implementation:
- Generic API interface
- Configurable toast system
- Framework-independent logic
- Reusable across web/mobile

### 4. Business Scope Enforcement
All operations respect business boundaries:
- Automatic business ID validation
- Cross-business operation prevention
- Trainer/client permission model

### 5. Smart Reordering
Exercise order management with constraints:
- Block-scoped movements only
- Automatic index recalculation
- Boundary validation
- Gap-free ordering

## Integration Examples

### Basic Usage with tRPC
```typescript
import { useWorkoutActions } from '@acme/ui-shared/hooks';
import { api } from '~/utils/api';

function WorkoutEditor({ workoutId }) {
  const actions = useWorkoutActions({
    workoutId,
    api,
    toast: {
      showToast: (message, type) => {
        // Your toast implementation
      }
    },
    onDeleteWorkoutSuccess: () => {
      // Navigate away
    }
  });

  // Use actions in your UI
  const handleDelete = (exerciseId) => {
    actions.deleteExercise(exerciseId);
  };
}
```

### Advanced Optimistic Updates
```typescript
function ExerciseList({ workoutId }) {
  const { data: workout } = api.workout.getById.useQuery({ id: workoutId });
  const actions = useWorkoutActions({ workoutId, api });
  
  // Optimistic updates show immediately
  const exercises = actions.workout?.exercises || workout?.exercises || [];
  
  return exercises.map(exercise => (
    <ExerciseCard
      key={exercise.id}
      exercise={exercise}
      onDelete={() => actions.deleteExercise(exercise.id)}
      onMoveUp={() => actions.reorderExercise(exercise.id, 'up')}
      onMoveDown={() => actions.reorderExercise(exercise.id, 'down')}
    />
  ));
}
```

### Block Management
```typescript
import { useWorkoutBlocks } from '@acme/ui-shared/hooks';

function WorkoutBlocks({ exercises }) {
  const blocks = useWorkoutBlocks(exercises);
  
  return blocks.map(block => (
    <div key={block.name}>
      <h3>{block.name} ({block.exercises.length} exercises)</h3>
      <button onClick={() => actions.deleteBlock(workoutId, block.name)}>
        Delete Block
      </button>
    </div>
  ));
}
```

## Summary

The completed workout management system provides:

1. **Complete CRUD Operations**: All necessary mutations for workout manipulation
2. **Optimistic UI**: Instant feedback with automatic error recovery
3. **Platform Agnostic**: Reusable hooks work across web and mobile
4. **Robust Testing**: Comprehensive test coverage for reliability
5. **Smart Constraints**: Business rules enforced at API level
6. **Developer Friendly**: Clear APIs with TypeScript support

This implementation represents a production-ready workout management system that balances user experience with data integrity and provides a solid foundation for future enhancements.