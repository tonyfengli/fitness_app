# Responsive Patterns Guide

This guide documents the responsive utilities and patterns implemented in Phase 3.5 of the Frontend Revamp.

## Table of Contents
1. [Responsive Hooks](#responsive-hooks)
2. [ResponsiveView Component](#responsiveview-component)
3. [Feature Props](#feature-props)
4. [Feature Flags](#feature-flags)
5. [Implementation Examples](#implementation-examples)
6. [Best Practices](#best-practices)

## Responsive Hooks

### useMediaQuery
Detects if a media query matches.

```typescript
import { useMediaQuery } from "@acme/ui-shared";

function Component() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  
  return isLargeScreen ? <DesktopView /> : <MobileView />;
}
```

### useDeviceType
Detects the current device type based on screen size and platform.

```typescript
import { useDeviceType } from "@acme/ui-shared";

function Component() {
  const { isDesktop, isMobile, isTablet, isNative } = useDeviceType();
  
  if (isNative) {
    return <NativeAppView />;
  }
  
  return isDesktop ? <DesktopView /> : <MobileView />;
}
```

### usePlatform
Detects if running in web browser or native app.

```typescript
import { usePlatform } from "@acme/ui-shared";

function Component() {
  const { platform, isWeb, isNative } = usePlatform();
  
  // Platform-specific logic
  if (platform === "ios") {
    // iOS-specific code
  }
}
```

### useResponsive
Combined hook for responsive design decisions.

```typescript
import { useResponsive } from "@acme/ui-shared";

function Component() {
  const { breakpoint, isMobileView, isTabletView, isDesktopView } = useResponsive();
  
  return (
    <div className={isMobileView ? "p-4" : "p-8"}>
      Current breakpoint: {breakpoint}
    </div>
  );
}
```

## ResponsiveView Component

The `ResponsiveView` component renders different content based on screen size.

### Basic Usage

```tsx
import { ResponsiveView } from "@acme/ui-shared";

function Dashboard() {
  return (
    <ResponsiveView
      mobile={<MobileLayout />}
      tablet={<TabletLayout />}
      desktop={<DesktopLayout />}
    />
  );
}
```

### With Fallback

```tsx
<ResponsiveView
  desktop={<DesktopWorkoutCard />}
  mobile={<MobileWorkoutCard />}
>
  {/* Fallback for tablet or any unspecified view */}
  <DefaultWorkoutCard />
</ResponsiveView>
```

## Feature Props

Components can extend `FeatureProps` to support conditional features.

### Defining Component Props

```typescript
import type { FeatureProps } from "@acme/ui-shared";

interface MyComponentProps extends FeatureProps {
  title: string;
  // ... other props
}
```

### Using Feature Props

```tsx
function WorkoutCard({
  title,
  showAddButton = true,
  showEditButton = true,
  compactMode = false,
  ...props
}: WorkoutCardProps) {
  return (
    <Card className={compactMode ? "p-2" : "p-6"}>
      <h3>{title}</h3>
      {showEditButton && <EditButton />}
      {showAddButton && <AddButton />}
    </Card>
  );
}
```

### Available Feature Props

- **Navigation**: `showNotifications`, `showSearch`, `showFilters`
- **Actions**: `showAddButton`, `showEditButton`, `showDeleteButton`
- **Layout**: `compactMode`, `showSidebar`
- **Overrides**: `forceDesktopView`, `forceMobileView`

## Feature Flags

The feature flag system allows toggling features without code changes.

### Setting Up Feature Flags

```tsx
import { FeatureFlagProvider } from "@acme/ui-shared";

function App() {
  return (
    <FeatureFlagProvider flags={{
      enableNewDashboard: true,
      enableMobileOptimizations: true,
    }}>
      <YourApp />
    </FeatureFlagProvider>
  );
}
```

### Using Feature Flags

```tsx
import { useFeatureFlag } from "@acme/ui-shared";

function Component() {
  const showNewFeature = useFeatureFlag("enableNewDashboard");
  
  if (!showNewFeature) {
    return <LegacyDashboard />;
  }
  
  return <NewDashboard />;
}
```

### Multiple Flags

```tsx
import { useFeatureFlags } from "@acme/ui-shared";

function Component() {
  const flags = useFeatureFlags([
    "enableMobileOptimizations",
    "enableAdvancedFilters"
  ]);
  
  return (
    <div>
      {flags.enableMobileOptimizations && <MobileOptimizedView />}
      {flags.enableAdvancedFilters && <FilterPanel />}
    </div>
  );
}
```

## Implementation Examples

### Unified Dashboard

```tsx
export default function Dashboard() {
  const { isDesktopView } = useResponsive();
  const enableUnified = useFeatureFlag("enableUnifiedDashboard");
  
  if (!enableUnified) {
    return <LegacyDashboard />;
  }
  
  return (
    <ResponsiveView
      desktop={
        <SidebarLayout>
          <WorkoutProgramCard 
            showAddButton 
            showFilters={isDesktopView}
          />
        </SidebarLayout>
      }
      mobile={
        <MobileLayout>
          <WorkoutSummaryCard 
            showAddButton={false}
            compactMode
          />
        </MobileLayout>
      }
    />
  );
}
```

### Responsive Component

```tsx
function WorkoutList() {
  const { isMobileView } = useResponsive();
  const { platform } = usePlatform();
  
  return (
    <div className={isMobileView ? "space-y-2" : "grid grid-cols-3 gap-4"}>
      {workouts.map(workout => (
        <WorkoutCard
          key={workout.id}
          {...workout}
          showEditButton={!isMobileView}
          compactMode={isMobileView}
          showNotifications={platform === "web"}
        />
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Mobile-First Approach
Design for mobile first, then enhance for larger screens.

```tsx
// Good: Mobile-first with desktop enhancements
const padding = isMobileView ? "p-4" : "p-8";

// Avoid: Desktop-first with mobile overrides
const padding = isDesktopView ? "p-8" : "p-4";
```

### 2. Use ResponsiveView for Major Layout Changes
For significant layout differences, use `ResponsiveView` instead of conditional rendering.

```tsx
// Good: Clear separation of layouts
<ResponsiveView
  mobile={<MobileLayout />}
  desktop={<DesktopLayout />}
/>

// Avoid: Complex conditionals
{isMobile ? (
  <div className="mobile-layout">...</div>
) : isTablet ? (
  <div className="tablet-layout">...</div>
) : (
  <div className="desktop-layout">...</div>
)}
```

### 3. Centralize Breakpoints
Use the provided hooks instead of hardcoding breakpoints.

```tsx
// Good: Using responsive hooks
const { isMobileView } = useResponsive();

// Avoid: Hardcoding breakpoints
const isMobile = window.innerWidth < 768;
```

### 4. Feature Props Over Conditionals
Use feature props to control component behavior.

```tsx
// Good: Feature props
<WorkoutCard showAddButton={isDesktop} />

// Avoid: External conditionals
{isDesktop && <WorkoutCard withAddButton />}
```

### 5. Progressive Enhancement
Start with core functionality, add features for larger screens.

```tsx
function Dashboard() {
  const { isDesktopView } = useResponsive();
  
  return (
    <DashboardLayout
      // Core features for all screens
      showWorkouts
      showProfile
      // Enhanced features for desktop
      showSidebar={isDesktopView}
      showFilters={isDesktopView}
      showBulkActions={isDesktopView}
    />
  );
}
```

### 6. Test Across Breakpoints
Always test your components at different screen sizes:
- Mobile: 320px, 375px, 414px
- Tablet: 768px, 834px
- Desktop: 1024px, 1440px, 1920px

### 7. Performance Considerations
- Lazy load desktop-only features on mobile
- Use `React.memo` for components that change based on screen size
- Debounce resize listeners (handled automatically by our hooks)

## Migration Guide

### From Separate Mobile/Desktop Pages

Before:
```tsx
// pages/dashboard-desktop.tsx
export default function DesktopDashboard() { ... }

// pages/dashboard-mobile.tsx
export default function MobileDashboard() { ... }
```

After:
```tsx
// pages/dashboard.tsx
export default function Dashboard() {
  return (
    <ResponsiveView
      desktop={<DesktopDashboard />}
      mobile={<MobileDashboard />}
    />
  );
}
```

### Adding Responsive Features to Existing Components

1. Extend `FeatureProps` in your component interface
2. Add default values for feature props
3. Use props to conditionally render features
4. Test across different screen sizes

## Troubleshooting

### SSR Issues
The responsive hooks check for `window` object. For SSR:

```tsx
// The hooks handle SSR automatically, but you can add additional checks
if (typeof window === "undefined") {
  return <LoadingState />;
}
```

### Hydration Mismatches
Ensure initial render matches between server and client:

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return <DefaultView />;
}

return <ResponsiveView ... />;
```