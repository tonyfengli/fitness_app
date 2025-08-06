# Standard Workout Generation

This module implements the two-phase workout generation system for the "standard" template.

## Overview

The Standard template uses a two-phase LLM approach:
1. **Phase 1: Exercise Selection** - Select exercises for each client based on their preferences and constraints
2. **Phase 2: Round Organization** - Organize selected exercises into rounds with sets, reps, and equipment management

## Key Differences from BMF Template

- **BMF Template**: Block-based with deterministic and randomized selections per round
- **Standard Template**: Client-pooled exercises selected first, then organized into rounds

## Pre-Assignment Logic

For full body workouts (with or without finisher), the system pre-assigns 2 exercises per client before the LLM selection phase:

### Exercise Selection Rules

1. **Exercise #1: Highest Favorite**
   - Selects the highest scoring favorite exercise for each client
   - No body type constraints applied
   - Ties are broken randomly

2. **Exercise #2: Shared Exercise (Other Pool)**
   - Selected from the "Other Shared Exercises" pool (excludes core/capacity tagged exercises)
   - Must have opposite body type from Exercise #1:
     - If Exercise #1 is upper body → Exercise #2 must be lower body
     - If Exercise #1 is lower body → Exercise #2 must be upper body
     - If Exercise #1 is core/full body → Exercise #2 can be either upper or lower
   - Uses cascading selection (tries all clients first, then N-1, down to 2 minimum)
   - All participating clients receive the same shared exercise

### Body Category Classification

Exercises are classified into three body categories:
- **Upper**: Horizontal/vertical push/pull patterns, upper body muscles (chest, back, shoulders, etc.)
- **Lower**: Squat, lunge, hinge patterns, lower body muscles (quads, hamstrings, glutes, calves)
- **Core/Full**: Core muscles, capacity-tagged exercises

### Fallback Logic

Clients who cannot participate in the shared Exercise #2 selection (due to constraints) fall back to their second highest favorite with opposite body type constraint.

## Shared Exercise Categorization

Shared exercises are split into two categories with different scoring thresholds:

1. **Core & Finisher Exercises**
   - Exercises with 'core' OR 'capacity' functional tags
   - Minimum score threshold: 5.0

2. **Other Shared Exercises**
   - All other exercises without core/capacity tags
   - Minimum score threshold: 6.5
   - Used for Exercise #2 pre-assignment in full body workouts

## Components

### PreAssignmentService
Handles the pre-assignment logic for full body workouts:
- `processFullBodyPreAssignmentsWithShared()`: Implements the Exercise #1 and #2 selection
- `getBodyCategory()`: Classifies exercises into upper/lower/core_full categories
- Manages cascading shared exercise selection and fallback logic

### StandardWorkoutGenerator
Main orchestrator for the two-phase generation process. Includes:
- Retry logic (up to 3 attempts per phase)
- Comprehensive logging
- Validation for both phases

### ExerciseSelectionPromptBuilder
Builds the Phase 1 prompt that includes:
- Client profiles and preferences
- Available exercise pools per client (excluding pre-assigned)
- Shared exercise opportunities
- Constraints and priorities

### RoundOrganizationPromptBuilder  
Builds the Phase 2 prompt that includes:
- Selected exercises from Phase 1
- Equipment management requirements
- Workout flow specifications
- Timing and rest period guidelines

### SharedExerciseFilters
Utility functions for categorizing shared exercises:
- `categorizeSharedExercises()`: Splits exercises into Core & Finisher vs Other
- `isCoreOrFinisherExercise()`: Checks if an exercise has core/capacity tags

## Usage

```typescript
const generator = new StandardWorkoutGenerator();
const plan = await generator.generate(
  blueprint,      // StandardGroupWorkoutBlueprint
  groupContext,   // GroupContext
  template,       // WorkoutTemplate
  sessionId       // string
);
```

## Blueprint Structure

```typescript
interface StandardGroupWorkoutBlueprint {
  clientExercisePools: {
    [clientId: string]: {
      preAssigned: PreAssignedExercise[];
      availableCandidates: ScoredExercise[];
      totalExercisesNeeded: number;
      additionalNeeded: number;
    };
  };
  sharedExercisePool: GroupScoredExercise[];
  metadata: {
    templateType: string;
    workoutFlow: 'strength-metabolic' | 'pure-strength';
    totalExercisesPerClient: number;
    preAssignedCount: number;
  };
}

interface PreAssignedExercise {
  exercise: ScoredExercise;
  source: 'Round1' | 'Round2' | 'Include' | 'favorite' | 'shared_other' | 'shared_core_finisher' | string;
  tiedCount?: number; // Number of exercises tied at the same score
  sharedWith?: string[]; // Client IDs if this is a shared exercise selection
}
```

## Exercise Selection Flow

1. **Pre-Assignment Phase** (for full body workouts)
   - PreAssignmentService selects Exercise #1 and #2 per client
   - Shared exercises are coordinated globally across clients
   - Pre-assigned exercises are excluded from Phase 1 pools

2. **Phase 1: LLM Exercise Selection**
   - LLM selects from available candidates (excluding pre-assigned)
   - Respects client constraints and preferences
   - Prioritizes shared exercises when possible

3. **Phase 2: Round Organization**
   - Combines pre-assigned and LLM-selected exercises
   - Organizes into workout rounds with proper flow
   - Manages equipment transitions

## Output Structure

The generator returns a `StandardWorkoutPlan` containing:
- `exerciseSelection`: Results from Phase 1
- `roundOrganization`: Results from Phase 2
- `metadata`: Generation metadata including timing

## Error Handling

- Each phase has 3 retry attempts
- Comprehensive validation after each LLM call
- Detailed error messages for debugging
- Fallback logic for clients who cannot participate in shared selections

## Performance

- Pre-assignment: < 100ms
- Phase 1 typically completes in 2-4 seconds
- Phase 2 typically completes in 1-3 seconds
- Total generation time: 3-7 seconds