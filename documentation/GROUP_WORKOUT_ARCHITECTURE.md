# Group Workout Architecture

## Overview

The group workout system generates personalized workouts for multiple clients training together. It supports two distinct template systems that share common filtering and scoring infrastructure but diverge in their organization and generation strategies:

1. **BMF Template** (`full_body_bmf`) - Block-based organization with single-phase LLM generation
2. **Standard Template** (`standard`) - Client-pooled organization with two-phase LLM generation

## Template Type vs Workout Type

The system uses two complementary configuration concepts:

### Template Type
Controls the workout generation strategy (HOW workouts are generated):
- **`full_body_bmf`** - Uses block-based rounds with deterministic + LLM selection
- **`standard`** - Uses client-pooled approach with constraint-based bucketing

### Workout Type  
Controls exercise selection constraints (WHAT exercises are selected):
- **`FULL_BODY_WITH_FINISHER`** - Full body workout with metabolic finisher
- **`FULL_BODY_WITHOUT_FINISHER`** - Full body workout without finisher
- **`TARGETED_WITH_FINISHER`** - Muscle-targeted workout with finisher
- **`TARGETED_WITHOUT_FINISHER`** - Muscle-targeted workout without finisher

These work together: `templateType` determines the generation flow while `workoutType` determines the exercise constraints and bucketing rules applied during that flow.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GROUP WORKOUT REQUEST                         │
│                                                                     │
│  Session Creation → Client Check-ins → Generate Group Workout      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SHARED PIPELINE PHASES                            │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ Phase 1     │    │ Phase 2     │    │ Phase 3      │          │
│  │ Filtering   │───▶│ Scoring     │───▶│ Template     │          │
│  │ (Per Client)│    │ (Per Client)│    │ Processing   │          │
│  └─────────────┘    └─────────────┘    └──────────────┘          │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────────────┐
│     BMF TEMPLATE FLOW     │   │      STANDARD TEMPLATE FLOW       │
│                           │   │                                   │
│  ┌───────────────────┐   │   │  ┌─────────────┐                 │
│  │ Single-Phase LLM  │   │   │  │ Pre-         │                 │
│  │ Generation        │   │   │  │ Assignment   │                 │
│  │ (Rounds 3-4)      │   │   │  │ (Currently   │                 │
│  └───────────────────┘   │   │  │  Disabled)   │                 │
│                           │   │  └──────┬──────┘                 │
│                           │   │         │                        │
│                           │   │         ▼                        │
│                           │   │  ┌─────────────┐                 │
│                           │   │  │ Constraint   │                 │
│                           │   │  │ Bucketing    │                 │
│                           │   │  └──────┬──────┘                 │
│                           │   │         │                        │
│                           │   │         ▼                        │
│                           │   │  ┌─────────────────────┐         │
│                           │   │  │ Two-Phase LLM      │         │
│                           │   │  │ • Phase 1: Select  │         │
│                           │   │  │ • Phase 2: Organize│         │
│                           │   │  └─────────────────────┘         │
└───────────────────────────┘   └───────────────────────────────────┘
```

## Core Data Structures

### GroupContext
```typescript
interface GroupContext {
  // Core client data
  clients: ClientContext[];
  
  // Session identification
  sessionId: string;
  businessId: string;
  
  // Template configuration
  templateType?: string;  // 'standard' or 'full_body_bmf'
  workoutType?: WorkoutType;  // e.g., 'FULL_BODY_WITH_FINISHER'
  
  // Legacy field - not actively used
  groupExercisePools?: {
    [blockId: string]: GroupScoredExercise[];
  };
}
```

### ClientContext
```typescript
interface ClientContext {
  // Identity
  user_id: string;
  name: string;
  
  // Physical capabilities
  strength_capacity: 'very_low' | 'low' | 'moderate' | 'high';
  skill_capacity: 'very_low' | 'low' | 'moderate' | 'high';
  
  // Session preferences
  primary_goal?: 'mobility' | 'strength' | 'general_fitness' | 'hypertrophy' | 'burn_fat';
  intensity?: 'low' | 'moderate' | 'high' | 'intense';
  
  // Exercise preferences
  muscle_target?: string[];
  muscle_lessen?: string[];
  exercise_requests?: {
    include: string[];
    avoid: string[];
  };
  avoid_joints?: string[];
  
  // Additional fields
  business_id?: string;
  templateType?: 'standard' | 'circuit' | 'full_body';
  default_sets?: number;
  favoriteExerciseIds?: string[];
}
```

## Shared Pipeline Phases (1-3)

### Phase 1: Exercise Filtering (Per Client)

**Purpose**: Filter the exercise database based on each client's capabilities and constraints.

**Module**: `/packages/ai/src/core/filtering/filterExercises.ts`

#### Filter Application Order

1. **Include Exercises Separation**
   - Explicitly requested exercises separated first
   - Bypass strength/skill restrictions
   - Still subject to joint restrictions

2. **Strength & Skill Filtering**
   - Cascading inclusion (higher levels include lower)
   - Applied to non-included exercises only

3. **Joint Avoidance (Safety Override)**
   - Filters exercises loading specified joints
   - Applies to ALL exercises including includes
   - Safety takes absolute priority

4. **Exclude Filter (Final)**
   - Removes exercises from avoid list
   - Absolute override of everything

#### Implementation Details

```typescript
// Strength cascading example
if (strengthCapacity === 'moderate') {
  // Includes: very_low, low, and moderate exercises
}

// Joint filtering always applied
if (avoidJoints.includes('knee')) {
  // Removes all knee-loading exercises, even if explicitly included
}
```

### Phase 2: Exercise Scoring (Per Client)

**Purpose**: Score exercises based on client preferences using a two-pass system.

**Module**: `/packages/ai/src/core/scoring/scoreExercises.ts`

#### Two-Pass Scoring System

**First Pass** - Calculate natural scores:
- Base score: 5.0
- Muscle target bonus: +3.0 (primary), +1.5 (secondary)
- Muscle lessen penalty: -3.0 (primary), -1.5 (secondary)
- Favorite exercise boost: +2.0
- ~~Intensity adjustment~~ (DEPRECATED - always returns 0)
- Track maximum score achieved

**Second Pass** - Apply include boost:
- For included exercises: boost = (maxScore + 1.0) - currentScore
- Ensures included exercises rank highest
- Other exercises retain first pass scores

#### Score Breakdown Structure
```typescript
interface ScoredExercise extends Exercise {
  score: number;
  scoreBreakdown: {
    base: number;              // Always 5.0
    includeExerciseBoost: number;  // > 0 if client requested
    muscleTargetBonus: number;
    muscleLessenPenalty: number;
    intensityAdjustment: number;   // Always 0 (deprecated)
    favoriteBoost: number;         // 2.0 if in favorites
    total: number;                 // Clamped to min 0
  };
}
```

#### Scoring Rules

- **No Stacking**: Only highest muscle bonus/penalty applies
- **Score Clamping**: Final scores cannot go below 0
- **Include Priority**: Guaranteed highest scores through dynamic boost

### Phase 3: Template Processing

**Purpose**: Route to template-specific organization strategy.

**Module**: `/packages/ai/src/core/templates/TemplateProcessor.ts`

Based on `templateType`, exercises are organized differently:

#### BMF Template (`processForGroup`)
Creates `GroupWorkoutBlueprint` with:
- Block-based organization (Round1, Round2, etc.)
- Shared exercise detection (2+ clients, all score ≥ 5.0)
- Movement pattern filtering per block
- Client includes bypass block filters

#### Standard Template (`processForStandardGroup`)
Creates `StandardGroupWorkoutBlueprint` with:
- Client-pooled exercise organization
- Pre-assignment integration (when enabled)
- Preparation for constraint bucketing
- No block-based filtering

## Template-Specific Flows

### BMF Template Flow

After Phase 3, BMF templates proceed directly to:

#### Single-Phase LLM Generation

**Strategy**: Deterministic + LLM hybrid
- Rounds 1-2: Deterministic selection from top candidates
- Rounds 3-4: LLM selection with custom prompt
- Single LLM call for entire group

**Implementation**: 
- `WorkoutGenerationService.generateBMFWorkouts()`
- Uses `WorkoutPromptBuilder` for prompt construction
- Returns complete workout with all rounds assigned

### Standard Template Flow

After Phase 3, Standard templates have additional phases:

#### Pre-Assignment Phase (Currently Disabled)

**Status**: Temporarily disabled (`preAssignedCount: 0`) but fully implemented

**When Enabled**, pre-assignment follows these rules:

**Selection Priority**:
1. **Include exercises** - All client-requested exercises (no limit)
2. **Favorite exercises** - Top-scored favorites (max 2)

**Limits by Workout Type**:
- Full Body WITH Finisher: 4 total max
- Full Body WITHOUT Finisher: 2 total max
- Targeted workouts: 4 total max

**Body Part Balance** (Full Body only):
- MUST select 1 upper body + 1 lower body from favorites
- Classification based on primary muscle first, then movement pattern
- Special case: "core" muscle classified as lower body

**Tie-Breaking**:
- When multiple exercises have equal scores
- Random selection from tied candidates
- Tracks `tiedCount` for transparency

**Implementation Details**:
```typescript
// Body part classification logic
function getBodyPart(exercise: ScoredExercise): BodyPart {
  const primaryMuscle = exercise.primaryMuscle.toLowerCase();
  
  // Primary muscle takes precedence
  if (UPPER_BODY_MUSCLES.includes(primaryMuscle)) return 'upper';
  if (LOWER_BODY_MUSCLES.includes(primaryMuscle)) return 'lower';
  
  // Fall back to movement pattern
  const pattern = exercise.movementPattern?.toLowerCase();
  if (UPPER_BODY_PATTERNS.includes(pattern)) return 'upper';
  
  return 'lower'; // Default for core, etc.
}
```

#### Constraint Bucketing Phase

**Purpose**: Systematically fulfill workout constraints through phased selection.

**Module**: `/packages/ai/src/workout-generation/bucketing/fullBodyBucketing.ts`

Bucketing ensures exactly 13 exercises are selected (in addition to pre-assigned) through four phases:

**Phase 1: Movement Patterns**
- Fill required movement pattern slots
- Exclude pre-assigned exercises to avoid duplication
- Exclude favorites (reserved for flex slots)
- Randomize selection when scores are tied

**Phase 2: Muscle Target**
- Fill muscle target requirements (4 exercises)
- Match PRIMARY muscles only (not secondary)
- Case-insensitive muscle name matching
- Balanced distribution for multiple targets:
  - 1 target: all 4 exercises for that muscle
  - 2 targets: 2 exercises each
  - 3+ targets: distributed as evenly as possible

**Phase 3: Capacity** (With Finisher only)
- Select 1 exercise with 'capacity' function tag
- Skip for WITHOUT_FINISHER workout types

**Phase 4: Flex Slots**
- Fill remaining slots to reach exactly 13
- Priority order:
  1. Unused favorite exercises
  2. Highest scoring available exercises
- Ensures total of 15 exercises (2 pre-assigned + 13 bucketed)

**Constraint Configurations**:

```typescript
// Full Body WITH Finisher
{
  movementPatterns: {
    squat: { min: 1, max: 1 },
    hinge: { min: 1, max: 1 },
    lunge: { min: 1, max: 1 },
    horizontal_push: { min: 1, max: 1 },
    vertical_push: { min: 1, max: 1 },
    horizontal_pull: { min: 1, max: 1 },
    vertical_pull: { min: 1, max: 1 },
    core: { min: 1, max: 1 }
  },
  functionalRequirements: {
    capacity: 1,
    muscle_target: 4
  },
  flexSlots: 2,
  totalExercises: 15
}

// Full Body WITHOUT Finisher
{
  // Same movement patterns except:
  core: { min: 2, max: 2 },  // 2 core instead of 1
  
  functionalRequirements: {
    capacity: 0,  // No capacity requirement
    muscle_target: 4
  },
  flexSlots: 2,
  totalExercises: 15
}
```

#### Two-Phase LLM Generation

**Module**: `/packages/api/src/workout-generation/standard/StandardWorkoutGenerator.ts`

**Phase 1: Individual Exercise Selection**
- **Concurrent LLM calls** - One per client
- Each client gets personalized prompt
- Selects from bucketed candidates
- Uses `ClientExerciseSelectionPromptBuilder`
- Returns selected exercises per client

**Phase 2: Round Organization**
- **Single LLM call** for all clients
- Organizes selected exercises into rounds
- Manages equipment conflicts
- Synchronizes timing across clients
- Uses `RoundOrganizationPromptBuilder`
- Returns final workout structure

**Key Differences from BMF**:
- N+1 total LLM calls (vs 1 for BMF)
- Personalized selection per client
- Separate organization phase for coordination
- More granular control over individual preferences

## API Endpoints

### Blueprint Generation (Visualization/Testing)
**Endpoint**: `trainingSession.generateGroupWorkoutBlueprint`
- Runs Phases 1-3 + template-specific processing
- Returns blueprint without LLM generation
- Useful for testing and visualization

### Full Workout Generation
**Endpoint**: `trainingSession.generateAndCreateGroupWorkouts`
- Complete pipeline from blueprint to saved workouts
- Options:
  - `skipBlueprintCache`: Force regeneration
  - `dryRun`: Generate without saving
  - `includeDiagnostics`: Include LLM prompts/responses

## Key Services and File Locations

### Core Services
- **WorkoutGenerationService**: `/packages/api/src/services/workout-generation-service.ts`
  - Orchestrates overall generation flow
  - Routes to template-specific strategies
  
- **WorkoutBlueprintService**: `/packages/api/src/services/workout-blueprint-service.ts`
  - Prepares client contexts
  - Manages exercise pools

- **TemplateProcessor**: `/packages/ai/src/core/templates/TemplateProcessor.ts`
  - Routes to template-specific processing
  - Handles shared exercise detection

- **PreAssignmentService**: `/packages/ai/src/core/templates/preAssignmentService.ts`
  - Implements priority-based selection
  - Ensures body part balance

### Type Definitions
- **GroupContext/ClientContext**: `/packages/ai/src/types/clientContext.ts`
- **ScoredExercise**: `/packages/ai/src/types/scoredExercise.ts`
- **Blueprints**: `/packages/ai/src/types/groupWorkoutBlueprint.ts`
- **Standard Blueprint**: `/packages/ai/src/types/standardBlueprint.ts`

### Scoring System
- **Config**: `/packages/ai/src/core/scoring/scoringConfig.ts`
- **First Pass**: `/packages/ai/src/core/scoring/firstPassScoring.ts`
- **Second Pass**: `/packages/ai/src/core/scoring/secondPassScoring.ts`

### Bucketing
- **Full Body**: `/packages/ai/src/workout-generation/bucketing/fullBodyBucketing.ts`
- **Targeted**: (To be implemented)

## Frontend Integration

The Group Workout Visualization displays:

### Exercise Organization
- Pre-assigned exercises with source indicators
- Bucketed exercises with constraint labels
- All filtered exercises (not just selected)
- Score breakdowns showing all adjustments

### Constraint Analysis
- Real-time constraint fulfillment status
- Pre-assignment requirements (when enabled)
- Movement pattern coverage
- Muscle target distribution

### Visual Indicators
- Tie-breaking badges showing selection randomization
- Shared exercise overlap between clients
- Constraint violation warnings
- Source tracking (Include/Favorite/Constraint)

## Performance Characteristics

- **Phase 1-2**: O(n × m) where n = clients, m = exercises
- **Phase 3**: O(n × e) where e = exercises per client
- **Pre-assignment**: O(n × f) where f = favorite count
- **Bucketing**: O(n × c × e) where c = constraint types
- **LLM calls**: 
  - BMF: 1 total
  - Standard: n + 1 (n = client count)
- **Typical timing**: 600-1000ms for 3 clients (excluding LLM)

## Key Design Decisions

1. **Two-Pass Scoring**: Ensures client-requested exercises always rank highest while maintaining fair scoring for others

2. **Safety First**: Joint restrictions override all preferences including explicit includes

3. **Flexible Architecture**: Template type and workout type work independently, allowing new combinations

4. **Randomized Tie-Breaking**: Provides variety when multiple exercises have equal scores

5. **Body Part Balance**: Ensures full-body coverage in favorite selections

6. **Constraint-Based Selection**: Systematic approach to meeting workout requirements

7. **Pre-Assignment Flexibility**: Can be enabled/disabled without affecting other systems

## Future Considerations

- Implement bucketing for Targeted workout types
- Re-enable pre-assignment when ready
- Add trust scoring for exercise recommendations
- Optimize LLM token usage for larger groups
- Enhanced equipment conflict resolution
- Real-time workout adjustments during session