# Shared Business Logic Documentation

This document outlines the business logic that has been extracted from the Next.js application and moved to the `@acme/ui-shared` package for cross-platform use between web and native applications.

## Overview

The shared business logic architecture enables code reuse between the Next.js web application and React Native mobile applications. This approach ensures consistency in data handling, state management, and business rules across all platforms.

## Latest Updates

### Add Exercise Feature (Added: 2025-01-29)
- New mutation: `addClientExercise` - allows clients to add exercises to their includeExercises preferences
- Modal state management for Add Exercise modal
- Optimistic updates when adding exercises
- Real-time synchronization across all clients

## Architecture

### Package Structure

```
packages/ui-shared/
├── src/
│   ├── hooks/
│   │   ├── useClientPreferences.ts
│   │   └── useRealtimePreferences.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

## Shared Hooks

### 1. useClientPreferences

**Location:** `packages/ui-shared/src/hooks/useClientPreferences.ts`

**Purpose:** Manages all client preference operations including fetching, updating, and optimistic updates for workout preferences.

**Key Features:**
- Fetches client deterministic selections
- Handles exercise toggling with optimistic updates
- Manages realtime preference updates
- Platform-agnostic implementation

**Usage Example:**
```typescript
import { useClientPreferences } from '@acme/ui-shared';
import { supabase } from '~/lib/supabase'; // Platform-specific

function ClientPreferencePage() {
  const { 
    selections, 
    isLoading, 
    error, 
    handleToggleExercise 
  } = useClientPreferences({
    sessionId: 'session-uuid',
    userId: 'user-uuid',
    trpc: trpcClient, // Platform-specific tRPC client
    supabase: supabase, // Platform-specific Supabase client
  });

  // Use the data and handlers in your UI
}
```

**Interface:**
```typescript
interface UseClientPreferencesOptions {
  sessionId: string;
  userId: string;
  trpc: any; // tRPC client instance
  supabase: SupabaseClient;
}

interface UseClientPreferencesReturn {
  // Data
  selections: ClientDeterministicSelections | undefined;
  availableExercises: Exercise[] | undefined;
  exercises: Exercise[];
  isLoading: boolean;
  error: Error | null;
  
  // Modal state - Exercise Change
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  selectedExerciseForChange: { name: string; index: number; round?: string } | null;
  setSelectedExerciseForChange: (exercise: { name: string; index: number; round?: string } | null) => void;
  
  // Modal state - Add Exercise
  addModalOpen: boolean;
  setAddModalOpen: (open: boolean) => void;
  
  // Actions
  handleToggleExercise: (blockId: string, exerciseName: string) => Promise<void>;
  handleExerciseReplacement: (newExerciseName: string) => Promise<void>;
  handleAddExercise: (exerciseName: string) => Promise<void>;
  
  // State
  isTogglingExercise: boolean;
  isProcessingChange: boolean;
  isAddingExercise: boolean;
}
```

### 2. useRealtimePreferences

**Location:** `packages/ui-shared/src/hooks/useRealtimePreferences.ts`

**Purpose:** Provides realtime updates for workout preferences using Supabase Realtime subscriptions.

**Key Features:**
- Subscribes to workout preference changes
- Handles connection state management
- Provides error handling
- Automatic cleanup on unmount

**Usage Example:**
```typescript
import { useRealtimePreferences } from '@acme/ui-shared';
import { supabase } from '~/lib/supabase'; // Platform-specific

function TrainerDashboard() {
  const { isConnected, error } = useRealtimePreferences({
    sessionId: 'session-uuid',
    supabase: supabase,
    onPreferenceUpdate: (update) => {
      console.log('Client preferences updated:', update);
      // Handle the update (e.g., invalidate queries, update UI)
    },
    onError: (error) => {
      console.error('Realtime error:', error);
    }
  });

  // Show connection status in UI
}
```

**Interface:**
```typescript
interface PreferenceUpdate {
  userId: string;
  preferences: {
    intensity?: string | null;
    muscleTargets?: string[] | null;
    muscleLessens?: string[] | null;
    includeExercises?: string[] | null;
    avoidExercises?: string[] | null;
    avoidJoints?: string[] | null;
    sessionGoal?: string | null;
  };
  updatedAt: string;
}

interface UseRealtimePreferencesOptions {
  sessionId: string;
  supabase: SupabaseClient;
  onPreferenceUpdate: (data: PreferenceUpdate) => void;
  onError?: (error: Error) => void;
}
```

## Data Flow

### 1. Client Preferences Flow

```
User Action → useClientPreferences → Optimistic Update → tRPC Mutation → Database Update
                                           ↓
                                    Immediate UI Update
```

### 2. Realtime Updates Flow

```
Database Change → Supabase Realtime → useRealtimePreferences → onPreferenceUpdate Callback → UI Update
```

## Platform-Specific Integration

### Web (Next.js)

```typescript
// apps/nextjs/src/app/preferences/client/[sessionId]/[userId]/page.tsx
import { useClientPreferences } from '@acme/ui-shared';
import { useTRPC } from '~/trpc/react';
import { supabase } from '~/lib/supabase';

export default function ClientPreferencePage() {
  const trpc = useTRPC();
  
  const {
    selections,
    isLoading,
    handleToggleExercise
  } = useClientPreferences({
    sessionId,
    userId,
    trpc,
    supabase
  });
  
  // Render web-specific UI
}
```

### Native (React Native)

```typescript
// apps/expo/src/screens/ClientPreferences.tsx
import { useClientPreferences } from '@acme/ui-shared';
import { trpc } from '../utils/api';
import { supabase } from '../utils/supabase';

export function ClientPreferencesScreen() {
  const {
    selections,
    isLoading,
    handleToggleExercise
  } = useClientPreferences({
    sessionId,
    userId,
    trpc,
    supabase
  });
  
  // Render native-specific UI
}
```

## Key Benefits

1. **Code Reusability**: Business logic is written once and used across platforms
2. **Consistency**: Same behavior and data handling on web and mobile
3. **Maintainability**: Updates to business logic are reflected everywhere
4. **Type Safety**: Shared TypeScript interfaces ensure type consistency
5. **Testing**: Business logic can be tested independently of UI

## Migration Guide

### Moving Logic to Shared Package

1. **Identify Platform-Agnostic Logic**
   - Data fetching and mutations
   - State management
   - Business rules and calculations
   - Data transformations

2. **Extract Dependencies**
   - Make platform-specific dependencies injectable (tRPC, Supabase)
   - Use interfaces for dependency injection

3. **Create Shared Hook**
   ```typescript
   export function useSharedLogic(deps: Dependencies) {
     // Platform-agnostic implementation
   }
   ```

4. **Update Imports**
   ```typescript
   // Before
   import { useLogic } from '../hooks/useLogic';
   
   // After
   import { useLogic } from '@acme/ui-shared';
   ```

## Best Practices

1. **Keep UI Separate**: Shared hooks should only contain business logic, not UI components
2. **Inject Dependencies**: Platform-specific services should be injected, not imported
3. **Use Common Types**: Define shared types in the validators package
4. **Handle Errors Gracefully**: Provide consistent error handling across platforms
5. **Document Interfaces**: Clearly document all hook options and return types

## Future Enhancements

1. **Additional Shared Hooks**
   - `useSessionManagement`: Handle session creation and management
   - `useWorkoutBuilder`: Shared workout creation logic
   - `useMessaging`: SMS and notification handling

2. **Shared Utilities**
   - Date formatting
   - Exercise filtering
   - Preference calculations

3. **State Management**
   - Consider adding Zustand or Redux for complex shared state
   - Implement offline support with persistence

## Testing

Shared hooks can be tested independently:

```typescript
// packages/ui-shared/src/hooks/__tests__/useClientPreferences.test.ts
import { renderHook } from '@testing-library/react-hooks';
import { useClientPreferences } from '../useClientPreferences';

describe('useClientPreferences', () => {
  it('handles exercise toggling with optimistic updates', async () => {
    // Test implementation
  });
});
```

## Add Exercise Feature Implementation

### Overview
The Add Exercise feature allows clients to add new exercises to their workout preferences. This is implemented through:

1. **Shared Hook Updates** (`useClientPreferences`):
   - Added modal state management (`addModalOpen`, `setAddModalOpen`)
   - Created `addExerciseMutation` with optimistic updates
   - Added `handleAddExercise` function
   - Tracks loading state with `isAddingExercise`

2. **API Mutation** (`addClientExercise`):
   - Verifies user belongs to session
   - Adds exercise to `includeExercises` array
   - Creates preferences if they don't exist
   - Prevents duplicate exercises
   - Invalidates blueprint cache for real-time updates

3. **Usage in Web App**:
```typescript
const {
  addModalOpen,
  setAddModalOpen,
  handleAddExercise,
  isAddingExercise,
  availableExercises,
  exercises
} = useClientPreferences({ sessionId, userId, trpc });

// In your UI
<button onClick={() => setAddModalOpen(true)}>
  Add Exercise
</button>

<AddExerciseModal
  isOpen={addModalOpen}
  onClose={() => setAddModalOpen(false)}
  availableExercises={availableExercises}
  existingExercises={exercises.filter(ex => ex.isActive).map(ex => ex.name)}
  onConfirm={handleAddExercise}
  isLoading={isAddingExercise}
/>
```

4. **Usage in Native App**:
```typescript
// Same hook usage, different UI implementation
const { addModalOpen, setAddModalOpen, handleAddExercise } = useClientPreferences({ sessionId, userId, trpc });

// React Native modal implementation
<Modal visible={addModalOpen} onRequestClose={() => setAddModalOpen(false)}>
  {/* Native UI components */}
</Modal>
```

## Technical Implementation Details

### useClientPreferences Implementation

```typescript
// packages/ui-shared/src/hooks/useClientPreferences.ts
'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimePreferences } from './useRealtimePreferences';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useClientPreferences({
  sessionId,
  userId,
  trpc,
  supabase
}: UseClientPreferencesOptions) {
  const queryClient = useQueryClient();
  const [isTogglingExercise, setIsTogglingExercise] = useState(false);

  // Fetch client selections
  const selectionsQueryOptions = trpc.trainingSession.getClientDeterministicSelections.queryOptions({ 
    sessionId, 
    userId 
  });
  
  const { data: selections, isLoading, error } = useQuery(selectionsQueryOptions);

  // Toggle exercise mutation
  const toggleExerciseMutation = useMutation({
    ...trpc.trainingSession.toggleClientExercise.mutationOptions(),
    onMutate: async ({ sessionId, userId, blockId, exerciseName, isSelected }) => {
      // Optimistic update implementation
      const queryKey = selectionsQueryOptions.queryKey;
      const previousData = queryClient.getQueryData(queryKey);
      
      // Update cache optimistically
      queryClient.setQueryData(queryKey, (old: any) => {
        // Transform data for optimistic update
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(selectionsQueryOptions.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: selectionsQueryOptions.queryKey });
    }
  });

  // Realtime updates
  useRealtimePreferences({
    sessionId,
    supabase,
    onPreferenceUpdate: useCallback((update) => {
      if (update.userId === userId) {
        queryClient.invalidateQueries({ queryKey: selectionsQueryOptions.queryKey });
      }
    }, [userId, queryClient, selectionsQueryOptions.queryKey])
  });

  const handleToggleExercise = async (blockId: string, exerciseName: string) => {
    // Implementation details
  };

  return {
    selections,
    isLoading,
    error,
    isTogglingExercise,
    handleToggleExercise
  };
}
```

### Key Implementation Patterns

1. **Optimistic Updates with tRPC**
   - Use the exact query key from `queryOptions` for cache updates
   - Store previous data for rollback on error
   - Invalidate queries after mutation settles

2. **Realtime Integration**
   - Subscribe to Supabase Realtime within the hook
   - Invalidate relevant queries when updates are received
   - Use callbacks to avoid re-subscriptions

3. **Error Handling**
   - Rollback optimistic updates on mutation errors
   - Propagate errors to the UI for user feedback
   - Log errors for debugging

## Common Pitfalls and Solutions

### 1. Query Key Mismatch

**Problem:** Manual query key construction doesn't match tRPC's generated keys
```typescript
// ❌ Wrong
const queryKey = [['trainingSession', 'getClientDeterministicSelections'], { input: { sessionId, userId } }];
```

**Solution:** Use tRPC's generated query options
```typescript
// ✅ Correct
const queryKey = selectionsQueryOptions.queryKey;
```

### 2. Platform-Specific Imports

**Problem:** Importing platform-specific modules in shared code
```typescript
// ❌ Wrong - in shared package
import { supabase } from '~/lib/supabase';
```

**Solution:** Inject dependencies
```typescript
// ✅ Correct - in shared package
export function useSharedHook({ supabase }: { supabase: SupabaseClient }) {
  // Use injected supabase
}
```

### 3. Missing "use client" Directive

**Problem:** Hooks using React features without client directive
```typescript
// ❌ Wrong
import { useState } from 'react';
export function useSharedHook() { /* ... */ }
```

**Solution:** Add "use client" directive
```typescript
// ✅ Correct
'use client';
import { useState } from 'react';
export function useSharedHook() { /* ... */ }
```

## Debugging Tips

1. **Enable Query Devtools**
   ```typescript
   // See all queries and their states
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
   ```

2. **Log Realtime Events**
   ```typescript
   console.log('[useRealtimePreferences] Event received:', payload.eventType);
   ```

3. **Check Query Keys**
   ```typescript
   console.log('Query key:', selectionsQueryOptions.queryKey);
   ```

## Performance Considerations

1. **Debounce Rapid Updates**
   - Use `setTimeout` to delay realtime subscriptions
   - Batch multiple updates together

2. **Selective Invalidation**
   - Only invalidate queries for the specific user
   - Use query predicates for precise targeting

3. **Stale Time Configuration**
   - Set appropriate `staleTime` to reduce unnecessary refetches
   - Use `refetchOnMount: 'always'` for critical data

## Conclusion

The shared business logic architecture provides a solid foundation for building consistent, maintainable applications across web and mobile platforms. By extracting core functionality into the `ui-shared` package, we ensure that business rules remain synchronized and reduce code duplication across the codebase.