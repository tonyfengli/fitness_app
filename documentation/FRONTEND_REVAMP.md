# Frontend Revamp Documentation

## Overview

This document outlines the comprehensive frontend revamp of the fitness app, transitioning from the current implementation to a new architecture based on 6 test page designs. The revamp will create a scalable component system supporting desktop web, mobile web, and native mobile experiences.

## Goals

1. **Replace current trainer dashboard** with modern, intuitive interface (Test Page 1)
2. **Create reusable component architecture** supporting desktop and mobile
3. **Implement 6 distinct user experiences** based on test pages
4. **Maintain clean separation** between desktop and mobile UX patterns
5. **Prepare foundation** for future data integration

## Test Page References

All test pages are located at: `apps/nextjs/src/app/test_pages/`

- **Test Page 1**: `test1/page.tsx` - Desktop Trainer Dashboard
- **Test Page 2**: `test2/page.tsx` - Desktop Workout Overview  
- **Test Page 3**: `test3/page.tsx` - Desktop Session Lobby (Client Check-in)
- **Test Page 4**: `test4/page.tsx` - Mobile Trainer Dashboard
- **Test Page 5**: `test5/page.tsx` - Mobile Edit Program
- **Test Page 6**: `test6/page.tsx` - Mobile Add Exercise

## Component Breakdown by Test Page

### Desktop Components (Test 1-3)

**Test 1 - Trainer Dashboard:**
- ClientSidebar (with search, filters)
- WorkoutProgramCard
- ExerciseRow
- FeedbackSection

**Test 2 - Workout Overview:**
- WorkoutUserCard (grid layout)
- ExerciseListItem (compact)
- UserAvatar

**Test 3 - Session Lobby:**
- UserStatusCard
- OnlineStatusBadge

### Mobile Components (Test 4-6)

**Test 4 - Mobile Dashboard:**
- MobileHeader
- ClientProfileCard
- WorkoutProgramCard (mobile variant)
- ExerciseRow (mobile variant)
- FeedbackSection (collapsible)

**Test 5 - Edit Program:**
- Same as Test 4 but with:
- DraggableExerciseRow
- RemoveButton
- AddExerciseButton (dashed)

**Test 6 - Add Exercise:**
- BackHeader
- SearchBar
- ExerciseCategorySection
- ExerciseSelectRow
- BottomActionBar

## Existing Components to Reuse

The following components from the current implementation will be integrated into the revamp:

1. **Navigation Component** (`apps/nextjs/src/app/_components/navigation.tsx`)
   - Will be used for all desktop pages (Test 1-3)
   - Already includes authentication state, role-based links, and sign out
   - Responsive design that hides on mobile viewports
   - Mobile pages will use MobileHeader instead

2. **Login/Signup Pages** (`/login` and `/signup`)
   - Current authentication pages remain unchanged
   - Already integrated with Better Auth
   - Users will continue to land on these before accessing dashboard

3. **Authentication System**
   - useAuth hook and auth client remain as-is
   - Protected route logic continues to work
   - Session management unchanged

**Note**: Navigation tabs/links shown in test pages 2-3 (Dashboard, Workouts, Progress, Community, etc.) are design artifacts and will NOT be implemented. We will use the existing navigation component instead.

## Architecture Overview

### Package Structure
```
fitness_app/
├── packages/
│   ├── ui-shared/          # Components used by both desktop & mobile
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ExerciseItem/
│   │   │   │   ├── Avatar/
│   │   │   │   ├── SearchInput/
│   │   │   │   └── Card/
│   │   │   ├── styles/
│   │   │   │   └── shared.css
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui-desktop/         # Desktop-specific components
│   │   ├── src/
│   │   │   ├── layouts/
│   │   │   │   ├── SidebarLayout/
│   │   │   │   └── GridLayout/
│   │   │   ├── components/
│   │   │   │   ├── ClientSidebar/
│   │   │   │   ├── NavigationHeader/
│   │   │   │   ├── WorkoutProgramCard/
│   │   │   │   ├── WorkoutUserCard/
│   │   │   │   └── UserStatusCard/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui-mobile/          # Mobile-specific components
│       ├── src/
│       │   ├── components/
│       │   │   ├── MobileHeader/
│       │   │   ├── BottomActionBar/
│       │   │   ├── BackHeader/
│       │   │   ├── DraggableList/
│       │   │   ├── MobileWorkoutCard/
│       │   │   └── ClientProfileCard/
│       │   └── index.ts
│       └── package.json
```

### Routing Structure
```
/trainer-dashboard         → Test Page 1 (Desktop trainer dashboard)
/workout-overview         → Test Page 2 (Desktop workout grid view)  
/session-lobby           → Test Page 3 (Desktop check-in lobby)
/test4                   → Test Page 4 (Mobile trainer dashboard)
/test5                   → Test Page 5 (Mobile edit program)
/test6                   → Test Page 6 (Mobile add exercise)
/trainer-dashboard-legacy → Current implementation (deprecated)
```

## Component Naming Convention

### Naming Pattern
- **Base component** (ui-shared): Generic name (Avatar, ExerciseItem, WorkoutCard)
- **Platform variant** (ui-desktop/mobile): Descriptive suffix (ExerciseRow, WorkoutProgramCard)
- **Specialized version**: Purpose suffix (ExerciseSelectItem, UserAvatar)

### Component Hierarchy Examples
```
ExerciseItem (ui-shared) - Base component
├── ExerciseRow (ui-desktop) - Desktop wrapper with hover/edit
└── ExerciseListItem (ui-mobile) - Mobile wrapper with touch

Avatar (ui-shared) - Base image component
└── UserAvatar (ui-desktop/mobile) - With online status

WorkoutCard (ui-shared) - Base workout display
├── WorkoutProgramCard (ui-desktop) - Full desktop layout
├── WorkoutSummaryCard (ui-mobile) - Compact mobile version
└── WorkoutUserCard (ui-desktop) - Grid card for overview
```

## Component Inventory

### Shared Components (ui-shared)

#### ExerciseItem
- **Purpose**: Base exercise display component
- **Used by**: Platform-specific exercise components
- **Key features**: Exercise information display, adaptable to different contexts

#### Avatar
- **Purpose**: User profile image with fallback support
- **Variations**: Multiple sizes, with/without status indicators

#### SearchInput  
- **Purpose**: Reusable search functionality
- **Adaptable**: Works in different layouts and contexts

#### Card
- **Purpose**: Flexible container component
- **Styles**: Various visual treatments available

#### WorkoutCard
- **Purpose**: Base workout display structure
- **Extended by**: Platform-specific implementations

### Desktop Components (ui-desktop)

#### Layouts
- **SidebarLayout**: Fixed sidebar + flexible content area
- **GridLayout**: Responsive grid for cards

#### Components
- **ClientSidebar**: Fixed sidebar for client navigation and filtering
- **WorkoutProgramCard**: Comprehensive workout display for trainers
- **WorkoutUserCard**: Grid-friendly card for workout overview
- **UserStatusCard**: Client status display for session management
- **UserAvatar**: Enhanced avatar with status capabilities
- **OnlineStatusBadge**: Visual status indicator
- **FeedbackSection**: Expandable feedback interface
- **ExerciseRow**: Desktop-optimized exercise display

### Mobile Components (ui-mobile)

- **MobileHeader**: Compact app header for mobile views
- **BottomActionBar**: Fixed action area for primary actions
- **BackHeader**: Navigation header with back functionality
- **DraggableList**: Touch-enabled list reordering
- **WorkoutSummaryCard**: Space-efficient workout display
- **ClientProfileCard**: Client information header
- **ExerciseCategorySection**: Organized exercise grouping
- **ExerciseListItem**: Touch-optimized exercise display
- **ExerciseSelectItem**: Exercise selection interface
- **RemoveButton**: Edit mode deletion control

## Design System

### Design Principles

#### Color System (Match Test Pages Exactly)
**Primary Colors:**
- `#4F46E5` (indigo-600) - Primary buttons, active states, headers
- `#E0E7FF` (indigo-100) - Selected backgrounds, hover states
- `#3B82F6` (blue-500) - Links, secondary actions
- `#2563EB` (blue-600) - Primary icons, branding

**Neutral Colors:**
- `#F9FAFB` (gray-50) - Page backgrounds
- `#F3F4F6` (gray-100) - Card backgrounds, disabled states
- `#E5E7EB` (gray-200) - Borders, dividers
- `#9CA3AF` (gray-400) - Muted icons, placeholder text
- `#6B7280` (gray-500) - Secondary text
- `#4B5563` (gray-600) - Primary icons
- `#374151` (gray-700) - Body text
- `#1F2937` (gray-800) - Headings
- `#111827` (gray-900) - Primary text

**Status Colors:**
- `#10B981` (green-500) - Online status, success
- `#EF4444` (red-500) - Notifications, alerts, in-session status

**Note**: Use these exact Tailwind classes to ensure perfect color matching with mockups

#### Typography
- **Hierarchy**: Clear distinction between headings, body, and labels
- **Responsive**: Slightly smaller sizes on mobile for better fit
- **Consistency**: Unified type scale across all platforms

#### Spacing
- **Systematic**: Consistent spacing scale based on multiples
- **Flexible**: Spacing adapts to viewport and context
- **Breathable**: Generous spacing for touch targets on mobile

### Icons
- **System**: Material Icons library
- **Sizing**: Consistent scale matching typography
- **Usage**: Semantic icons that clearly indicate function

## Package Setup and Dependencies

### Package Dependencies Structure
```json
// packages/ui-shared/package.json
{
  "dependencies": {
    "react": "^19.0.0"
  }
}

// packages/ui-desktop/package.json
{
  "dependencies": {
    "@acme/ui-shared": "workspace:*",
    "react": "^19.0.0"
  }
}

// packages/ui-mobile/package.json
{
  "dependencies": {
    "@acme/ui-shared": "workspace:*",
    "react": "^19.0.0",
    "react-native": "^0.76.6",
    "react-native-web": "^0.19.0",
    "nativewind": "^4.0.0"
  }
}
```

### NativeWind Configuration
For cross-platform Tailwind support in mobile components:

```js
// packages/ui-mobile/tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
};
```

## Implementation Phases

### Phase 1: Foundation Setup
**Goal**: Establish package architecture and core components

- Set up package structure (`ui-shared`, `ui-desktop`, `ui-mobile`)
- Configure build tools and dependencies
- Implement core shared components
- Establish design system foundations
- Set up cross-platform styling approach

**Checkpoint**: Review package structure and shared components

### Phase 2: Desktop Foundation (Test Page 1)
**Goal**: Implement primary trainer dashboard experience

- Build layout components and patterns
- Create trainer-specific components
- Implement new `/trainer-dashboard` route
- Preserve existing functionality at legacy route

**Checkpoint**: Validate desktop patterns before proceeding

### Phase 3: Mobile Foundation (Test Page 4)
**Goal**: Establish mobile component patterns

- Create mobile-specific components
- Implement touch interactions
- Set up mobile routing
- Ensure web/native compatibility

**Checkpoint**: Confirm mobile approach works across platforms

### Phase 4: Complete Remaining Views
**Goal**: Build out all page variations

**Desktop Views:**
- Workout Overview (Test Page 2)
- Session Lobby (Test Page 3)

**Note**: Mobile views (Test Pages 5 and 6) have been removed from scope.

**Checkpoint**: Review all implementations for consistency

### Phase 3.5: Responsive & Conditional Handling System
**Goal**: Create elegant conditional rendering and responsive utilities for unified experiences

**Timeline**: 2-3 days

**Objectives**:
1. Build responsive utilities for detecting device types and screen sizes
2. Implement feature flags and conditional rendering system
3. Create unified components that adapt to different platforms
4. Establish patterns for platform-specific behavior

**Implementation Details**:

#### 1. Responsive Utilities (ui-shared/utils/responsive)
```typescript
// useMediaQuery.ts
export function useMediaQuery(query: string): boolean
// Detects if a media query matches (e.g., "(min-width: 768px)")

// useDeviceType.ts
export function useDeviceType(): {
  isDesktop: boolean;
  isMobile: boolean;
  isNative: boolean;
  isTablet: boolean;
}
// Detects the current device type based on screen size and platform

// usePlatform.ts
export function usePlatform(): {
  platform: 'web' | 'ios' | 'android';
  isWeb: boolean;
  isNative: boolean;
}
// Detects if running in web browser or native app

// useResponsive.ts
export function useResponsive(): {
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isMobileView: boolean;
  isTabletView: boolean;
  isDesktopView: boolean;
}
// Combined hook for responsive design decisions
```

#### 2. Responsive Component Wrapper
```typescript
// ResponsiveView.tsx
interface ResponsiveViewProps {
  mobile?: React.ReactNode;
  tablet?: React.ReactNode;
  desktop?: React.ReactNode;
  children?: React.ReactNode; // Fallback for all views
}

export function ResponsiveView(props: ResponsiveViewProps): JSX.Element
// Renders different content based on screen size

// Example usage:
<ResponsiveView
  mobile={<MobileWorkoutCard />}
  desktop={<DesktopWorkoutCard />}
/>
```

#### 3. Feature Props System
Update all major components to accept feature flags:

```typescript
// Common feature props to add to components
interface FeatureProps {
  // Navigation features
  showNotifications?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  
  // Action features
  showAddButton?: boolean;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  
  // Layout features
  compactMode?: boolean;
  showSidebar?: boolean;
  
  // Responsive overrides
  forceDesktopView?: boolean;
  forceMobileView?: boolean;
}

// Example: Updated WorkoutProgramCard
interface WorkoutProgramCardProps extends FeatureProps {
  title: string;
  exercises: Exercise[];
  // ... other props
}
```

#### 4. Unified Dashboard Component
Create a single dashboard that adapts:

```typescript
// app/dashboard/page.tsx
export default function Dashboard() {
  const { isDesktopView } = useResponsive();
  const { platform } = usePlatform();
  
  return (
    <DashboardLayout
      showSidebar={isDesktopView}
      compactMode={!isDesktopView}
    >
      <ResponsiveView
        desktop={
          <SidebarLayout>
            <WorkoutProgramCard showAddButton showFilters />
          </SidebarLayout>
        }
        mobile={
          <MobileLayout>
            <WorkoutSummaryCard showAddButton={false} />
          </MobileLayout>
        }
      />
    </DashboardLayout>
  );
}
```

#### 5. Feature Flag System
```typescript
// featureFlags.ts
interface FeatureFlags {
  enableNewDashboard: boolean;
  enableMobileOptimizations: boolean;
  enableAdvancedFilters: boolean;
  // ... other flags
}

// useFeatureFlag.ts
export function useFeatureFlag(flag: keyof FeatureFlags): boolean

// FeatureFlagProvider.tsx
export function FeatureFlagProvider({ children, flags }: Props)
```

#### 6. Platform-Specific Behavior Patterns
```typescript
// Conditional imports based on platform
const IconComponent = Platform.select({
  web: () => <span className="material-icons">fitness_center</span>,
  default: () => <MaterialIcons name="fitness-center" size={24} />
});

// Conditional styling
const styles = Platform.select({
  web: { className: "p-4 bg-gray-100" },
  default: StyleSheet.create({ container: { padding: 16 } })
});
```

**Deliverables**:
1. Complete responsive utilities package
2. Updated components with feature props
3. Unified dashboard replacing separate mobile/desktop routes
4. Documentation for conditional rendering patterns
5. Migration guide for existing components

**Success Criteria**:
- Single codebase serves all platforms elegantly
- No duplicate pages for mobile/desktop
- Components adapt automatically to screen size
- Feature flags can be toggled without code changes
- Improved developer experience with clear patterns

### Phase 5: Refinement & Integration
**Goal**: Polish and prepare for production

1. Add proper TypeScript interfaces for all components
2. Create placeholder state management structure
3. Add loading states and skeletons
4. Implement proper focus management and accessibility
5. Document component APIs and usage
6. Create Storybook stories (optional)
7. Performance optimization (lazy loading, memoization)

**Final Checkpoint**: Full review before considering phase complete

## Component File Structure and Cross-Platform Strategy

### File Organization
Each component should follow this structure:

```
ComponentName/
  ├── index.ts              # Export barrel file
  ├── ComponentName.tsx     # Component implementation
  ├── ComponentName.types.ts # TypeScript interfaces
  ├── ComponentName.test.tsx # Component tests
  └── styles.ts             # Style utilities (if needed)
```

### Cross-Platform Styling Strategy

#### Desktop Components (ui-desktop)
Use standard HTML elements with Tailwind classes:

```tsx
// ui-desktop components use div/span/etc with className
export function DesktopComponent() {
  return (
    <div className="flex items-center p-3 rounded-lg bg-gray-50">
      <span className="text-base font-medium">Content</span>
    </div>
  );
}
```

#### Mobile Components (ui-mobile) - Cross-Platform
Use React Native components with NativeWind for both mobile web and native:

**File Naming Convention for Platform Differences:**
```
ui-mobile/
  └── components/
      └── MobileHeader/
          ├── index.ts                    # Export logic
          ├── MobileHeader.tsx            # Shared component (90% of cases)
          ├── MobileHeader.web.tsx        # Web-specific override (if needed)
          └── MobileHeader.native.tsx     # Native-specific override (if needed)
```

**Platform Detection in Exports:**
```tsx
// index.ts
import { Platform } from 'react-native';

// React Native's bundler automatically picks the right file
export { MobileHeader } from './MobileHeader';

// Or manual platform detection when needed:
export const MobileHeader = Platform.select({
  web: () => require('./MobileHeader.web').MobileHeader,
  default: () => require('./MobileHeader').MobileHeader,
})();
```

```tsx
// ui-mobile components use View/Text with NativeWind classes
import { View, Text, Pressable } from 'react-native';
import { cn } from '@acme/ui';

export function MobileComponent({ variant, onPress }) {
  return (
    <Pressable 
      onPress={onPress}
      className={cn(
        "flex-row items-center rounded-lg bg-gray-50",
        variant === 'compact' ? "p-2" : "p-3"
      )}
    >
      <Text className="text-base font-medium text-gray-800">
        Content
      </Text>
    </Pressable>
  );
}
```

**Key Points:**
- `ui-mobile` components work on both mobile web (via react-native-web) and React Native
- Use `View` instead of `div`, `Text` instead of `span/p`
- Use `Pressable` for touchable elements
- Use `flex-row` instead of `flex` for horizontal layouts in React Native
- NativeWind enables Tailwind classes in React Native

**When to Create Platform-Specific Files:**
- **Default**: Write one component that works on both platforms (90% of cases)
- **`.web.tsx`**: When you need web-specific features (e.g., hover states, CSS animations)
- **`.native.tsx`**: When you need native-specific features (e.g., haptic feedback, native gestures)

**Example Scenarios:**
```
ExerciseListItem.tsx         # Works on both platforms ✓
ExerciseListItem.web.tsx     # Add hover effects for web
ExerciseListItem.native.tsx  # Add swipe gestures for native
```

#### Shared Components (ui-shared)
For truly shared components, create platform-specific exports:

```
ExerciseItem/
  ├── index.ts
  ├── ExerciseItem.types.ts    # Shared types
  ├── ExerciseItem.web.tsx     # Web implementation
  └── ExerciseItem.native.tsx  # Native implementation
```

### Styling Approach
1. **Primary**: Tailwind utility classes via NativeWind
2. **Conditional styles**: Use `cn()` utility from @acme/ui
3. **Complex styles**: Use StyleSheet.create() for React Native when needed

```tsx
// Simple conditional styling
<View className={cn(
  "p-4 rounded-lg",
  isActive && "bg-blue-100",
  isDisabled && "opacity-50"
)}>

// Complex styles when needed
const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  }
});
```

## Component Development Guidelines

### Interface Design
- Components should accept flexible props that can evolve
- Start with minimal interfaces and expand as needed
- Consider platform differences when designing APIs
- Props should be intuitive and self-documenting

### Type Safety
- Use TypeScript for all components
- Share common types across packages
- Keep interfaces flexible enough for iteration
- Avoid over-specifying types early in development

## State Management Considerations

### Preparation for Future Integration
- Design components to accept data via props
- Consider loading and error states
- Plan for real-time updates
- Keep state logic separate from presentation

### Key State Areas
- **User Context**: Authentication and role information
- **Client Selection**: Currently selected client and filters
- **Workout Data**: Programs, exercises, and progress
- **UI State**: Component visibility, expansion states, etc.

## Success Metrics

- [ ] All 6 test pages accurately recreated with React components
- [ ] Clean separation between shared, desktop, and mobile components
- [ ] Responsive behavior works smoothly
- [ ] Components are properly typed with TypeScript
- [ ] Code is maintainable and well-documented
- [ ] Performance is optimized (fast initial load, smooth interactions)
- [ ] Foundation is ready for data integration

## Next Steps After Revamp

1. Connect components to real data via tRPC
2. Implement component interactions and state management
3. Add animations and transitions
4. Implement real-time features
5. Add comprehensive testing
6. Progressive enhancement for offline support
7. Performance monitoring and optimization

---

**Note**: This document serves as the single source of truth for the frontend revamp. Updates should be made here as implementation progresses.