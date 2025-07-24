# Template System Refactor Documentation

## Overview

This document details the comprehensive refactor of the workout template system, focusing on removing legacy cohesion-based code and implementing a clean, maintainable template processor that follows clear design principles.

## Refactor Objectives

1. **Remove all cohesion-related features** - Eliminate the complex cohesion scoring system
2. **Simplify template processing** - Create a clean TemplateProcessor class
3. **Maintain client preference priority** - Ensure client preferences always override template requirements
4. **Improve debugger efficiency** - Split large debug files into focused, manageable chunks
5. **Fix movement pattern filtering** - Ensure template constraints are properly applied

## Key Design Principles

### 1. Client Preferences Override Templates
- Templates are guidelines, not hard rules
- If a client explicitly includes an exercise, it bypasses ALL template filters
- Client safety and preferences take precedence over template organization

### 2. Simplified Group Scoring
- Removed complex cohesion bonuses
- Group score is now simply the average of individual client scores
- Shared exercises are ranked by number of clients sharing, then by average score

### 3. Clean Separation of Concerns
- Template processing is separate from exercise scoring
- Movement pattern filtering happens at the template level
- No mixing of business logic between phases

## Major Changes

### 1. New TemplateProcessor Class

**Location**: `/packages/ai/src/core/templates/TemplateProcessor.ts`

```typescript
export class TemplateProcessor {
  constructor(private template: WorkoutTemplate) {}

  processForGroup(
    clientExercises: Map<string, ScoredExercise[]>
  ): GroupWorkoutBlueprint {
    // Process each block with movement pattern filtering
    // Client includes always pass filters
  }
}
```

**Key Features**:
- Clean, single-responsibility design
- Proper movement pattern filtering with include/exclude support
- Client-included exercises bypass all filters
- Simplified shared exercise detection (2+ clients = shared)
- Enhanced `prepareIndividualCandidates` method to include all filtered exercises
- Proper `isClientIncludedExercise` implementation checking `includeExerciseBoost`

### 2. Removed Legacy Components

**Deleted Files**:
- `/packages/ai/src/workout-generation/group/group-scoring/` (entire directory)
- `/packages/ai/src/workout-generation/group/templates/GroupWorkoutTemplateHandler.ts`
- `/packages/ai/src/workout-generation/group/templates/BlockAdapter.ts`
- `/packages/ai/src/workout-generation/group/templates/templateSelector.ts`
- `/packages/ai/src/workout-generation/group/templates/SelectionStrategy.ts`
- `/packages/ai/src/workout-generation/group/templates/EnhancedConstraintTracker.ts`
- `/packages/ai/src/workout-generation/group/templates/ConstraintTracker.ts`
- `/packages/ai/src/workout-generation/group/templates/subGroupManager.ts`
- `/packages/ai/src/workout-generation/group/templates/blockConfig.ts`
- `/packages/ai/src/workout-generation/group/utils/templateOrganization.ts`
- `/packages/ai/src/types/groupCohesion.ts`
- 8 test files related to cohesion and template features

**Removed Concepts**:
- `GroupCohesionSettings`
- `ClientGroupSettings`
- `cohesionBonus` scoring
- `cohesionRatio` calculations
- Complex sub-group optimization

### 3. Updated Pipeline Integration

**File**: `/packages/ai/src/api/generateGroupWorkoutBlueprint.ts`

**Before**:
```typescript
// Phase 2.5: Group merge scoring with cohesion
const groupScoredExercises = groupMergeScoring(
  clientScoredExercises,
  groupContext.groupCohesionSettings
);

// Phase 3: Template organization
const handler = new GroupWorkoutTemplateHandler(
  template,
  groupContext,
  cohesionAnalysis
);
```

**After**:
```typescript
// Phase 3: Template organization (no Phase 2.5)
const processor = new TemplateProcessor(template);
const blueprint = processor.processForGroup(clientScoredExercises);
```

### 4. Debugger Optimization

**File**: `/packages/api/src/utils/groupWorkoutTestDataLogger.ts`

**Major Changes**:
- Complete rewrite to split data into focused files
- Removed all cohesion tracking
- Only stores essential exercise fields
- File size reduced from ~1MB to ~200-300KB per file
- Added `totalFilteredCount` field to track filter effectiveness
- Updated `logClientProcessing` method signature to accept filtering stats and scored exercises separately

**New File Structure**:
```
session-test-data/group-workouts/{sessionId}/
├── 1-overview.json      # Quick summary, timing, warnings
├── 2-clients.json       # Individual client processing details
├── 3-group-pools.json   # Simplified group exercise pools
└── 4-blueprint.json     # Block organization and candidates
```

### 5. Frontend Updates

**Removed Components**:
- `CohesionTrackingCard` component
- Cohesion bonus displays (+X.XX scores)
- Cohesion ratio tracking

**Fixed Runtime Errors**:
- "Cannot read properties of undefined (reading 'toFixed')" - removed cohesionBonus references
- "Cannot read properties of undefined (reading 'map')" - removed cohesion tracking arrays

**Group Visualization Enhancements**:
- Modified to display all filtered exercises, not just top candidates
- Updated max rows calculation to use `allFilteredExercises` when available
- Candidates (top 3) are highlighted with blue borders
- All other filtered exercises shown without borders
- Dynamic candidate determination based on `exercises` array length

### 6. Movement Pattern Filtering Fix

**Issue**: Exercises with wrong movement patterns (core, arm_isolation) were appearing in blocks with specific pattern filters

**Root Cause**: The `isClientIncludedExercise` method was checking `score > 8` instead of checking the actual include boost

**Fix**:
```typescript
private isClientIncludedExercise(exercise: ScoredExercise, clientId: string): boolean {
  // Check if the exercise has an include boost in its score breakdown
  if (exercise.scoreBreakdown && 'includeExerciseBoost' in exercise.scoreBreakdown) {
    return exercise.scoreBreakdown.includeExerciseBoost > 0;
  }
  return false;
}
```

### 7. Training Session Router Updates

**File**: `/packages/api/src/router/training-session.ts`

**Changes**:
- Fixed empty clients array in GroupContext initialization
- Added UserProfile fetching alongside WorkoutPreferences for complete client context
- Properly populate client contexts from both WorkoutPreferences and UserProfile tables
- Updated debugger method calls to match new API (logClientProcessing parameters)
- Removed cohesion settings references
- Fixed nullish coalescing operators (|| → ??)
- Fixed initGroupSession → initSession method name change

## API Changes

### GroupContext Type
**Before**:
```typescript
interface GroupContext {
  clients: ClientContext[];
  groupCohesionSettings: GroupCohesionSettings;
  clientGroupSettings: ClientGroupSettings;
  sessionId: string;
  businessId: string;
  templateType: string;
}
```

**After**:
```typescript
interface GroupContext {
  clients: ClientContext[];
  sessionId: string;
  businessId: string;
  templateType: string;
}
```

### GroupBlockBlueprint Type
**Added Field**:
```typescript
individualCandidates: {
  [clientId: string]: {
    exercises: ScoredExercise[];
    slotsToFill: number;
    allFilteredExercises?: ScoredExercise[]; // NEW - all exercises that passed filters
  };
}
```

## Testing Impact

**Removed Tests**:
- `applyGroupCohesionBonus.test.ts`
- `calculateClientGroupMetrics.test.ts`
- `cohesionAnalysis.test.ts`
- `groupMergeScoring.test.ts`
- `groupWorkoutTemplateHandler.test.ts`
- `selectGroupExercises.test.ts`
- `subGroupOptimizer.test.ts`
- `testHelpers.test.ts`

**Test Coverage**: The removed tests were all related to cohesion features. Core functionality remains well-tested through existing integration and unit tests.

## Performance Improvements

1. **Reduced Complexity**: Removed O(n²) cohesion calculations
2. **Smaller Debug Files**: Split files are 75% smaller
3. **Faster Processing**: No Phase 2.5 group merge scoring
4. **Simpler Data Structures**: No nested cohesion tracking objects

## Migration Notes

### For Developers
1. Update any imports from `GroupWorkoutTemplateHandler` to `TemplateProcessor`
2. Remove any references to cohesion settings in your code
3. Use the new debugger file structure for troubleshooting

### For Users
- No action required
- Workouts will be generated faster
- Debug data is now easier to read
- Movement pattern filtering now works correctly

## Future Considerations

1. **Individual Workout Support**: The TemplateProcessor has a placeholder for individual workout processing
2. **Enhanced Filtering**: Easy to add new filter types (equipment, muscle groups, etc.)
3. **Template Validation**: Could add template validation to ensure valid configurations
4. **Performance Metrics**: The cleaner structure makes it easier to add performance tracking

### 8. Additional Updates

**Group Prompt Builder** (`/packages/ai/src/prompts/groupPromptBuilder.ts`):
- Removed cohesion-related prompting
- Simplified to focus on individual client preferences and shared exercises

**Exercise Filtering Functions**:
- Updated `filterExercisesFromInput.ts` and `enhancedFilterExercisesFromInput.ts`
- Modified score breakdown handling

**Method Name Changes**:
- `initGroupSession` → `initSession` in GroupWorkoutTestDataLogger

## Summary

This refactor successfully:
- ✅ Removed ~2,000 lines of cohesion-related code
- ✅ Fixed movement pattern filtering bugs  
- ✅ Improved debugger performance and readability
- ✅ Simplified the group workout generation pipeline
- ✅ Maintained all core functionality
- ✅ Made the codebase more maintainable and extensible
- ✅ Enhanced frontend visualization to show all filtered exercises
- ✅ Fixed empty client context initialization

The new system is cleaner, faster, and more reliable while maintaining the core value proposition of personalized group workouts.