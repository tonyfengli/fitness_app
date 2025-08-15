# TV App Build Notes - NativeWind v2 Setup

## Critical: Tailwind/PostCSS Version Lock

This TV app uses **NativeWind v2.0.11** which requires specific versions of Tailwind CSS and PostCSS to work correctly.

### Why These Specific Versions?

NativeWind v2's Babel transform runs PostCSS **synchronously** using `.process(css).css`. Newer versions of Tailwind CSS (3.3+) include async PostCSS plugins, which causes the following error during build:

```
Error: Use process(css).then(cb) to work with async plugins
```

### Required Versions

- **tailwindcss**: 3.2.7 (last version before async plugins)
- **postcss**: 8.4.21 - 8.5.x (NativeWind bundles 8.5.6)
- **nativewind**: 2.0.11

These versions are locked in `package.json` using the `overrides` field.

## Do's and Don'ts

### ✅ DO:

- Keep `tailwind.config.js` in CommonJS format
- Keep content globs tight in tailwind.config.js
- Use className prop directly on React Native components
- Run `pnpm run guard:deps` to verify versions before building
- Use `pnpm install --frozen-lockfile` in CI

### ❌ DON'T:

- Add any `postcss.config.*` files in the TV app
- Import CSS files (this is React Native, not web)
- Upgrade Tailwind CSS or PostCSS without testing
- Use `pnpm update` without checking the TV app specifically
- Mix NativeWind v2 with NativeWind v4 syntax

## Build Commands

```bash
# Development
pnpm run android:tv

# Check dependency versions
pnpm run guard:deps

# Production build
pnpm run build

# Clean build
pnpm run clean
pnpm run clean:android
```

## Troubleshooting

### PostCSS Async Plugin Error

If you see "Use process(css).then(cb) to work with async plugins":

1. Run `pnpm run guard:deps` to check versions
2. Check `pnpm why tailwindcss` and `pnpm why postcss`
3. Ensure no postcss.config.js exists in apps/tv
4. Clear caches: `npx react-native start --reset-cache`

### Tailwind Classes Not Working

1. Ensure babel.config.js includes `'nativewind/babel'`
2. Check that the component uses `className` not `style`
3. Restart Metro bundler with cache clear
4. Verify tailwind.config.js content paths are correct

### Version Drift

The `guard:deps` script runs automatically before builds. If it fails:

```bash
# Check what versions are actually resolved
pnpm why tailwindcss
pnpm why postcss

# Force correct versions
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Safe Upgrade Path (Future)

If you need to test newer Tailwind versions:

1. Create a branch
2. Update versions in package.json (both dependencies and overrides)
3. Run a test bundle: `pnpm run build`
4. If successful, test the app thoroughly
5. If it fails with async plugin error, revert

## Alternative Solutions

If version constraints become too limiting:

1. **NativeWind v4**: Complete rewrite, different API, but supports latest Tailwind
2. **tailwind-rn**: PostCSS-free alternative
3. **Custom solution**: Write a Tailwind-to-StyleSheet converter
4. **Styled Components**: Different approach, no Tailwind

## Related Files

- `package.json` - Version locks and overrides
- `scripts/guardDeps.js` - Version verification script
- `babel.config.js` - NativeWind babel plugin
- `tailwind.config.js` - Tailwind configuration
- `metro.config.js` - Metro bundler configuration

---

# TV App Architecture Documentation

## Environment Variables Setup

### Build-Time Code Generation Approach

The TV app uses a build-time code generation approach to handle environment variables due to React Native's limitations with traditional `.env` file loading in monorepo structures.

#### Implementation Details

**File: `scripts/generate-env.js`**
- Runs via `prestart` script before app launch
- Reads environment files in precedence order:
  1. `.env.development` (if APP_ENV=development)
  2. `.env` (base configuration)
  3. `.env.production` (if APP_ENV=production)
- Generates TypeScript module at `src/env.generated.ts`
- Validates required variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `API_URL`

**Usage Pattern:**
```typescript
// src/config.ts
import {
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  API_URL,
} from './env.generated';
```

**Configuration:**
- `.env` files are gitignored
- `src/env.generated.ts` is gitignored
- Default `API_URL` set to `http://10.0.2.2:3000` for Android emulator

## Authentication Architecture

### BetterAuth Integration (Current State)

The TV app currently uses a simplified authentication model with hardcoded credentials for development purposes.

**File: `src/providers/AuthContext.tsx`**
```typescript
const hardcodedUser = {
  id: 'tv-user-001',
  email: 'tv@example.com',
  name: 'TV Display',
  businessId: 'biz_123',
};
```

**Authentication Flow:**
1. App automatically signs in with hardcoded user on launch
2. No token management or session persistence
3. `signIn()` sets the hardcoded user in state
4. `signOut()` clears the user from state

**Business Context:**
- Uses `BusinessProvider` that wraps the entire app
- Business ID is hardcoded in the user object
- No actual business data fetching occurs

## Real-Time WebSocket Architecture

### Supabase Real-Time Integration

The app uses Supabase exclusively for real-time updates, while authentication is handled separately by BetterAuth.

**Supabase Client Setup:**
```typescript
// lib/supabase.ts
export const supabase = createClient(
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY
);
```

### Real-Time Hooks

**1. useRealtimePreferences**
- Subscribes to `workout_preferences` table changes
- Filters by `training_session_id`
- Updates client preferences in real-time

**2. useRealtimeStatus**
- Subscribes to `user_training_session` table
- Tracks user ready status
- Updates client cards when status changes

**3. useRealtimeExerciseSwaps**
- Subscribes to `workout_exercise_swaps` table
- Invalidates React Query cache on swap events
- Triggers UI refresh automatically

### Pattern Implementation
```typescript
const channel = supabase
  .channel(`preferences-${sessionId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'workout_preferences',
    filter: `training_session_id=eq.${sessionId}`,
  }, (payload) => {
    // Handle update
  })
  .subscribe();
```

**Key Features:**
- PostgreSQL Change Data Capture (CDC)
- Channel-based subscriptions with session-specific naming
- Connection status tracking
- Proper cleanup on component unmount
- 100ms delay before subscribing to prevent rapid re-renders

## Screen Implementations

### SessionLobby Screen

**Data Flow:**
- Fetches checked-in clients using `api.trainingSession.getCheckedInClients`
- Real-time updates via `useRealtimeStatus` hook
- Shows client avatars, names, and ready status

**UI Structure:**
- Grid layout (3 columns for >6 clients, 2 columns for ≤6)
- Client cards with avatar and status indicator
- "Start Session" button (currently non-functional)
- Connection status indicator

### GlobalPreferences Screen

**Data Flow:**
- Fetches client preferences via `api.trainingSession.getCheckedInClients`
- Real-time preference updates via `useRealtimePreferences`
- Real-time status updates via `useRealtimeStatus`
- Triggers workout generation via `api.trainingSession.generateGroupWorkoutBlueprint`

**Workflow:**
1. Shows client preferences in grid layout
2. Continue button triggers LLM workout generation
3. Shows custom loading animation (WorkoutGenerationLoader)
4. Saves visualization data
5. Navigates to WorkoutOverview on completion
6. Attempts to skip generation if exercises already exist (in progress)

**UI Features:**
- Responsive grid (2x2 for ≤4 clients, 3x3 for >4)
- Four sections per client card:
  1. Workout type (Full Body/Targeted, With/Without Finisher)
  2. Muscle targets (green chips)
  3. Muscle limits (red chips)
  4. Intensity level with exercise count
- Real-time connection status indicator

### WorkoutOverview Screen

**Data Flow:**
- Fetches exercise selections via `api.workoutSelections.getSelections`
- Fetches client info via `api.trainingSession.getCheckedInClients`
- Real-time swap updates via `useRealtimeExerciseSwaps`

**Query Invalidation Pattern:**
```typescript
queryClient.invalidateQueries({
  queryKey: [["workoutSelections", "getSelections"], { input: { sessionId } }]
});
```

**UI Features:**
- Same responsive grid layout as preferences
- Two-column exercise list per client
- Text truncation with ellipsis
- "+N more" indicator for >6 exercises
- Real-time connection status indicator

### WorkoutLive Screen

**Current Implementation:**
- Static placeholder screen
- Shows round number and session ID
- "End Workout" button navigates back to SessionLobby
- Bottom status bar with timer and active users placeholders

## Data Fetching Patterns

### tRPC Integration

All data fetching uses tRPC with React Query:

```typescript
// Query pattern
const { data, isLoading } = useQuery(
  sessionId ? api.endpoint.method.queryOptions({ sessionId }) : {
    enabled: false,
    queryKey: ['disabled'],
    queryFn: () => Promise.resolve([])
  }
);

// Mutation pattern
const saveVisualization = useMutation({
  ...api.trainingSession.saveVisualizationData.mutationOptions(),
  onError: (error) => {
    console.error('[TV] Save error:', error);
  }
});
```

### API Endpoints Used

1. **Training Session:**
   - `api.trainingSession.getCheckedInClients`
   - `api.trainingSession.generateGroupWorkoutBlueprint`
   - `api.trainingSession.saveVisualizationData`

2. **Workout Selections:**
   - `api.workoutSelections.getSelections`

3. **Auth:**
   - `api.auth.getClientsByBusiness` (used in workout overview)

## UI/UX Design System

### Dark Theme Implementation
- Background: `#121212`
- Card background: `#1F2937`
- Text colors:
  - Primary: `#ffffff`
  - Secondary: `#E0E0E0`
  - Muted: `#9CA3AF`
- Accent colors:
  - Blue focus: `#3b82f6`
  - Green primary: `#10b981`
  - Red danger: `#ef4444`

### Component Patterns

**Buttons:**
```typescript
style={({ focused }) => ({
  borderWidth: 2,
  borderColor: focused ? '#3b82f6' : 'transparent',
  backgroundColor: focused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
  transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
})}
```

**TV Parallax Properties:**
```typescript
tvParallaxProperties={{
  enabled: true,
  shiftDistanceX: 2,
  shiftDistanceY: 2,
}}
```

### Loading States
- Custom WorkoutGenerationLoader with animated kettlebell
- Standard ActivityIndicator for data fetching
- Connection status indicators with colored dots

## Navigation Flow

1. **App Launch** → SessionLobby (if businessId present)
2. **SessionLobby** → GlobalPreferences (on session selection)
3. **GlobalPreferences** → WorkoutOverview (after generation or if exercises exist)
4. **WorkoutOverview** → WorkoutLive (on Start Workout)
5. **WorkoutLive** → SessionLobby (on End Workout)

## Current Limitations & Design Decisions

1. **Authentication:** Hardcoded user for development simplicity
2. **Business Context:** Fixed business ID for testing
3. **Read-Only Interface:** TV app designed for display only
4. **Session Management:** No ability to create/delete sessions
5. **Exercise Modifications:** No swap functionality (handled on mobile)
6. **API URL:** Configured for Android emulator localhost

## File Structure

```
apps/tv/
├── src/
│   ├── screens/
│   │   ├── SessionLobbyScreen.tsx
│   │   ├── GlobalPreferencesScreen.tsx
│   │   ├── WorkoutOverviewScreen.tsx
│   │   └── WorkoutLiveScreen.tsx
│   ├── hooks/
│   │   ├── useRealtimePreferences.ts
│   │   └── useRealtimeStatus.ts
│   ├── providers/
│   │   ├── AuthContext.tsx
│   │   ├── BusinessProvider.tsx
│   │   └── TRPCProvider.tsx
│   ├── components/
│   │   └── WorkoutGenerationLoader.tsx
│   ├── lib/
│   │   └── supabase.ts
│   └── config.ts
├── scripts/
│   └── generate-env.js
└── .env files (gitignored)
```

## Key Technical Decisions

### State Management Architecture

**Provider Hierarchy:**
```
AuthProvider (BetterAuth session management)
  └── TRPCProvider (API client with auth headers)
      └── BusinessProvider (extracts businessId)
          └── RealtimeProvider (Supabase connection status)
              └── NavigationContainer (custom navigation)
                  └── App Screens
```

**Real-time Management:**
- RealtimeProvider monitors Supabase connection
- Individual hooks manage channel subscriptions
- 100ms delay pattern prevents rapid re-subscriptions
- Callback refs maintain stability across re-renders

### Performance Optimizations

1. **TV-Specific React Native Fork**: `react-native-tvos@0.79.2-0`
2. **Rate Limiting**: Supabase limited to 10 events/second
3. **Connection Monitoring**: 5-second intervals for status checks
4. **Lazy Channel Creation**: Subscriptions created on-demand
5. **Query Caching**: React Query handles data caching

### Security Considerations

1. **Hardcoded Credentials**: Development only, needs replacement
2. **Row-Level Security**: Relies on Supabase RLS policies
3. **API Authentication**: Bearer tokens + cookie headers
4. **Business Isolation**: All queries filtered by businessId

## Future Improvements

1. **Authentication**: Implement proper TV pairing/activation flow
2. **Error Handling**: Add centralized error boundary and reporting
3. **Connection Resilience**: Add retry logic with exponential backoff
4. **State Persistence**: Cache data for offline scenarios
5. **WorkoutLive Integration**: Connect to real session data
6. **Navigation**: Consider React Navigation for better TV support
7. **Testing**: Add unit and integration tests
8. **Analytics**: Implement usage tracking and performance monitoring