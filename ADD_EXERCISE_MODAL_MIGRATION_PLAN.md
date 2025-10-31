# Add Exercise Modal Migration Plan

## Overview

This document outlines the plan to refactor and migrate the "add exercise" full-screen modal to a drawer component. The current implementation uses a single modal for three distinct use cases:

1. **Add to existing station** (in stations rounds)
2. **Add to round - create new station** (in stations rounds) 
3. **Add to round** (for circuit/AMRAP rounds)

## Current Implementation Details

### Location: `/apps/nextjs/src/app/circuit-workout-overview/page.tsx`

### Modal State Variables (Lines 672-680)
```typescript
const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
const [addExerciseRoundName, setAddExerciseRoundName] = useState<string>("");
const [addExerciseSearchQuery, setAddExerciseSearchQuery] = useState("");
const [addExerciseSelectedId, setAddExerciseSelectedId] = useState<string | null>(null);
const [addExerciseCategory, setAddExerciseCategory] = useState<{ type: 'muscle' | 'movement' | 'equipment', value: string } | null>(null);
const [addExerciseCategoryMode, setAddExerciseCategoryMode] = useState<'choice' | 'muscle' | 'movement' | 'equipment'>('choice');
const [addExerciseTargetStation, setAddExerciseTargetStation] = useState<number>(0);
const [addExerciseRoundData, setAddExerciseRoundData] = useState<RoundData | null>(null);
```

### Modal Trigger Points

1. **Add to existing station** (Line 1906)
   - Triggered from station exercise placeholder
   - Sets `addExerciseTargetStation` to specific station number

2. **Add to round (circuit/AMRAP)** (Line 2135)
   - Triggered from round's add exercise button
   - `addExerciseTargetStation` is 0 (creates new exercise in round)

3. **Create new station** (Line 2188)
   - Triggered from "Create Station" button in stations rounds
   - `addExerciseTargetStation` is 0 (creates new station)

### Mutation Handlers

1. **addExerciseToStationMutation** (Lines 544-575)
   - Handles adding exercises to existing stations
   - Uses `exerciseSwaps.addExerciseToStation`

2. **addExerciseToRoundMutation** (Lines 578-616)
   - Handles both:
     - Adding exercises directly to circuit/AMRAP rounds
     - Creating new stations in stations rounds
   - Uses `exerciseSwaps.addExerciseToRound`

### Modal UI Component (Lines 3188-3756)

#### Structure:
- **Background overlay** (Lines 3192-3203)
- **Modal container** (Lines 3205-3754)
- **Header section** (Lines 3211-3256)
  - Dynamic title based on context
  - Close button
- **Search input** (Lines 3258-3294)
- **Dynamic content area** (Lines 3298-3751)
  - Loading state (Lines 3300-3315)
  - Exercise confirmation view (Lines 3317-3374)
  - Search results (Lines 3440-3523)
  - Category browsing views:
    - Choice view (Lines 3526-3593)
    - Muscle groups (Lines 3595-3645)
    - Movement patterns (Lines 3647-3703)
    - Equipment (Lines 3705-3751)

### Modal State Reset Pattern

The modal is closed and state is reset in multiple locations:
```typescript
setShowAddExerciseModal(false);
setAddExerciseSearchQuery("");
setAddExerciseSelectedId(null);
setAddExerciseCategory(null);
setAddExerciseCategoryMode('choice');
setAddExerciseTargetStation(0);
setAddExerciseRoundData(null);
```

Locations:
- Line 3233 (Close button)
- Line 571 (addExerciseToStationMutation success)
- Line 612 (addExerciseToRoundMutation success)
- Lines 3369-3370 (Add button click)

### Supporting Functions and Dependencies

- **availableExercisesRef** (Line 658) - Stores available exercises data
- **getUnifiedMuscleGroup** (Line 418) - Maps muscle groups to unified categories
- **filterExercisesBySearch** (Imported, Line 16) - Filters exercises by search query
- **Body scroll prevention** (Lines 1247-1254) - Prevents body scroll when modal is open
- **Scroll to top effect** (Lines 1310-1314) - Scrolls to top when modal opens

## Migration Plan

### Phase 1: Extract Modal to Component

**Objective**: Extract the current full-screen modal implementation to its own component file while maintaining all existing functionality.

**Steps**:
1. Create new file: `/components/workout/AddExerciseModal.tsx`
2. Extract all modal-related code:
   - Modal state variables
   - Modal UI component (JSX)
   - Helper functions specific to the modal
3. Define props interface to handle different use cases:
   ```typescript
   interface AddExerciseModalProps {
     isOpen: boolean;
     onClose: () => void;
     mode: 'add-to-station' | 'add-to-round' | 'create-station';
     roundData: RoundData;
     targetStation?: number;
     availableExercises: any[];
     mutations: {
       addToStation: any;
       addToRound: any;
     };
   }
   ```
4. Update page.tsx to use the new component
5. Pass appropriate props based on trigger context

### Phase 2: Clean Up page.tsx

**Objective**: Remove all modal-related code from page.tsx and clean up unused imports.

**Items to remove**:
1. Modal state variables (Lines 672-680)
2. Modal reset logic scattered throughout
3. Direct modal JSX (Lines 3188-3756)
4. Modal-specific effects (body scroll prevention)
5. Any unused imports after extraction

**Items to update**:
1. Modal trigger points to use new component
2. Mutation success handlers to call modal's onClose prop
3. Ensure all three use cases still work correctly

### Phase 3: Migrate to Drawer

**Objective**: Convert the extracted modal component to use a drawer pattern similar to `ExerciseReplacement.tsx`.

**Reference**: `/components/workout/ExerciseReplacement.tsx` - Existing drawer implementation pattern

**Steps**:
1. Rename component to `AddExerciseDrawer.tsx`
2. Remove modal-specific elements:
   - Full-screen overlay
   - Modal positioning styles
   - Body scroll prevention (drawer handles this)
3. Implement drawer structure:
   - Fixed header with close button
   - Scrollable content area
   - Fixed footer with action buttons
4. Update styling to match drawer pattern:
   - Slide-in animation from right
   - Proper height and width constraints
   - Responsive design considerations
5. Update parent component:
   - Replace modal state with drawer state
   - Update trigger logic
   - Ensure smooth transitions

**Key differences from ExerciseReplacement drawer**:
- Three distinct modes (add-to-station, add-to-round, create-station)
- Dynamic button text based on mode
- Different mutations for different modes
- Station number targeting for add-to-station mode

## Success Criteria

After all phases are complete:
1. All three use cases work identically to current implementation
2. Code is more maintainable with separated concerns
3. Drawer provides better mobile UX than full-screen modal
4. No regressions in functionality
5. Consistent UI/UX with ExerciseReplacement drawer