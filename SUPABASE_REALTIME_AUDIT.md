# Supabase Real-time Subscriptions Audit - Workout Preferences

## Overview
This audit examines how Supabase real-time subscriptions work for workout preferences in the fitness app, covering both TV and web implementations.

## 1. Real-time Hook Implementation

### useRealtimePreferences Hook

**Location**: `packages/ui-shared/src/hooks/useRealtimePreferences.ts`

**Key Features**:
- Creates a channel named `preferences-${sessionId}`
- Listens to INSERT and UPDATE events on the `workout_preferences` table
- Filters by `training_session_id` 
- Transforms database columns to camelCase format
- Handles connection states (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)
- Uses refs to avoid re-subscribing on callback changes
- Implements 100ms delay to prevent rapid re-renders

**Data Transformation**:
```typescript
{
  userId: preferences.user_id,
  preferences: {
    intensity: preferences.intensity,
    muscleTargets: preferences.muscle_targets,
    muscleLessens: preferences.muscle_lessens,
    includeExercises: preferences.include_exercises,
    avoidExercises: preferences.avoid_exercises,
    avoidJoints: preferences.avoid_joints,
    sessionGoal: preferences.session_goal,
  },
  updatedAt: preferences.updated_at || new Date().toISOString(),
}
```

### TV App Implementation Differences

**Location**: `apps/tv/src/hooks/useRealtimePreferences.ts`

**Key Differences**:
- Additional transformation for workout type (parsing `workoutType` to determine `sessionGoal` and `includeFinisher`)
- More detailed console logging for debugging
- Uses local supabase instance instead of passed-in parameter
- Different cleanup method (`unsubscribe()` vs `removeChannel()`)

## 2. Subscription Setup

### Web App (Next.js)
- **Configuration**: `apps/nextjs/src/lib/supabase.ts`
  - Rate limiting: `eventsPerSecond: 10`
  - No special headers

### TV App (React Native)
- **Configuration**: `apps/tv/src/lib/supabase.ts`
  - Rate limiting: `eventsPerSecond: 10`
  - Debug logging enabled
  - Heartbeat interval: 30 seconds
  - Connection timeout: 20 seconds
  - Custom header: `X-Client-Type: 'react-native-tv'`

## 3. Real-time Subscription Usage

### Client Preferences Page (Web)
**Location**: `apps/nextjs/src/app/preferences/client/[sessionId]/[userId]/page.tsx`

```typescript
useRealtimePreferences({
  sessionId: sessionId || "",
  supabase,
  onPreferenceUpdate: handlePreferenceUpdate,
});
```

### Global Preferences Screen (TV)
**Location**: `apps/tv/src/screens/GlobalPreferencesScreen.tsx`

```typescript
const { isConnected } = useRealtimePreferences({
  sessionId: sessionId || '',
  onPreferenceUpdate: (event) => {
    // Updates local state with preference changes
    setClients(prev => {
      return prev.map(client => {
        if (client.userId === event.userId) {
          return { ...client, preferences: event.preferences, isReady: event.isReady };
        }
        return client;
      });
    });
  },
  onError: (err) => console.error('[TV GlobalPreferences] Realtime error:', err)
});
```

## 4. Additional Real-time Hook - Status Updates

### useRealtimeStatus Hook
**Location**: `packages/ui-shared/src/hooks/useRealtimeStatus.ts`

**Purpose**: Monitors `user_training_session` table for status changes (ready/not ready)

**Key Features**:
- Channel named `status-${sessionId}`
- Only listens to UPDATE events
- Filters by `training_session_id`
- Used alongside preference updates to track user readiness

## 5. Data Flow from Mutation to Real-time Update

### 1. Client Updates Preference
**Example**: Updating workout type
```typescript
updateWorkoutTypeMutation.mutate({
  sessionId,
  userId,
  workoutType,
});
```

### 2. Server-side Mutation
**Location**: `packages/api/src/router/workout-preferences.ts`

The `updateWorkoutTypePublic` mutation:
- Verifies user is checked in
- Updates or creates preference record
- Returns updated record
- Database update triggers real-time event

### 3. Database Trigger
- Supabase automatically publishes changes to subscribers
- No custom triggers found in migration files
- Real-time is likely enabled at the table level in Supabase dashboard

### 4. Real-time Event Propagation
- Supabase broadcasts the change to all subscribed channels
- Filtered by `training_session_id`

### 5. Client Receives Update
- Hook's event handler processes the payload
- Transforms data from snake_case to camelCase
- Calls the provided callback with transformed data
- UI updates reactively

## 6. Key Observations

### Strengths:
1. **Efficient Filtering**: Uses session-specific channels and filters
2. **Error Handling**: Comprehensive connection state management
3. **Performance**: Rate limiting and debouncing prevent overload
4. **Type Safety**: Well-typed interfaces for preference updates
5. **Shared Code**: Common hooks in ui-shared package

### Potential Issues:
1. **No RLS Policies**: Security relies on application-level checks
2. **Missing Retry Logic**: No automatic reconnection on failure
3. **TV vs Web Inconsistency**: Different implementations could lead to bugs
4. **No Offline Support**: Real-time only works when connected
5. **Missing Cleanup**: Old preferences aren't automatically removed

### Real-time Configuration Requirements:
1. Supabase project must have real-time enabled
2. Tables need real-time publication enabled:
   - `workout_preferences`
   - `user_training_session`
3. No custom database triggers or RLS policies found

## 7. Recommendations

1. **Consolidate Implementations**: Merge TV and web hooks into single shared implementation
2. **Add Retry Logic**: Implement exponential backoff for reconnection
3. **Add RLS Policies**: Implement row-level security for real-time subscriptions
4. **Add Offline Queue**: Buffer mutations when offline and sync when connected
5. **Monitor Performance**: Add metrics for subscription health and latency
6. **Document Setup**: Create guide for enabling real-time in Supabase dashboard

## 8. Testing Considerations

To test real-time functionality:
1. Open multiple clients for same session
2. Update preferences in one client
3. Verify updates appear in other clients within 1-2 seconds
4. Test connection loss/recovery scenarios
5. Monitor Supabase real-time logs for errors