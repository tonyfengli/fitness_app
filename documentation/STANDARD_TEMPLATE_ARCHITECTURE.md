# Group Workout Architecture

This document covers the technical architecture for both **Standard (Strength)** and **Circuit** workout templates.

# Standard Template (Strength Training)

## Overview

The Standard workout system generates personalized workouts for multiple clients training together in a strength-focused session. It uses a sophisticated two-phase LLM generation strategy with deterministic pre-processing to ensure balanced, personalized, and equipment-efficient workouts.

## Key Concepts

### Workout Type
Controls exercise selection constraints (WHAT exercises are selected):

**Full Body Variations:**
- **`FULL_BODY_WITH_FINISHER`** - Balanced workout covering all movement patterns with metabolic finisher
- **`FULL_BODY_WITHOUT_FINISHER`** - Full body workout without finisher  
- **`FULL_BODY_WITHOUT_FINISHER_WITH_CORE`** - Full body workout without finisher but includes extra core exercises

**Targeted Variations (2-4 muscle groups):**
- **`TARGETED_WITH_FINISHER`** - Focused muscle group workout with metabolic finisher
- **`TARGETED_WITHOUT_FINISHER`** - Focused muscle group workout without finisher
- **`TARGETED_WITHOUT_FINISHER_WITH_CORE`** - Focused workout without finisher but includes extra core exercises
- **`TARGETED_WITH_FINISHER_WITH_CORE`** - Focused workout with both finisher and extra core exercises

### Client Status Flow
1. **`pending`** - Initial state after check-in
2. **`preferences_sent`** - SMS with preferences link sent
3. **`workout_ready`** - Client completed preferences (or skipped)
4. **`ready`** - Client confirmed ready on overview page

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STRENGTH WORKOUT FLOW                         │
│                                                                     │
│  SMS Check-in → Session Start → Preferences → Generation → TV      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT PREFERENCES PHASE                        │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ 4-Step      │    │ Muscle      │    │ Exercise     │          │
│  │ Wizard      │───▶│ History     │───▶│ Intensity    │          │
│  │ Interface   │    │ Modal       │    │ Selection    │          │
│  └─────────────┘    └─────────────┘    └──────────────┘          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKOUT GENERATION PIPELINE                       │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ Phase 1     │    │ Phase 2     │    │ Phase 3      │          │
│  │ Filtering   │───▶│ Scoring     │───▶│ Pre-         │          │
│  │ (Per Client)│    │ (Per Client)│    │ Assignment   │          │
│  └─────────────┘    └─────────────┘    └──────┬───────┘          │
│                                                 │                   │
│                                                 ▼                   │
│                              ┌──────────────────────────┐          │
│                              │ Phase 4: Constraint      │          │
│                              │ Bucketing & Phase 1 LLM  │          │
│                              │ (Concurrent per client)  │          │
│                              └──────────────┬───────────┘          │
│                                             │                      │
│                                             ▼                      │
│                              ┌──────────────────────────┐          │
│                              │ Phase 5: Deterministic   │          │
│                              │ Slot Assignment         │          │
│                              └──────────────┬───────────┘          │
│                                             │                      │
│                                             ▼                      │
│                              ┌──────────────────────────┐          │
│                              │ Phase 6: Round Org.     │          │
│                              │ Phase 2 LLM (Group)     │          │
│                              └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Data Structures

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
  workoutType?: 'FULL_BODY_WITH_CORE' | 'FULL_BODY_WITHOUT_CORE' | 
                'TARGETED_WITH_FINISHER' | 'TARGETED_WITHOUT_FINISHER';
  intensity?: 'low' | 'moderate' | 'high' | 'intense';
  
  // Exercise preferences
  muscle_target?: string[];  // Muscles to focus on
  muscle_lessen?: string[];  // Muscles to limit
  exercise_requests?: {
    include: string[];  // Must include these exercises
    avoid: string[];    // Never include these
  };
  avoid_joints?: string[];  // Safety overrides
  
  // Scoring inputs
  favoriteExerciseIds?: string[];  // From feedback ratings
  exerciseCount?: number;  // 4-7 exercises
}
```

### WorkoutExercise Record
```typescript
interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  clientId: string;
  roundNumber?: number;  // Assigned in Phase 2
  orderInRound?: number;
  sets?: number;
  reps?: string;
  isPreAssigned: boolean;  // Tracks pre-assignment
  source?: 'favorite' | 'shared' | 'core' | 'ai';
}
```

## Generation Pipeline Phases

### Phase 1: Exercise Filtering (Per Client)

**Purpose**: Filter exercise database based on client capabilities and constraints.

**Filter Order** (Each filter narrows the pool):
1. **Strength & Skill Capacity** - Cascading inclusion
2. **Joint Avoidance** - Safety override (removes even explicitly included)
3. **Exercise Avoidance** - Client's exclude list

### Phase 2: Exercise Scoring (Per Client)

**Purpose**: Score exercises based on preferences using a two-pass system.

**Scoring System**:
```typescript
// Base scoring
Base score: 5.0
Muscle target bonus: +2.0 (primary), +1.0 (secondary)  
Muscle lessen penalty: -3.0 (primary), -1.5 (secondary)
Favorite exercise boost: +2.0

// Include boost (second pass)
For included exercises: boost = (maxScore + 1.0) - currentScore
```

**Rules**:
- No bonus/penalty stacking (highest applies)
- Scores clamped to minimum 0
- Included exercises guaranteed highest scores

### Phase 3: Pre-Assignment (1-3 Exercises)

**Purpose**: Deterministically select key exercises before AI selection.

**Implementation**: `/packages/ai/src/core/templates/preAssignmentService.ts`

**Selection Logic**:

**Full Body Workouts:**
1. **Exercise #1: Top Favorite**
   - Highest-scored exercise from user's favorites
   - Must pass all filters and constraints
   
2. **Exercise #2: Shared Exercise**  
   - Selected from shared exercise pool
   - Must be different muscle group than Exercise #1
   - Falls back to second favorite if no shared available

**Targeted Workouts:**
1. **Exercise #1: Top Favorite from Target Muscles**
   - Highest-scored favorite that matches one of their muscle targets
   - Primary muscle must be in client's muscle target list
   
2. **Exercise #2: Shared Exercise from Remaining Targets**
   - Selected from shared exercise pool
   - Must match a different muscle target than Exercise #1
   - Falls back to second favorite matching constraints

**Both Workout Types:**
3. **Exercise #3: Core Exercise** (Workouts with "_WITH_CORE" suffix only)
   - Top-scored core exercise shared across clients
   - Only for workout types ending in `_WITH_CORE`

**Full Body Balance Requirements**:
- Must select 1 upper + 1 lower body exercise
- Classification priority: primary muscle > movement pattern
- Core exercises count as lower body

**Targeted Muscle Requirements**:
- All pre-assigned exercises must have primary muscle in client's target list
- Ensures coverage of different muscle targets in pre-assignment

### Phase 4: Constraint Bucketing & Phase 1 LLM

**Purpose**: Systematically select remaining exercises to meet constraints.

**Bucketing Process**:
1. **Movement Pattern Requirements** (Full Body)
   - Fill required patterns: squat, hinge, lunge, push, pull, core
   - Exclude pre-assigned to avoid duplication
   
2. **Muscle Target Requirements**
   - Select exercises matching muscle targets
   - Distribution based on number of targets
   
3. **Flex Slots**
   - Fill remaining with highest-scored exercises
   - Prioritize unused favorites

**Phase 1 LLM Generation**:
- **Concurrent calls** - One per client
- Each client gets 13 bucketed candidates + pre-assigned
- LLM selects final exercises based on:
  - Workout type strategy (Full Body vs Targeted)
  - Personal preferences and constraints
  - Exercise variety and balance

### Phase 5: Deterministic Slot Assignment

**Purpose**: Pre-process exercise placement before Phase 2 LLM organization.

**Implementation**: `/packages/api/src/utils/buildAllowedSlots.ts`

**Four-Phase Process**:

1. **Pin Highest-Tier Exercises**
   - Each client's top exercise → Round 1
   - Ensures everyone starts strong
   
2. **Shared Exercise Detection**
   - Groups clients sharing same exercise
   - Uses cohort-based assignment
   - Maximizes equipment efficiency
   
3. **Singleton Equipment Management**
   - Equipment with capacity = 1
   - Scheduled to avoid conflicts
   - Priority by scarcity
   
4. **Auto-Assignment**
   - If client has 1 exercise left and 1 slot
   - Automatically places exercise

**Equipment Capacity Tracking**:
```typescript
interface EquipmentCapacityMap {
  [equipmentId: string]: {
    capacity: number;
    usageByRound: Map<number, number>;
  }
}
```

### Phase 6: Round Organization (Phase 2 LLM)

**Purpose**: Organize all exercises into coherent rounds with creative naming.

**Process**:
1. Apply deterministic assignments from Phase 5
2. Single LLM call organizes remaining exercises
3. Creates round structure with:
   - Creative round names
   - Logical exercise sequencing
   - Equipment conflict resolution
   - Balanced intensity flow

**Output**:
```typescript
interface Phase2Result {
  placements: Array<[exerciseId: string, roundNumber: number]>;
  roundNames: string[];  // e.g., "Heavy Lower", "Upper Power"
  fixedAssignments: number;  // Count from deterministic phase
}
```

## Draft/Update Pattern

### Overview
The system uses a progressive generation pattern where exercises are created early and refined through multiple phases. This enables the TV to display partial results while generation continues.

### Exercise Lifecycle

**1. After Phase 4 (Phase 1 LLM):**
```typescript
// Exercises created with minimal structure
{
  workoutId: string,
  exerciseId: string,
  clientId: string,
  orderIndex: 999,  // Temporary placeholder
  groupName: null,  // No round assignment yet
  selectionSource: "llm_phase1" | "pre_assigned",
  isPreAssigned: boolean
}
```

**2. After Phase 5 (Deterministic Assignment):**
- Some exercises get fixed round assignments
- These show immediately on TV (Round 1)
- Remaining exercises still have orderIndex: 999

**3. After Phase 6 (Phase 2 LLM):**
```typescript
// All exercises now have final assignments
{
  ...previousFields,
  orderIndex: properIndex,  // Real ordering
  groupName: "Round X",     // Assigned round
  roundNumber: number       // 1-4
}
```

### Database Updates

**Phase 1 Completion:**
- Creates workout records with status: "draft"
- Bulk inserts all workout exercises
- Stores Phase 1 LLM output for debugging

**Phase 2 Completion:**
- Updates workout status to "ready"
- Batch updates all exercise round assignments
- Stores Phase 2 selections and round names

### Why This Pattern?

1. **Progressive Display**: TV can show Round 1 immediately while Phase 2 runs
2. **Failure Recovery**: If Phase 2 fails, at least partial workout exists
3. **Debugging**: Each phase's output is preserved
4. **Flexibility**: Exercises can be swapped between phases

## Real-Time Features

### Progressive Loading
- TV shows Round 1 immediately (from deterministic assignments)
- Phase 2 generation happens in background
- Seamless transition when Phase 2 completes

### Client Exercise Swapping
- Clients can swap exercises until workout starts
- Smart recommendations based on:
  - Same muscle group alternatives
  - Blueprint scoring
  - Available equipment
- Swaps tracked in `workoutExerciseSwaps` table

### Live Updates
- Supabase real-time for all changes
- Preference updates
- Exercise swaps
- Ready status changes

## API Endpoints

### Workout Generation
- **`trainingSession.generateGroupWorkoutBlueprint`** - Blueprint only (testing)
- **`trainingSession.generateAndCreateGroupWorkouts`** - Full generation
- **`trainingSession.generatePhase2Selections`** - TV-triggered Phase 2
- **`trainingSession.previewPhase2Data`** - Deterministic preview

### Client Interactions
- **`clientPreferences.updateMuscleTargets`** - Update muscle selections
- **`workoutSelections.swapExercisePublic`** - Swap exercises
- **`postWorkoutFeedback.submitExerciseFeedback`** - Rate exercises

### Performance Tracking
- **`postWorkoutFeedback.saveExercisePerformance`** - Log weights
- **`performance.getLatestPerformanceByUserExercises`** - Fetch for display

## Client Preferences Flow

### 4-Step Wizard
1. **Workout Focus**
   - Full Body vs Targeted
   - Core inclusion toggle
   
2. **Muscle Target** 
   - Full Body: max 3 muscles
   - Targeted: 2-4 muscles required
   
3. **Muscle Limit**
   - Any muscles to avoid
   - No limit on selections
   
4. **Intensity**
   - Determines exercise count:
     - Low: 4 exercises
     - Moderate: 5 exercises  
     - High: 6 exercises
     - Intense: 7 exercises

### Muscle History Modal
- Shows coverage over time periods
- Visual progress indicators
- Identifies gaps in training
- Influences target selection

## Equipment Management

### Capacity Types
1. **Unlimited** - No restrictions
2. **Limited** - Fixed capacity (e.g., 4 barbells)
3. **Singleton** - Capacity = 1 (e.g., 1 cable machine)

### Conflict Resolution
- Deterministic phase prevents conflicts
- Shared exercises maximize efficiency
- Singleton equipment carefully scheduled
- Real-time capacity tracking

## Performance & Feedback Integration

### Weight Tracking
- Previous weights displayed on TV
- PR (Personal Record) detection
- +/- 5 lbs increment controls
- Automatic progress tracking

### Exercise Ratings
- Like → Favorite (score boost +2.0)
- Dislike → Avoid (filtered out)
- Not Sure → No impact
- Influences future workouts

## Key Services

### Core Services
- **WorkoutGenerationService**: `/packages/api/src/services/workout-generation-service.ts`
- **WorkoutBlueprintService**: `/packages/api/src/services/workout-blueprint-service.ts`
- **StandardWorkoutGenerator**: `/packages/ai/src/workout-generation/standard/StandardWorkoutGenerator.ts`

### Supporting Services
- **PreAssignmentService**: `/packages/ai/src/core/templates/preAssignmentService.ts`
- **PostWorkoutFeedbackService**: `/packages/api/src/services/post-workout-feedback-service.ts`
- **PerformanceService**: `/packages/api/src/services/performance-service.ts`

### Prompt Strategies
- **FullBodyPromptStrategy**: Ensures movement pattern balance
- **TargetedPromptStrategy**: Focuses on specific muscles
- **Fallback**: Uses top-scored exercises if LLM fails

## Performance Characteristics

- **Filtering**: O(n × m) where n = clients, m = exercises
- **Scoring**: O(n × e) where e = exercises per client  
- **Pre-assignment**: O(n × 3) - constant per client
- **Bucketing**: O(n × c × e) where c = constraints
- **LLM calls**: n + 1 (n = client count)
- **Typical timing**: 800-1200ms for 3 clients (excluding LLM)

## Key Design Decisions

1. **Two-Phase LLM**: Personalized selection + coordinated organization
2. **Deterministic Pre-Processing**: Reduces LLM complexity and ensures constraints
3. **Progressive Loading**: Better UX with immediate Round 1 display
4. **Safety First**: Joint restrictions override all preferences
5. **Cohort-Based Sharing**: Efficient equipment utilization
6. **Flexible Swapping**: Client control with smart recommendations

## Future Considerations

- Enhanced equipment conflict prediction
- Multi-session workout planning
- Advanced muscle fatigue tracking
- Group-wide workout templates
- Real-time trainer adjustments

---

# Circuit Template

## Overview

The Circuit workout system generates time-based, high-intensity interval workouts for group training sessions. All clients perform the same exercises in synchronized rounds, making it ideal for semi-private group training. Unlike the Standard template's two-phase generation, Circuit uses a single-phase LLM generation with deterministic bucketing to ensure balanced movement patterns across the workout.

## Key Concepts

### Circuit Configuration
Controls the structure and timing of the workout:
- **Rounds**: Number of circuits to complete (1-10)
- **Exercises Per Round**: Exercises in each circuit (2-7)  
- **Work Duration**: Active exercise time in seconds (10-300)
- **Rest Duration**: Rest between exercises in seconds (5-120)
- **Rest Between Rounds**: Recovery between circuits (10-300)
- **Repeat Rounds**: Option to perform all rounds twice

### Template Type
Circuit workouts use `templateType: "circuit"` which triggers:
- Time-based exercise execution (vs rep-based)
- Synchronized group movement (vs individual pacing)
- Single shared exercise pool (vs personalized selection)
- Movement pattern bucketing (vs muscle group targeting)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CIRCUIT WORKOUT FLOW                         │
│                                                                     │
│  SMS Check-in → Config Setup → Generation → Preview → TV Broadcast  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TRAINER CONFIGURATION                           │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ 4-Step      │    │ Circuit     │    │ Real-time    │          │
│  │ Wizard      │───▶│ Parameters  │───▶│ Preview      │          │
│  │             │    │ Setup       │    │              │          │
│  └─────────────┘    └─────────────┘    └──────────────┘          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT GENERATION PIPELINE                       │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ Phase 1     │    │ Phase 2     │    │ Phase 3      │          │
│  │ Filtering   │───▶│ Scoring     │───▶│ Deterministic│          │
│  │ (Circuit)   │    │ Override    │    │ Bucketing    │          │
│  └─────────────┘    └─────────────┘    └──────┬───────┘          │
│                                                 │                   │
│                                                 ▼                   │
│                              ┌──────────────────────────┐          │
│                              │ Phase 4: Single LLM      │          │
│                              │ Round Organization       │          │
│                              └──────────────┬───────────┘          │
│                                             │                      │
│                                             ▼                      │
│                              ┌──────────────────────────┐          │
│                              │ Broadcast & Real-time    │          │
│                              │ Synchronization          │          │
│                              └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Data Structures

### CircuitConfig
```typescript
interface CircuitConfig {
  type: 'circuit';
  config: {
    rounds: number;              // 1-10 rounds
    exercisesPerRound: number;   // 2-7 exercises per round  
    workDuration: number;        // 10-300 seconds
    restDuration: number;        // 5-120 seconds
    restBetweenRounds: number;   // 10-300 seconds
    repeatRounds?: boolean;      // Repeat entire circuit
  };
  lastUpdated?: string;
  updatedBy?: string;
}
```

### Circuit Exercise Structure
```typescript
interface CircuitExercise {
  name: string;
  equipment: string[];
  movementPattern: string;
  primaryMuscle: string;
  score: number;  // Always 5.0 in circuit MVP
}
```

### Circuit Workout Storage
```typescript
interface CircuitWorkout {
  // Same as standard workout but with:
  workoutType: 'circuit';
  templateConfig: CircuitConfig;
  // Exercises stored with:
  groupName: 'Round 1' | 'Round 2' | ...;
  template: { value: 'circuit' };  // JSONB field
}
```

## Generation Pipeline Phases

### Phase 1: Exercise Filtering (Circuit-Specific)

**Purpose**: Filter exercises suitable for circuit training.

**Circuit-Specific Filters**:
1. **Equipment accessibility** - Prioritize easily transitioned equipment
2. **Movement suitability** - Favor dynamic, time-based movements
3. **Safety for fatigue** - Exclude high-skill movements unsafe when tired
4. **Group scalability** - Exercises that work for mixed abilities

### Phase 2: Scoring Override

**Purpose**: Simplify scoring for circuit context.

**Circuit MVP Implementation**:
```typescript
// All exercises get equal score for deterministic bucketing
if (criteria.templateType === 'circuit') {
  return exercises.map(ex => ({ ...ex, score: 5.0 }));
}
```

**Rationale**: 
- Prevents preference bias in movement pattern distribution
- Ensures balanced selection across all patterns
- Simplifies bucketing algorithm

### Phase 3: Deterministic Bucketing

**Purpose**: Systematically select exercises ensuring movement pattern variety.

**Implementation**: `/packages/ai/src/workout-generation/prompts/sections/group/circuitPrompt.ts:21-143`

**Bucketing Targets** (32 exercises total):
1. **Squat (knee-dominant)**: 5 exercises
2. **Hinge (hip-dominant)**: 4 exercises  
3. **Push**: 6 exercises (3 horizontal + 3 vertical)
4. **Pull**: 5 exercises (4 horizontal + 1 vertical)
5. **Core**: 7 exercises
6. **Capacity/Conditioning**: 2 exercises

**Process**:
```typescript
function selectCircuitExercises(allExercises, rawExercises) {
  // 1. Group by movement pattern
  const exercisesByPattern = groupByMovementPattern(exercises);
  
  // 2. Select from each bucket with shuffle for variety
  const selected = [];
  selected.push(...shuffle(squatExercises).slice(0, 5));
  selected.push(...shuffle(hingeExercises).slice(0, 4));
  // ... continue for each pattern
  
  // 3. Fill remaining slots if any bucket was short
  if (selected.length < 32) {
    fillFromPriorityOrder(selected, targetCount);
  }
  
  return selected;
}
```

### Phase 4: Single LLM Round Organization

**Purpose**: Organize bucketed exercises into balanced rounds.

**Key Differences from Standard**:
- **Single LLM call** (vs two-phase in Standard)
- **No personalization** - All clients get same exercises
- **Focus on variety** - Each round must have mixed patterns
- **Flow optimization** - Minimize equipment transitions

**LLM Instructions**:
1. No repeated movement patterns within a round
2. Balance push/pull and squat/hinge across circuit
3. Include at least 1 unilateral/balance exercise
4. Save high-impact moves for final round only
5. Logical flow avoiding constant position changes
6. Start with "confidence builder" exercises

**Output Format**:
```json
{
  "rounds": [
    {"r":1,"ex":["ex_1","ex_2","ex_3","ex_4","ex_5","ex_6"]},
    {"r":2,"ex":["ex_7","ex_8","ex_9","ex_10","ex_11","ex_12"]},
    {"r":3,"ex":["ex_13","ex_14","ex_15","ex_16","ex_17","ex_18"]}
  ],
  "notes": "Optional guidance ≤140 chars"
}
```

## Trainer Configuration Flow

### 4-Step Wizard

1. **Welcome Screen**
   - Session overview
   - Template selection (Circuit)

2. **Circuit Configuration**
   - Number of rounds (slider: 1-10)
   - Exercises per round (slider: 2-7)
   - Work duration (preset options)
   - Rest duration (preset options)

3. **Advanced Options**
   - Rest between rounds
   - Repeat rounds toggle
   - Save as preset option

4. **Preview & Confirmation**
   - Total workout duration calculation
   - Configuration summary
   - Edit or confirm buttons

### Real-Time Configuration Updates

**Hook**: `useRealtimeCircuitConfig`
- Listens to `TrainingSession` table updates
- Filters for `templateType === 'circuit'`
- Updates UI when trainer modifies settings
- Handles connection errors gracefully

## Key Differences: Circuit vs Standard

| Aspect | Circuit | Standard |
|--------|---------|----------|
| **Generation Phases** | Single LLM call | Two-phase LLM |
| **Exercise Selection** | Same for all clients | Personalized per client |
| **Pre-assignment** | None | 1-3 exercises |
| **Scoring Impact** | Disabled (all 5.0) | Full scoring system |
| **Exercise Count** | Rounds × Exercises/Round | 4-7 per client |
| **Organization** | By rounds | By equipment/muscle groups |
| **Timing** | Time-based | Rep-based |
| **Equipment Strategy** | Avoid conflicts | Cohort sharing |
| **Client Preferences** | Not used | Full preference system |
| **Swapping** | Trainer only | Client + trainer |

## Real-Time Features

### Live Configuration
- Trainer can modify circuit parameters
- Changes broadcast to all devices instantly
- TV updates timer displays automatically

### Exercise Substitution  
- Trainer can swap exercises pre-workout
- Maintains movement pattern balance
- Updates propagate to all clients

### Progress Tracking
- Real-time round/exercise indicators
- Synchronized timers across devices
- Visual work/rest transitions

## API Endpoints

### Circuit Generation
- **`trainingSession.generateGroupWorkoutBlueprint`** - Test generation
- **`trainingSession.generateAndCreateGroupWorkouts`** - Full circuit creation

### Configuration Management
- **`trainingSession.update`** - Update circuit config in templateConfig
- **`circuitTrainingConfig.upsert`** - Save trainer's circuit preferences

### Real-Time Subscriptions
- **Circuit config channel**: `circuit-config-${sessionId}`
- **Workout updates**: Standard workout channels

## Storage Patterns

### Session Level
```typescript
// TrainingSession record
{
  id: string,
  templateType: 'circuit',
  templateConfig: CircuitConfig,
  // ... other fields
}
```

### Workout Level
```typescript
// Workout record (one per client)
{
  workoutType: 'circuit',
  context: 'group',
  llmOutput: { rounds, notes },
  templateConfig: CircuitConfig
}
```

### Exercise Level
```typescript
// WorkoutExercise records
{
  groupName: 'Round 1',  // Instead of 'Block A'
  template: { value: 'circuit' },  // JSONB
  isShared: true,
  sharedWithClients: [clientId1, clientId2, ...],
  // No sets/reps - timing from config
}
```

## Performance Characteristics

- **Filtering**: O(e) where e = total exercises
- **Bucketing**: O(e × p) where p = movement patterns
- **LLM call**: Single call regardless of client count
- **Storage**: O(r × e × c) where r = rounds, e = exercises/round, c = clients
- **Typical timing**: 400-600ms (excluding LLM)

## Key Design Decisions

1. **Single-Phase Generation**: Simpler than Standard, fits circuit nature
2. **Deterministic Bucketing**: Ensures movement variety without AI bias  
3. **Equal Scoring**: Prevents favoritism affecting pattern distribution
4. **Synchronized Execution**: All clients move together for group energy
5. **Time-Based**: Better for conditioning than rep counting
6. **Trainer Control**: Configuration flexibility for different group needs

## Circuit-Specific Services

### Core Services
- **CircuitPromptGenerator**: `/packages/ai/src/workout-generation/prompts/sections/group/circuitPrompt.ts`
- **CircuitBucketingService**: Integrated in prompt generator
- **CircuitConfigValidator**: `/packages/validators/src/training-session.ts`

### Real-Time Hooks
- **useRealtimeCircuitConfig**: `/packages/ui-shared/src/hooks/useRealtimeCircuitConfig.ts`
- Standard hooks work for circuit workouts with no modifications

## Future Considerations

- Exercise progression tracking across sessions
- Circuit performance analytics
- Custom movement pattern ratios
- Equipment station optimization
- Heart rate zone integration
- Circuit template library