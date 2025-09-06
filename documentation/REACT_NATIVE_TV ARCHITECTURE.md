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

### BetterAuth Integration (Production Implementation)

The TV app uses a sophisticated authentication system with environment-based account switching and automatic token management.

**File: `src/auth/auth-service.ts`**
- Full BetterAuth integration with token persistence
- Environment-based credentials (gym vs developer accounts)
- Automatic session refresh and retry logic
- AsyncStorage for session persistence

**Hardcoded Credentials:**
```typescript
const TV_CREDENTIALS = {
  gym: {
    email: 'tony.li.feng@gmail.com',
    password: '123456',
  },
  developer: {
    email: 'tony.feng.li@gmail.com',
    password: '123456',
  }
};
```

**Authentication Flow:**
1. App checks for cached session on launch
2. If no valid session, performs auto-login with environment credentials
3. Stores session and token in AsyncStorage
4. Automatic token refresh on 401 responses
5. Account switching preserves environment preference

**Key Features:**
- Session validation with expiry checking
- Bearer token + cookie authentication headers
- Exponential backoff retry mechanism
- Fallback to previous session on switch failure
- Business ID validation (required for all operations)

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

**1. useRealtimeCheckIns**
- Subscribes to `user_training_session` table changes
- Tracks client check-ins and status updates
- Auto-refreshes SessionLobbyScreen when clients check in

**2. useRealtimePreferences**
- Subscribes to `workout_preferences` table changes
- Updates GlobalPreferencesScreen in real-time
- Shows muscle targets, limits, and intensity changes

**3. useRealtimeCircuitConfig**
- Monitors `circuit_training_config` table
- Updates circuit workout configuration live
- Syncs rounds, work/rest durations across devices

**4. useRealtimeNewSessions**
- Watches for new training sessions being created
- Auto-refreshes session list on MainScreen
- Enables immediate session visibility

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

### MainScreen
**Purpose**: Entry point showing available training sessions
- Lists all open sessions for the business
- Real-time updates via `useRealtimeNewSessions`
- Navigation to SessionLobby or SessionMonitor
- Account switching between gym/developer environments

### SessionLobbyScreen
**Data Flow:**
- Fetches checked-in clients using `api.trainingSession.getCheckedInClients`
- Real-time updates via `useRealtimeCheckIns` hook
- Shows session name, type, and client count

**Features:**
- Grid layout (adaptive based on client count)
- Client cards with profile info and check-in status
- "Start Strength Workout" or "Start Circuit Workout" based on session type
- Connection status indicator with real-time updates

### GlobalPreferencesScreen (Strength Training)
**Workflow:**
1. Shows client workout preferences in grid
2. Continue triggers AI workout generation
3. Custom loading animation during generation
4. Saves workout blueprint for visualization
5. Navigates to WorkoutOverview

**UI Features:**
- Responsive grid (2x2 for ≤4, 3x3 for >4)
- Client preference cards showing:
  - Workout type (Full Body/Targeted)
  - Muscle targets/limits with color coding
  - Intensity level and exercise count
- Real-time preference sync

### CircuitPreferencesScreen
**Features:**
- Circuit configuration display
- Rounds, work/rest duration, exercises per round
- Real-time updates via `useRealtimeCircuitConfig`
- Navigation to CircuitWorkoutOverview

### WorkoutOverviewScreen (Strength)
**Data Management:**
- Fetches exercises via `api.workoutSelections.getSelections`
- Monitors exercise swaps (not currently real-time enabled)
- Shows personalized exercise lists per client

**Display:**
- Grid layout matching preferences screen
- Exercise lists with muscle group badges
- Truncation for long exercise names
- Start Workout navigation

### CircuitWorkoutOverviewScreen
**Features:**
- Round-based exercise display
- Equipment and muscle group information
- Timer configuration preview
- Navigation to CircuitWorkoutLive

### WorkoutLiveScreen (Strength - In Development)
**Current State:**
- Displays organized rounds from Phase 2 generation
- Shows client assignments per exercise
- Weight markers from previous performance
- Timer and progress tracking planned

### CircuitWorkoutLiveScreen
**Implementation:**
- Full circuit workout execution
- Automated timer with work/rest cycles
- Round progression with exercise details
- Philips Hue lighting integration
- Pause/resume functionality

### Additional Screens:
- **WorkoutCompleteScreen**: Post-workout summary
- **SessionMonitorScreen**: Real-time session monitoring
- **LightingTestScreen**: Hue lights testing interface
- **TestTailwindScreen**: UI component testing

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

### Strength Training Path:
1. **App Launch** → MainScreen
2. **MainScreen** → SessionLobby (select strength session)
3. **SessionLobby** → GlobalPreferences (Start Strength Workout)
4. **GlobalPreferences** → WorkoutOverview (after AI generation)
5. **WorkoutOverview** → WorkoutLive (Start Workout)
6. **WorkoutLive** → WorkoutComplete → MainScreen

### Circuit Training Path:
1. **App Launch** → MainScreen
2. **MainScreen** → SessionLobby (select circuit session)
3. **SessionLobby** → CircuitPreferences (Start Circuit Workout)
4. **CircuitPreferences** → CircuitWorkoutOverview
5. **CircuitWorkoutOverview** → CircuitWorkoutLive
6. **CircuitWorkoutLive** → WorkoutComplete → MainScreen

### Navigation Implementation:
- Custom navigation context (no React Navigation)
- TV remote back button support
- Screen history tracking for proper back navigation
- Parameter passing between screens

## Current Limitations & Design Decisions

1. **Authentication:** Hardcoded credentials but full auth flow implemented
2. **Business Context:** Environment-based (gym vs developer accounts)
3. **Read-Only Interface:** TV designed for display and navigation only
4. **Session Management:** Can view and start sessions, not create/delete
5. **Exercise Modifications:** View swaps but cannot initiate (mobile only)
6. **API URL:** Default to Android emulator (10.0.2.2:3000)

## File Structure

```
apps/tv/
├── src/
│   ├── screens/
│   │   ├── MainScreen.tsx
│   │   ├── SessionLobbyScreen.tsx
│   │   ├── GlobalPreferencesScreen.tsx
│   │   ├── CircuitPreferencesScreen.tsx
│   │   ├── WorkoutOverviewScreen.tsx
│   │   ├── CircuitWorkoutOverviewScreen.tsx
│   │   ├── WorkoutLiveScreen.tsx
│   │   ├── CircuitWorkoutLiveScreen.tsx
│   │   ├── WorkoutCompleteScreen.tsx
│   │   ├── SessionMonitorScreen.tsx
│   │   ├── LightingTestScreen.tsx
│   │   └── TestTailwindScreen.tsx
│   ├── hooks/
│   │   ├── useRealtimeCheckIns.ts
│   │   ├── useRealtimePreferences.ts
│   │   ├── useRealtimeCircuitConfig.ts
│   │   ├── useRealtimeNewSessions.ts
│   │   ├── useAuthCleanup.ts
│   │   └── useStartWorkout.ts
│   ├── providers/
│   │   ├── AuthProvider.tsx
│   │   ├── BusinessProvider.tsx
│   │   ├── TRPCProvider.tsx
│   │   └── RealtimeProvider.tsx
│   ├── components/
│   │   └── WorkoutGenerationLoader.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── lighting/
│   │       ├── index.ts
│   │       ├── hue-direct.ts
│   │       ├── presets.ts
│   │       └── animations.ts
│   ├── auth/
│   │   └── auth-service.ts
│   └── config.ts
├── scripts/
│   ├── generate-env.js
│   ├── guardDeps.js
│   └── build-tv.sh
└── .env files (gitignored)
```

## Philips Hue Lighting Integration

### Overview
The TV app includes direct Philips Hue integration for synchronized workout lighting.

### Implementation (`src/lib/lighting/`)
- **hue-direct.ts**: Direct Hue Bridge API communication
- **presets.ts**: Pre-configured lighting scenes for workout phases
- **animations.ts**: Dynamic lighting effects (breathe, drift, pulse)

### Features:
1. **Automatic Discovery**: Finds Hue Bridge on local network
2. **Preset Scenes**: Different colors for warmup, work, rest, cooldown
3. **Animations**: 
   - Breathe effect during rest periods
   - Drift animation for ambiance
   - Countdown pulse for timer warnings
   - Round flash for transitions
4. **Health Monitoring**: Auto-reconnect on connection loss
5. **Circuit Integration**: Syncs with CircuitWorkoutLiveScreen phases

### Configuration:
- No authentication required (local network only)
- Fallback to manual IP if discovery fails
- Affects all lights in default group

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

1. **Hardcoded Credentials**: Production accounts, stored in code
2. **Row-Level Security**: Relies on Supabase RLS policies
3. **API Authentication**: Bearer tokens + cookie headers
4. **Business Isolation**: All queries filtered by businessId
5. **Token Storage**: AsyncStorage for persistence
6. **Session Validation**: Expiry checking and auto-refresh

## Future Improvements

1. **Authentication**: Implement proper TV pairing/activation flow
2. **Error Handling**: Add centralized error boundary and reporting
3. **Connection Resilience**: Add retry logic with exponential backoff
4. **State Persistence**: Cache data for offline scenarios
5. **WorkoutLive Integration**: Connect to real session data
6. **Navigation**: Consider React Navigation for better TV support
7. **Testing**: Add unit and integration tests
8. **Analytics**: Implement usage tracking and performance monitoring