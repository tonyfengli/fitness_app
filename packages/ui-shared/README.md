# UI Shared Package

This package contains shared UI components used by both desktop and mobile applications.

## Components

### Core Components
- **Avatar** - User profile image with fallback support
- **Button** - Flexible button component with multiple variants
- **Card** - Container component for content sections
- **ExerciseItem** - Exercise display with multiple variants (default, editable, selectable)
- **WorkoutCard** - Workout program display card
- **SearchInput** - Search input field
- **Input** - Form input component
- **Label** - Form label component

### Complex Components
- **Form** - React Hook Form integration components
- **DropdownMenu** - Dropdown menu with Radix UI
- **Theme** - Theme provider and toggle
- **Toast** - Toast notification system

## Design System

### Colors
- Primary: Indigo-based color scheme
- Neutrals: Gray scale from 50-900
- Status: Success (green), Error (red), Warning (yellow), Info (blue)

### Typography
- Font family: Inter (sans-serif)
- Font sizes: xs through 3xl
- Font weights: normal, medium, semibold, bold

### Spacing
- Based on 4px unit system
- Consistent spacing scale from 0 to 32 (0rem to 8rem)

## Usage

```tsx
import { Button, ExerciseItem, WorkoutCard, colors } from '@acme/ui-shared';

// Use components
<Button variant="primary" size="md">Click me</Button>

// Use design tokens
<div style={{ color: colors.primary.DEFAULT }}>
  Styled content
</div>
```