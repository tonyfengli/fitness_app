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
│   ├── ui/                    # Shared UI components
│   │   ├── src/              # shadcn/ui components
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