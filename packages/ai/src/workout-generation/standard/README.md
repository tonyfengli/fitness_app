# Standard Workout Generation

This module implements the two-phase workout generation system for the "standard" template.

## Overview

The Standard template uses a two-phase LLM approach:
1. **Phase 1: Exercise Selection** - Select exercises for each client based on their preferences and constraints
2. **Phase 2: Round Organization** - Organize selected exercises into rounds with sets, reps, and equipment management

## Key Differences from BMF Template

- **BMF Template**: Block-based with deterministic and randomized selections per round
- **Standard Template**: Client-pooled exercises selected first, then organized into rounds

## Components

### StandardWorkoutGenerator
Main orchestrator for the two-phase generation process. Includes:
- Retry logic (up to 3 attempts per phase)
- Comprehensive logging
- Validation for both phases

### ExerciseSelectionPromptBuilder
Builds the Phase 1 prompt that includes:
- Client profiles and preferences
- Available exercise pools per client
- Shared exercise opportunities
- Constraints and priorities

### RoundOrganizationPromptBuilder  
Builds the Phase 2 prompt that includes:
- Selected exercises from Phase 1
- Equipment management requirements
- Workout flow specifications
- Timing and rest period guidelines

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
```

## Output Structure

The generator returns a `StandardWorkoutPlan` containing:
- `exerciseSelection`: Results from Phase 1
- `roundOrganization`: Results from Phase 2
- `metadata`: Generation metadata including timing

## Error Handling

- Each phase has 3 retry attempts
- Comprehensive validation after each LLM call
- Detailed error messages for debugging

## Performance

- Phase 1 typically completes in 2-4 seconds
- Phase 2 typically completes in 1-3 seconds
- Total generation time: 3-7 seconds