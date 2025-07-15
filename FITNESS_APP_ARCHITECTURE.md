# Fitness App - Technical Reference

## Project Overview

This is a **full-stack fitness application** built on the **create-t3-turbo** stack, featuring a monorepo architecture with web and mobile applications. The project uses TypeScript throughout for end-to-end type safety.

**Current State**: The app is currently a basic blog/post system with authentication. It provides a solid foundation for building fitness-specific features.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.1.3 | Web application framework |
| **React** | 19.0.0 | UI library |
| **Expo** | SDK 53 | Mobile development platform |
| **React Native** | 0.76.6 | Mobile UI framework |
| **tRPC** | 11.0.12 | Type-safe API layer |
| **Better Auth** | 1.2.2 | Authentication solution |
| **Drizzle ORM** | 0.44.1 | Database ORM |
| **PostgreSQL** | - | Database (via Supabase) |
| **Tailwind CSS** | 3.4.17 | Styling framework |
| **TypeScript** | 5.7.2 | Type safety |
| **Turborepo** | 2.3.3 | Monorepo build system |
| **pnpm** | 10.11.1 | Package manager |

## Project Structure

```
fitness_app/
├── apps/
│   ├── expo/                    # React Native mobile app
│   │   ├── src/
│   │   │   ├── app/            # Expo Router pages
│   │   │   ├── components/     # Mobile-specific components
│   │   │   └── utils/          # Mobile utilities (auth, api)
│   │   ├── app.json           # Expo configuration
│   │   └── package.json
│   └── nextjs/                 # Next.js web application
│       ├── src/
│       │   ├── app/           # App Router pages
│       │   ├── auth/          # Authentication setup
│       │   ├── components/    # Web components
│       │   └── trpc/          # tRPC client setup
│       ├── next.config.js
│       └── package.json
├── packages/
│   ├── api/                   # tRPC API definitions
│   │   ├── src/
│   │   │   ├── router/       # API route handlers
│   │   │   ├── root.ts       # Main tRPC router
│   │   │   └── trpc.ts       # tRPC configuration
│   │   └── package.json
│   ├── auth/                  # Authentication logic
│   │   ├── src/
│   │   │   └── index.ts      # Better Auth configuration
│   │   └── package.json
│   ├── db/                    # Database layer
│   │   ├── src/
│   │   │   ├── schema.ts     # Drizzle schema definitions
│   │   │   ├── client.ts     # Database client
│   │   │   └── index.ts      # Exports
│   │   ├── drizzle.config.ts # Drizzle configuration
│   │   └── package.json
│   ├── ui-shared/             # Platform-agnostic components
│   │   ├── src/
│   │   │   ├── components/   # Base components (Button, Avatar, Card)
│   │   │   ├── context/      # State management (AppContext)
│   │   │   ├── utils/        # Utilities including responsive hooks
│   │   │   └── types/        # Shared TypeScript interfaces
│   │   └── package.json
│   ├── ui-desktop/            # Desktop-specific components
│   │   ├── src/
│   │   │   ├── layouts/      # Desktop layouts (SidebarLayout, GridLayout)
│   │   │   └── components/   # Desktop components
│   │   └── package.json
│   ├── ui-mobile/             # Mobile components (web + native)
│   │   ├── src/
│   │   │   └── components/   # React Native components with NativeWind
│   │   └── package.json
│   └── validators/            # Shared Zod schemas
│       ├── src/
│       └── package.json
├── tooling/                   # Development tooling
│   ├── eslint/               # ESLint configurations
│   ├── prettier/             # Prettier configuration
│   ├── tailwind/             # Tailwind configurations
│   └── typescript/           # TypeScript configurations
├── turbo.json               # Turborepo configuration
├── pnpm-workspace.yaml      # Workspace definition
└── package.json             # Root package.json
```

## Frontend Architecture

### Overview
The frontend architecture follows a modular, platform-adaptive approach that supports desktop web, mobile web, and native mobile experiences from a unified codebase. The architecture emphasizes component reusability, type safety, and progressive enhancement.

### Core Principles

1. **Platform Separation with Shared Logic**
   - Clear boundaries between platform-specific and shared components
   - Maximize code reuse while respecting platform conventions
   - Single source of truth for business logic

2. **Component-First Architecture**
   - Self-contained components with clear responsibilities
   - Composition over inheritance
   - Props-driven interfaces for flexibility

3. **Type Safety Throughout**
   - End-to-end TypeScript from database to UI
   - Shared type definitions across packages
   - Compile-time validation of component contracts

4. **Progressive Enhancement**
   - Desktop-first with mobile optimization
   - Feature detection over browser/device detection
   - Graceful degradation for unsupported features

### Package Architecture

#### ui-shared
Platform-agnostic components and utilities that form the foundation:
- **Base Components**: Button, Avatar, Card, Input, Form elements
- **Business Components**: ExerciseItem, WorkoutCard (base implementations)
- **State Management**: AppContext with hooks for clients, workouts, UI state
- **Utilities**: Responsive hooks, feature flags, common helpers
- **Types**: Shared TypeScript interfaces for data models

#### ui-desktop
Desktop-optimized components leveraging full screen real estate:
- **Layouts**: SidebarLayout, GridLayout for complex layouts
- **Components**: ClientSidebar, WorkoutProgramCard, complex data tables
- **Interactions**: Hover states, keyboard navigation, drag-and-drop
- **Styling**: Standard HTML elements with Tailwind CSS

#### ui-mobile
Cross-platform mobile components using React Native Web:
- **Native Components**: Using React Native primitives (View, Text, Pressable)
- **Web Compatibility**: React Native Web for browser rendering
- **Touch Optimized**: Larger tap targets, swipe gestures, haptic feedback
- **Styling**: NativeWind for Tailwind CSS in React Native

### Responsive System

#### Device Detection Utilities
```typescript
// Comprehensive device and viewport detection
useMediaQuery()    // CSS media query matching
useDeviceType()    // Desktop/tablet/mobile detection
usePlatform()      // Web/iOS/Android detection
useResponsive()    // Combined responsive state
```

#### Conditional Rendering
```typescript
// ResponsiveView component for viewport-based rendering
<ResponsiveView
  desktop={<DesktopWorkoutCard />}
  tablet={<TabletWorkoutCard />}
  mobile={<MobileWorkoutCard />}
/>
```

#### Feature Flags System
- Runtime feature toggling without deployments
- Component-level feature props for granular control
- Environment-based flag configuration
- A/B testing capability

### State Management

#### Context-Based Architecture
Central AppContext provides:
- **Client Management**: Active clients, selection, filtering
- **Workout Data**: Programs, exercises, progress tracking
- **UI State**: Sidebar visibility, loading states, user preferences
- **Optimistic Updates**: Immediate UI feedback with background sync

#### State Hooks
```typescript
useClients()   // Client CRUD operations
useWorkouts()  // Workout management
useUI()        // UI state and preferences
```

### Component Patterns

#### Composition Strategy
```typescript
// Base component in ui-shared
<ExerciseItem exercise={...} />

// Desktop wrapper in ui-desktop
<ExerciseRow>
  <ExerciseItem {...props} />
  <DesktopActions />
</ExerciseRow>

// Mobile wrapper in ui-mobile
<ExerciseListItem>
  <ExerciseItem {...props} />
  <MobileActions />
</ExerciseListItem>
```

#### Feature Props Pattern
All major components accept feature flags for conditional functionality:
```typescript
<WorkoutProgramCard
  showNotifications={isDesktop}
  showFilters={hasPermission}
  compactMode={isMobile}
/>
```

### Styling Architecture

#### Desktop (ui-desktop)
- Standard HTML elements with Tailwind utility classes
- CSS-in-JS for complex animations
- Hover and focus states for accessibility
- Grid and flexbox layouts

#### Mobile (ui-mobile)
- React Native StyleSheet for performance
- NativeWind for Tailwind compatibility
- Platform-specific styles via Platform.select()
- Consistent with iOS/Android design guidelines

### Build Configuration

#### Next.js Integration
```javascript
// Transpile all UI packages
transpilePackages: ["@acme/ui-shared", "@acme/ui-desktop", "@acme/ui-mobile"]

// React Native Web webpack configuration
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    "react-native$": "react-native-web",
  };
  return config;
}
```

#### TypeScript Configuration
- Shared tsconfig for consistency
- Path aliases for clean imports
- Strict mode enabled
- Composite projects for build optimization

### Development Workflow

1. **Component Development**
   - Start with ui-shared for maximum reuse
   - Extend in platform packages as needed
   - Use Storybook for isolated development

2. **Testing Strategy**
   - Unit tests for business logic
   - Component testing with React Testing Library
   - E2E tests for critical user flows
   - Visual regression testing

3. **Code Organization**
   ```
   ComponentName/
   ├── index.ts              # Exports
   ├── ComponentName.tsx     # Implementation
   ├── ComponentName.types.ts # TypeScript types
   ├── ComponentName.test.tsx # Tests
   └── styles.ts             # Styles (if needed)
   ```

### Performance Optimizations

- **Code Splitting**: Route-based splitting with Next.js
- **Lazy Loading**: Dynamic imports for heavy components
- **Memoization**: React.memo for expensive renders
- **Image Optimization**: Next/Image and lazy loading
- **Bundle Size**: Tree shaking and dead code elimination

### Accessibility

- **ARIA Labels**: Semantic markup with proper roles
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Tested with NVDA/JAWS/VoiceOver
- **Color Contrast**: WCAG AA compliance
- **Focus Management**: Visible focus indicators

### Future Considerations

1. **Offline Support**: Service workers for PWA capabilities
2. **Real-time Updates**: WebSocket integration for live data
3. **Internationalization**: i18n support for multiple languages
4. **Theme System**: Dark mode and custom themes
5. **Animation System**: Framer Motion or React Native Reanimated

## Authentication System (Implemented)

### Features
- **Email/Password Authentication**: Users sign up and log in with email and password
- **User Registration**: Collects email, password, phone number, role (trainer/client), and business association
- **Session Management**: 30-day persistent sessions with secure HTTP-only cookies
- **Role-Based Access**: Different dashboards and permissions for trainers vs clients
- **Protected API Endpoints**: All sensitive routes require authentication via `protectedProcedure`
- **Logout Functionality**: Sign out clears session and redirects to login

### Authentication Flow

#### Web Application (Next.js)
```mermaid
sequenceDiagram
    participant User
    participant NextJS
    participant BetterAuth
    participant Database

    User->>NextJS: Enter email/password
    NextJS->>BetterAuth: Submit credentials
    BetterAuth->>Database: Validate user
    Database->>BetterAuth: Return user data + role
    BetterAuth->>Database: Create session
    BetterAuth->>NextJS: Return session + cookies
    NextJS->>User: Redirect based on role
    Note over User,NextJS: Trainers → /exercises
    Note over User,NextJS: Clients → /client-dashboard
```

#### Logout Flow
```mermaid
sequenceDiagram
    participant User
    participant NextJS
    participant BetterAuth
    participant Database

    User->>NextJS: Click "Sign Out"
    NextJS->>BetterAuth: Call signOut()
    BetterAuth->>Database: Invalidate session
    BetterAuth->>NextJS: Clear cookies
    NextJS->>NextJS: Clear React Query cache
    NextJS->>User: Redirect to /login
```

### Database Schema
- **User Table**: `id`, `email`, `password` (hashed), `phone`, `role` (trainer/client), `businessId`
- **Session Table**: `id`, `userId`, `expiresAt`, `token`, `createdAt`, `updatedAt`
- **Business Table**: `id`, `name`, `description`

### Protected Routes
- `/exercises` - Trainer dashboard (exercise management)
- `/client-dashboard` - Client dashboard (placeholder for future workouts)
- All API mutations require authentication
- Middleware enforces role-based access control

## Data Flow Architecture

### API Layer (tRPC)
```
Frontend Request → tRPC Router → Procedure → Database → Response
```

**tRPC Routers:**
- `auth`: Session management (`getSession`, `getSecretMessage`, `getUserRole`, `isTrainer`, `updateUserBusiness`)
- `post`: CRUD operations (`all`, `byId`, `create`, `delete`)
- `exercise`: Exercise management (`all`, `byId`, `search`, `filter`, `create`, `update`, `delete`)
- `business`: Business operations (`all`, `byId`, `create`)

**Procedure Types:**
- `publicProcedure`: Open to all users
- `protectedProcedure`: Requires authentication

### Database Access Pattern
```
tRPC Procedure → Drizzle Query Builder → PostgreSQL → Typed Response
```

## Development Setup

### Prerequisites
- Node.js 22.14.0+
- pnpm 10.11.1+

### Installation
```bash
# Clone and install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase and Discord OAuth credentials
```

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm db:push` | Push database schema changes |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:generate` | Generate database migrations |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm clean` | Clean all build artifacts |

### Individual App Commands
```bash
# Web app only
pnpm --filter @acme/nextjs dev

# Mobile app only  
pnpm --filter @acme/expo dev

# Database operations
pnpm --filter @acme/db push
pnpm --filter @acme/db studio
```

## Environment Variables

Create `.env` in the project root:

```env
# Database (Supabase)
POSTGRES_URL="postgres://postgres.[project-ref]:[password]@[region].pooler.supabase.com:6543/postgres?workaround=supabase-pooler.vercel"

# Authentication
AUTH_SECRET="your-secret-key"

# AI/LLM Integration
OPENAI_API_KEY="your-openai-api-key"

# Optional: For OAuth proxy
AUTH_REDIRECT_PROXY_URL="http://localhost:3000"
```

---

## TODO: Remaining Authentication Features

### Completed ✅
- **Email/Password Authentication**: Users can sign up and log in with email/password
- **User Registration**: Signup flow with email, password, phone, role, and business selection
- **Session Management**: 30-day persistent sessions with HTTP-only cookies
- **Role-Based Access**: Different dashboards for trainers (/exercises) and clients (/client-dashboard)
- **Protected API Endpoints**: All sensitive routes require authentication
- **Logout Functionality**: Sign out clears session and redirects to login
- **Business Association**: Users are linked to a single business

### Not Yet Implemented ❌
- **Username Field**: Currently using email for login instead of username
- **Discord OAuth**: Integration mentioned but not implemented
- **Email Verification**: No email confirmation flow
- **Password Reset**: No forgot password functionality
- **User Profile Page**: No UI for users to update their information
- **Row Level Security**: Database-level security by business not implemented

### Future Implementation Priorities

#### Priority 1: Username Support
- Add username field to user table
- Update signup/login forms to use username instead of email
- Ensure username uniqueness

#### Priority 2: User Profile Management
- Create profile page at `/profile` or `/settings`
- Allow users to update: phone, password, business association
- Add profile link to navigation

#### Priority 3: Password Reset Flow
- Implement forgot password functionality
- Email-based reset token generation
- Reset password page

#### Priority 4: Business-Scoped Exercise Access
- Implement actual filtering of exercises by business
- Use BusinessExercise join table properly
- Update exercise queries to filter by user's businessId

#### Priority 5: Mobile App Authentication
- Verify and fix mobile authentication flow
- Ensure session persistence on mobile
- Test with Expo SecureStore

### Migration Notes
- Exercise data and BusinessExercise relationships must be preserved when implementing business scoping
- Current implementation allows all businesses to see all exercises (security issue)

---

## Workout Tracking System (Implemented)

### Overview
A comprehensive workout tracking system that allows clients to view their training history and trainers to manage/log workouts. The system tracks training sessions (scheduled appointments), participant registration, and actual workout data with exercises performed.

### Database Schema (Implemented)

#### Training Session
- Scheduled appointments created by trainers
- Fields: `id`, `business_id`, `trainer_id`, `name`, `scheduled_at`, `duration_minutes`, `max_participants`

#### User Training Session
- Join table for users registered to attend sessions
- Fields: `id`, `user_id`, `training_session_id`, `created_at`
- Unique constraint on (user_id, training_session_id)

#### Workout
- Actual workout data completed during a session
- Fields: `id`, `training_session_id`, `user_id`, `completed_at`, `notes`

#### Workout Exercise
- Exercises performed in a workout
- Fields: `id`, `workout_id`, `exercise_id`, `order_index`, `sets_completed`

### Business Exercise Integration (Implemented)
- Exercises are filtered by business using the `business_exercise` join table
- All exercise endpoints (`all`, `search`, `filter`) respect business boundaries
- Trainers only see exercises available to their business

### API Endpoints

#### Training Session Management (`trainingSession` router)
- **create** - Trainers create new training sessions
- **list** - List all sessions with optional filters (trainer, date range)
- **getById** - Get session details including participants
- **addParticipant** - Register a user for a session
- **removeParticipant** - Unregister a user from a session
- **myPast** - Get user's past training sessions

#### Workout Tracking (`workout` router)
- **create** - Log a workout for a training session with exercises
- **addExercises** - Add exercises to an existing workout
- **myWorkouts** - Get user's workout history with exercise counts
- **getById** - Get detailed workout including all exercises performed
- **clientWorkouts** - Trainers view a specific client's workout history
- **sessionWorkouts** - View all workouts for a specific training session

### Access Control

#### Client Permissions
- View only their own workouts and training history
- Register/unregister themselves from training sessions
- Cannot see other users' workout data

#### Trainer Permissions
- Create and manage training sessions
- View all workouts within their business
- Log workouts for any client in their business
- Add/remove participants from sessions

### Security Features
- All data is filtered by `businessId` to prevent cross-business access
- Role-based permissions enforced at the API level
- Validation ensures users can only access appropriate data
- Transactions used for multi-table operations

### Usage Example Flow
1. Trainer creates a training session for "Monday Morning HIIT"
2. Clients register for the session via `addParticipant`
3. After the session, trainer logs each client's workout
4. Trainer adds exercises performed with sets completed
5. Clients can view their workout history via `myWorkouts`
6. Trainers can analyze all workouts for the session

### Future Enhancements
- Add reps, weight, rest time tracking per set
- Workout templates and programs
- Progress tracking and analytics
- Integration with AI workout generator for session planning
- Mobile app integration for real-time workout logging

---

## AI Workout Generation & Storage (Implemented)

### Overview
An intelligent workout generation system that creates personalized workouts using AI, with seamless database storage and client association. The system combines exercise selection, AI-powered workout creation, and persistent storage in a single workflow.

### Core Features

#### One-Click Workout Generation
- Trainers can generate complete workouts for clients with a single action
- AI analyzes client profile (strength, skill, goals) and creates appropriate workouts
- Immediate storage to database upon generation

#### Template-Based Workout Types
- **Standard**: Traditional strength training with blocks (A, B, C, D)
- **Circuit**: Time-based rounds with work/rest intervals
- **Full Body**: Balanced workouts with muscle group requirements

#### Intelligent Exercise Matching
- AI-generated exercise names are automatically matched to database exercises
- Fuzzy matching handles variations in exercise naming
- Invalid or unrecognized exercises are flagged with warnings but don't break the flow

#### Client-Workout Association
- Every workout is directly linked to a specific client via `user_id`
- Enables comprehensive workout history tracking
- Foundation for future progress analytics and reporting

### Technical Architecture

#### Database Schema
**Workout Table Extensions:**
- `workoutType`: Type of workout (standard/circuit/full_body)
- `totalPlannedSets`: Total sets planned by AI
- `llmOutput`: Complete AI response stored for reference
- `templateConfig`: Template-specific configuration

**WorkoutExercise Table Extensions:**
- `groupName`: Flexible grouping ("Block A", "Round 1", etc.)

#### Workflow Pipeline
1. **Exercise Selection**: Filter and score exercises based on client profile
2. **AI Generation**: LLM creates structured workout with sets/reps
3. **Validation**: Exercise names validated against database
4. **Transformation**: AI output converted to database format
5. **Storage**: Atomic transaction saves workout and exercises

### API Integration

**generateIndividual Endpoint**
- Creates workouts directly for clients without requiring a training session
- Enforces business boundaries - trainers can only generate workouts for clients in their business
- Accepts template type (standard/circuit/full_body) and AI-generated exercise structure
- Marks workouts with context "individual" to distinguish from group session workouts
- Currently allows both trainers and clients to generate workouts (no role restriction)

**saveWorkout Endpoint**
- Accepts AI-generated workout output for training sessions
- Validates training session and client permissions
- Automatically handles exercise lookups
- Returns saved workout with all associations
- Marks workouts with context "group" for session-based workouts

### Benefits for Trainers
- **Efficiency**: Generate complete workouts in seconds
- **Consistency**: AI follows training principles and client needs
- **Flexibility**: Multiple workout templates for different training styles
- **Traceability**: Original AI output preserved for reference
- **Safety**: Business-scoped to prevent cross-contamination

### Benefits for Clients
- **Personalization**: Workouts tailored to individual capabilities
- **Variety**: Different workout types prevent monotony
- **Progress Tracking**: All workouts linked for historical analysis
- **Professional Quality**: AI-generated workouts follow best practices

### Integration Points
- Connects with existing training session system
- Respects business boundaries and permissions
- Works with current exercise database
- Compatible with future mobile app development

### Future Enhancements
- Real-time workout adjustments during sessions
- Client feedback integration for AI learning
- Advanced progress analytics
- Workout sharing and templates
- Group workout generation for classes