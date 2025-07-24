# Group Workout Architecture

## Overview

This document describes the current architecture of the group (semi-private) workout system, which generates personalized workouts for multiple clients training together. The system leverages the existing workout generation pipeline with modifications to support group dynamics.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GROUP WORKOUT REQUEST                         │
│                                                                     │
│  Session Lobby → Generate Group Workout → GroupContext Creation    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GROUP WORKOUT PIPELINE                            │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐          │
│  │ Phase 1     │    │ Phase 2     │    │ Phase 3      │          │
│  │ Filtering   │───▶│ Scoring     │───▶│ Template     │          │
│  │ (Per Client)│    │ (Per Client)│    │ Processing   │          │
│  └─────────────┘    └─────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────┐    ┌──────────────┐                              │
│  │ Phase 4     │    │ Phase 5      │                              │
│  │ Set Count   │───▶│ LLM Workout  │                              │
│  │ (Individual)│    │ Generation   │                              │
│  └─────────────┘    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
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
  templateType?: string;  // e.g., 'workout', 'circuit_training', 'full_body_bmf'
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
  primary_goal: string;
  intensity: 'low' | 'moderate' | 'high';
  
  // Exercise preferences
  muscle_target?: string[];
  muscle_lessen?: string[];
  exercise_requests?: {
    include: string[];
    avoid: string[];
  };
  avoid_joints?: string[];
}
```

## Pipeline Phases

**Important Note**: Phases 1 and 2 use the EXACT SAME filtering and scoring functions as individual workouts. Each client is processed independently through these phases, ensuring consistent scoring logic across both individual and group workouts.

### Phase 1: Exercise Filtering (Per Client)

**Purpose**: Filter the exercise database based on each client's capabilities and constraints.

**Core Module**: `core/filtering/filterExercises.ts`

```
Input: 
- ClientContext (per client)
- Exercise database (all or business-specific)

Filter Application Order:
┌─────────────────────────────────────────┐
│  1. Include exercises (separated first) │
│  2. Strength & Skill filters (remaining)│
│  3. Joint avoidance (on ALL exercises) │
│  4. Exclude filter (final, absolute)    │
└─────────────────────────────────────────┘

Output: Map<clientId, Exercise[]>
```

#### Filtering Rules

**1. Strength Level Filtering**
- Cascading inclusion: higher levels include all lower levels
- Levels: `very_low` → `low` → `moderate` → `high`
- Example: "moderate" includes exercises for very_low, low, and moderate

**2. Skill Level Filtering**
- Cascading inclusion: higher levels include all lower levels  
- Levels: `very_low` → `low` → `moderate` → `high`
- Applies to exercise `complexityLevel` field

**3. Include Exercises Override**
- Explicitly requested exercises bypass strength/skill restrictions
- Does NOT bypass joint restrictions (safety priority)
- Separated before standard filtering to avoid duplication

**4. Joint Avoidance (Safety Override)**
- Filters exercises that load specified joints
- Applies to ALL exercises, including explicitly included ones
- Safety takes precedence over client requests

**5. Exclude/Avoid Exercises**
- Final filter - removes exercises regardless of other logic
- Absolute priority - overrides everything including explicit includes

### Phase 2: Exercise Scoring (Per Client)

**Purpose**: Score exercises based on each client's preferences and goals.

**Core Module**: `core/scoring/scoreExercises.ts`

```
Input: Filtered Exercise[] per client

Two-Pass Scoring Process:
┌─────────────────────────────────────────┐
│  Pass 1: Calculate base scores for all │
│  Pass 2: Re-score included exercises   │
│         with boost to guarantee top    │
│         ranking (max_score + 1.0)      │
└─────────────────────────────────────────┘

Output: Map<clientId, ScoredExercise[]> sorted by score (highest first)
```

#### Scoring Algorithm

**Base Score**: 5.0 (all exercises start here)

**Muscle Target Bonuses** (No Stacking):
- Primary muscle match: **+3.0**
- Secondary muscle match: **+1.5**
- Only highest bonus applies (no stacking for multiple matches)

**Muscle Lessen Penalties** (No Stacking):
- Primary muscle match: **-3.0**
- Secondary muscle match: **-1.5**
- Only highest penalty applies (no stacking for multiple matches)

**Intensity Adjustments**:
Maps workout intensity to exercise fatigue profiles:

| Workout Intensity | Exercise Fatigue Type | Adjustment |
|------------------|----------------------|------------|
| **Low** | low_local | +1.5 |
| **Low** | moderate_local | +0.75 |
| **Low** | high_local | -1.5 |
| **Low** | moderate_systemic | -0.75 |
| **Low** | high_systemic | -1.5 |
| **Low** | metabolic | -1.5 |
| **Moderate** | All types | 0 |
| **High** | low_local | -1.5 |
| **High** | moderate_local | -0.75 |
| **High** | high_local | +1.5 |
| **High** | moderate_systemic | +0.75 |
| **High** | high_systemic | +1.5 |
| **High** | metabolic | +1.5 |

**Include Exercise Priority Boost**:
- Applied in Pass 2
- Boost = (max_score + 1.0) - current_score
- Guarantees included exercises rank highest

**Score Clamping**: 
- Final scores clamped to minimum of 0
- No negative scores allowed

**Score Breakdown Structure** (Always Included):
```typescript
interface ScoredExercise extends Exercise {
  score: number;
  scoreBreakdown: {  // NOT optional - always included
    base: number;              // Always 5.0
    includeExerciseBoost: number;
    muscleTargetBonus: number;
    muscleLessenPenalty: number;
    intensityAdjustment: number;
    total: number;             // Clamped to min 0
  };
}
```

### Phase 3: Template Processing

**Purpose**: Organize exercises into workout blocks based on template configuration.

**Key Component**: `TemplateProcessor`

```
Input: 
- Map<clientId, ScoredExercise[]>
- WorkoutTemplate

Process:
┌─────────────────────────────────────────────────────┐
│              For Each Block:                        │
│                                                     │
│  1. Filter exercises by block requirements:        │
│     - Function tags (e.g., 'primary_strength')     │
│     - Movement patterns (include/exclude)          │
│     - Equipment constraints                         │
│     - Client includes always bypass filters        │
│                                                     │
│  2. Identify shared exercises:                      │
│     - Find exercises available to 2+ clients       │
│     - Only include if ALL sharing clients score    │
│       the exercise >= 5.0 (base score)             │
│     - Calculate group score (average of client     │
│       scores)                                       │
│     - Sort by client count, then group score       │
│                                                     │
│  3. Prepare candidates:                             │
│     - Shared: All exercises with 2+ clients        │
│     - Individual: Top 3 × maxExercises per client  │
│     - Include allFilteredExercises for visibility  │
│                                                     │
│  4. Calculate slot allocation:                      │
│     - targetShared = 40% of maxExercises           │
│     - actualShared = min(target, available)        │
│     - individualPerClient = remaining slots        │
└─────────────────────────────────────────────────────┘

Output: GroupWorkoutBlueprint
```

**Key Features**:
- Movement pattern filtering with proper include/exclude logic
- Client-included exercises (`includeExerciseBoost > 0`) bypass all filters
- Simplified shared exercise detection (no cohesion bonuses)
- All filtered exercises available for frontend display

### Phase 4: Set Count Determination

**Purpose**: Determine appropriate set counts for each exercise based on client capabilities.

```
Process:
┌─────────────────────────────────────────┐
│    Each client maintains individual:    │
│                                         │
│  - Strength level → base set range     │
│  - Intensity preference → adjustment   │
│  - Exercise type → specific ranges     │
│                                         │
│  LLM handles final distribution in      │
│  Phase 5 based on these constraints    │
└─────────────────────────────────────────┘
```

### Phase 5: LLM Workout Generation (Hybrid Strategy)

**Purpose**: Use LLM to select final exercises and create coherent workouts.

```
Input: GroupWorkoutBlueprint

Process:
┌─────────────────────────────────────────────────────┐
│                Hybrid LLM Strategy                  │
│                                                     │
│  Step 1: Shared Exercise Selection                 │
│  ├─ Input: All block blueprints                    │
│  ├─ Task: Select shared exercises from candidates  │
│  ├─ Consider: Client overlap, balance, variety     │
│  └─ Output: SharedSelectionOutput                  │
│                                                     │
│  Step 2: Individual Workout Generation (Parallel)  │
│  ├─ Input per client:                              │
│  │   - Assigned shared exercises                   │
│  │   - Individual exercise candidates              │
│  │   - Slots to fill per block                     │
│  ├─ Task: Complete individual workout              │
│  └─ Output: CompleteWorkout per client             │
│                                                     │
│  Step 3: Final Assembly                            │
│  └─ Combine into GroupWorkout structure            │
└─────────────────────────────────────────────────────┘

Output: GroupWorkout with exercises, sets, rest periods
```

## Data Flow Example

```
1. Session Creation
   └─> GroupContext {
         clients: [
           { user_id: "A", strength_capacity: "moderate", intensity: "high", ... },
           { user_id: "B", strength_capacity: "low", intensity: "moderate", ... }
         ],
         templateType: "full_body_bmf"
       }

2. Phase 1 & 2 (Parallel per client)
   └─> For each client:
       // Phase 1: Filtering
       filterExercises({
         exercises: exercisePool,
         clientContext: client,
         includeScoring: false
       })
       
       // Phase 2: Scoring
       scoreAndSortExercises(filtered, {
         intensity: client.intensity,
         muscleTarget: client.muscle_target || [],
         muscleLessen: client.muscle_lessen || [],
         includeExercises: client.exercise_requests?.include
       })
   
   └─> Client A: 150 filtered → 150 scored exercises
   └─> Client B: 120 filtered → 120 scored exercises

3. Phase 3 (Template Processing)
   └─> Block "Round1" {
         sharedCandidates: 7 exercises (available to both)
         individualCandidates: {
           "A": { exercises: [top 3], allFilteredExercises: [all 25] },
           "B": { exercises: [top 3], allFilteredExercises: [all 20] }
         }
       }

4. Phase 5 (LLM Selection)
   └─> Shared: Selects 0-1 shared exercises based on availability
   └─> Individual: Each client gets remaining slots filled
```

## Template Configuration

### Creating and Configuring Templates

Templates define the workout structure through blocks. Each block can be configured independently:

```typescript
interface BlockDefinition {
  id: string;                    // Unique identifier (e.g., 'Round1', 'BlockA')
  name: string;                  // Display name
  functionTags: string[];        // Filter by exercise function (e.g., ['primary_strength'])
  maxExercises: number;          // Maximum exercises the LLM can select
  candidateCount?: number;       // Number of candidates to display (defaults to maxExercises)
  selectionStrategy: 'deterministic' | 'randomized';
  
  // Optional filters
  movementPatternFilter?: {
    include?: string[];  // Only these patterns (e.g., ['squat', 'hinge'])
    exclude?: string[];  // Exclude these patterns
  };
  equipmentFilter?: {
    required?: string[];  // Must have one of these
    forbidden?: string[]; // Cannot have any of these
  };
}
```

#### Key Configuration Options:

1. **Function Tags**: Controls which exercise types appear
   - Empty array `[]` = no function tag filtering
   - Multiple tags = exercises must have at least one matching tag
   - Common tags: `primary_strength`, `secondary_strength`, `accessory`, `core`, `capacity`

2. **Exercise Limits**:
   - `maxExercises`: How many exercises the LLM can actually select for the workout
   - `candidateCount`: How many exercise options to show in the UI (with blue borders)
   - Separation allows showing more options while limiting final selection

3. **Movement Pattern Filtering**:
   - `include`: Whitelist specific movement patterns
   - `exclude`: Blacklist specific movement patterns
   - Patterns: `squat`, `hinge`, `lunge`, `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`

4. **Selection Strategy**:
   - `deterministic`: Top-scored exercises
   - `randomized`: LLM can choose from candidates

### Example: BMF Template Configuration

The Full Body BMF template demonstrates advanced round-based configuration:

```typescript
export const FULL_BODY_BMF_TEMPLATE: WorkoutTemplate = {
  id: 'full_body_bmf',
  name: 'Full Body BMF',
  description: 'Bold Movement Fitness full body workout with 4 sequential rounds',
  blocks: [
    {
      id: 'Round1',
      name: 'Round 1',
      functionTags: ['primary_strength', 'secondary_strength'],
      maxExercises: 1,      // LLM selects 1 exercise
      candidateCount: 1,    // Show 1 candidate
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge']  // Lower body only
      }
    },
    {
      id: 'Round2',
      name: 'Round 2',
      functionTags: [],     // No function tag filter
      maxExercises: 1,      // LLM selects 1 exercise
      candidateCount: 6,    // Show 6 candidates for variety
      selectionStrategy: 'randomized',
      movementPatternFilter: {
        include: ['vertical_pull', 'horizontal_pull']  // Pulling only
      }
    },
    {
      id: 'Round3',
      name: 'Round 3',
      functionTags: [],     // No function tag filter
      maxExercises: 2,      // LLM selects up to 2 exercises
      candidateCount: 8,    // Show 8 candidates
      selectionStrategy: 'randomized'
      // No movement pattern filter - all exercises eligible
    },
    {
      id: 'FinalRound',
      name: 'Final Round',
      functionTags: ['core', 'capacity'],  // Core/conditioning focus
      maxExercises: 2,      // LLM selects up to 2 exercises
      candidateCount: 8,    // Show 8 candidates
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['Round1', 'Round2', 'Round3', 'FinalRound']
};
```

#### BMF Template Design Rationale:

- **Round 1**: Single lower body movement to start (squat/hinge/lunge)
- **Round 2**: Pulling focus with more variety (6 candidates, 1 selection)
- **Round 3**: Open selection from all exercises (no restrictions)
- **Final Round**: Core and conditioning to finish

The separation of `candidateCount` and `maxExercises` allows:
- Round 2 to show 6 options but only select 1 (variety with focus)
- Rounds 3 & 4 to show 8 options but select up to 2 (flexibility)

## Debugging and Monitoring

The system includes comprehensive debugging through `GroupWorkoutTestDataLogger`:

```
session-test-data/group-workouts/{sessionId}/
├── 1-overview.json      # Session summary, timing, client list
├── 2-clients.json       # Per-client filtering and scoring details
├── 3-group-pools.json   # Shared exercise analysis
└── 4-blueprint.json     # Final block organization
```

**Key Metrics**:
- Filtering effectiveness (exercises remaining after each filter)
- Score distributions per client
- Shared exercise availability per block
- Template constraint satisfaction

## Frontend Integration

The Group Workout Visualization page displays:
- All exercises that pass block filters (not just top candidates)
- Top 3 candidates highlighted with blue borders
- Shared exercise possibilities with client overlap
- Score breakdowns and adjustments

## Key Design Decisions

1. **No Cohesion Complexity**: Removed cohesion bonuses and complex group scoring in favor of simple averaging
2. **Client Preferences First**: Client includes always override template constraints
3. **Transparent Scoring**: All score adjustments visible in scoreBreakdown
4. **Flexible Templates**: Templates guide organization but don't enforce rigid rules
5. **Efficient Debugging**: Split debug files for better performance and readability
6. **Shared Exercise Minimum Score**: Exercises must score >= 5.0 (base score) for ALL sharing clients to be considered shared. This prevents suggesting exercises that have net negative adjustments for any client in the group

## Performance Characteristics

- Phase 1 & 2: O(n × m) where n = clients, m = exercises
- Phase 3: O(n × b × e) where b = blocks, e = exercises per client
- Typical timing: ~500-600ms for 3 clients with full exercise database
- Debug file size: ~200-300KB (down from ~1MB)

## Future Extensibility

The architecture supports:
- Individual workout generation (placeholder in TemplateProcessor)
- Additional filter types (muscle groups, training styles)
- Custom scoring algorithms per template
- Real-time workout adjustments
- Performance analytics integration