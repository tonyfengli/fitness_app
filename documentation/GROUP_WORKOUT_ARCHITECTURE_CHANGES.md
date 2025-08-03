# Group Workout Architecture - Major Changes and Updates

## Overview of Changes

The group workout system has undergone significant updates since the original architecture document. This document outlines all major changes, focusing on the new **Standard Template** flow and enhanced constraint-based exercise selection.

## 1. Template System Evolution

### Original Architecture
- Single template type: `full_body_bmf` (BMF-specific)
- Block-based organization with rounds
- Template-specific LLM strategies

### Current Implementation
- **Two distinct template flows**:
  1. **BMF Templates** (block-based): Original implementation
  2. **Standard Templates** (client-pooled): New two-phase LLM approach
- Added workout type system with 4 types:
  - `FULL_BODY_WITH_FINISHER`
  - `FULL_BODY_WITHOUT_FINISHER`
  - `TARGETED_WITH_FINISHER`
  - `TARGETED_WITHOUT_FINISHER`

## 2. New Standard Template Architecture

### Key Differences from BMF
- **Client-pooled exercises** instead of block-based organization
- **Two-phase LLM approach** with pre-assignment and bucketing
- **Constraint-based selection** with movement patterns and functional requirements
- **Body part balancing** for favorite exercises

### New Data Structures

```typescript
// New StandardGroupWorkoutBlueprint (replaces block-based for standard templates)
interface StandardGroupWorkoutBlueprint {
  clientExercisePools: {
    [clientId: string]: ClientExercisePool;
  };
  sharedExercisePool: GroupScoredExercise[];
  metadata: {
    templateType: string;
    workoutFlow: 'strength-metabolic' | 'pure-strength';
    totalExercisesPerClient: number;
    preAssignedCount: number;
  };
}

// New ClientExercisePool structure
interface ClientExercisePool {
  preAssigned: PreAssignedExercise[];
  availableCandidates: ScoredExercise[];
  bucketedSelection?: BucketedSelection;
  totalExercisesNeeded: number;
  additionalNeeded: number;
}
```

## 3. New Pre-Assignment System

### What Changed
- **Original**: No pre-assignment phase
- **Current**: Sophisticated pre-assignment based on workout type

### Pre-Assignment Features
1. **Workout Type Strategies** (`workoutTypeStrategies.ts`):
   - Each workout type has specific pre-assignment rules
   - Priority-based selection (includes → favorites → constraints)
   
2. **Body Part Balancing** (Full Body workouts):
   - MUST select 1 upper body + 1 lower body favorite
   - Intelligent classification based on primary muscle and movement pattern
   - Tie-breaking randomization for equal scores

3. **Pre-Assignment Rules by Type**:
   ```typescript
   // Full Body (With/Without Finisher)
   - 2 favorites with body part balance
   - Max 2 pre-assignments
   
   // Targeted workouts
   - Up to 4 pre-assignments
   - Focus on muscle targets
   - Include capacity exercises
   ```

## 4. New Bucketing System

### What Changed
- **Original**: Direct LLM selection from all candidates
- **Current**: Phased bucketing to fulfill constraints

### Bucketing Phases (Full Body workouts)
1. **Phase 1: Movement Patterns**
   - Fill 8-9 movement pattern requirements
   - Exclude favorites to avoid duplication
   - Tie-breaking randomization

2. **Phase 2: Muscle Target**
   - Fill 4 muscle target exercises
   - PRIMARY muscle only (not secondary)
   - Balanced distribution for multiple targets
   - Case-insensitive matching

3. **Phase 3: Capacity**
   - Fill 1 capacity exercise (With Finisher only)
   - Exercises with 'capacity' function tag

4. **Phase 4: Flex Slots**
   - Fill remaining with favorites first
   - Fall back to highest scoring exercises
   - Reaches exactly 13 bucketed exercises

## 5. Constraint System

### New Constraint Structure
```typescript
interface BucketConstraints {
  movementPatterns: Record<string, { min: number; max: number }>;
  functionalRequirements: Record<string, number>;
  flexSlots: number;
  totalExercises: number;
}
```

### Key Constraint Differences
**Full Body With Finisher**:
- 8 movement patterns (1 core)
- 1 capacity, 4 muscle_target
- 15 total exercises

**Full Body Without Finisher**:
- 9 movement patterns (2 core)
- 0 capacity, 4 muscle_target
- 15 total exercises

## 6. Frontend Updates

### Constraint Analysis Display
- Dynamic constraint checking from `BUCKET_CONFIGS`
- Real-time fulfillment status
- Combined pre-assigned + bucketed exercise analysis

### New UI Elements
1. **Pre-Assignment Requirements** (Full Body With Finisher only):
   - Shows "2 favorites (1 upper body + 1 lower body)"
   
2. **Smart Bucketed Selection**:
   - Shows constraint type for each exercise
   - Tie-breaking indicators
   - Distinguishes flex slots from constraint fulfillment

3. **Removed Features**:
   - "Selected Exercises (Top 8)" tab
   - Blue highlighting for hardcoded exercises

## 7. New Files and Modules

### Workout Generation
- `/packages/ai/src/workout-generation/strategies/workoutTypeStrategies.ts`
- `/packages/ai/src/workout-generation/bucketing/fullBodyBucketing.ts`
- `/packages/ai/src/workout-generation/utils/constraintAnalyzer.ts`

### Core Templates
- `/packages/ai/src/core/templates/preAssignmentService.ts`
- Updated `TemplateProcessor.ts` with `processForStandardGroup` method

### Types
- `/packages/ai/src/types/standardBlueprint.ts`
- Updated `clientTypes.ts` with `BUCKET_CONFIGS`

## 8. API Flow Changes

### Original Flow
1. Filter exercises
2. Score exercises
3. Process through template blocks
4. LLM selection

### Current Standard Template Flow
1. Filter exercises
2. Score exercises with favorites (+2.0 bonus)
3. **Pre-assignment phase** (new)
4. Process for standard group (client pools)
5. **Apply bucketing** (new)
6. Two-phase LLM approach

## 9. Key Implementation Details

### Tie-Breaking System
- Tracks exercises with equal scores
- Random selection from tied candidates
- UI indicators showing tie count

### Case-Insensitive Matching
- Movement patterns normalized to lowercase
- Muscle names compared case-insensitively
- Prevents mismatches in constraint fulfillment

### Favorite Exercise Handling
- +2.0 score bonus (documented in original)
- Pre-assigned based on body part balance
- Fill flex slots after constraints

## 10. Configuration and Extensibility

### Workout Type Configuration
- Centralized in `BUCKET_CONFIGS`
- Easy to add new workout types
- Frontend automatically adapts

### Bucketing Extensibility
- Modular phase design
- Easy to add new constraint types
- Reusable for similar workout types

## Summary of Major Additions

1. **Standard Template System** - Complete alternative to BMF templates
2. **Pre-Assignment Logic** - Intelligent exercise pre-selection
3. **Constraint-Based Bucketing** - Systematic constraint fulfillment
4. **Body Part Balancing** - Ensures exercise variety
5. **Tie-Breaking System** - Fair selection from equal scores
6. **Dynamic Frontend** - Adapts to workout type constraints

The system now supports more sophisticated exercise selection while maintaining the original BMF template functionality, providing flexibility for different workout styles and client needs.