# Group Workout Architecture Integration

## Overview
This document maps how the group (semi-private) workout system integrates with the existing 5-phase workout creation engine.

## High-Level Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GROUP WORKOUT REQUEST                         │
│                                                                     │
│  Session Lobby → Generate Group Workout → GroupContext Creation    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EXISTING PIPELINE                            │
│                      (Modified for Groups)                           │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │ Phase 1     │    │ Phase 2     │    │ Phase 2.5   │           │
│  │ Filtering   │───▶│ Scoring     │───▶│ Group Merge │           │
│  │ (Per Client)│    │ (Per Client)│    │ (NEW)       │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │ Phase 3     │    │ Phase 4     │    │ Phase 5     │           │
│  │ Set Count   │───▶│ Template    │───▶│ LLM Calls   │           │
│  │ (Group Avg) │    │ (Modified)  │    │ (Hybrid)    │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## Detailed Phase Integration

### Phase 1: Exercise Filtering (Minimal Changes)
```
Input: GroupContext {
  clients: ClientContext[]
  groupCohesionSettings: GroupCohesionSettings
  clientGroupSettings: ClientGroupSettings
  sessionId: string
  businessId: string
  templateType?: 'standard' | 'circuit' | 'full_body'
}

Process:
┌─────────────────────────────────────────┐
│          For Each Client:               │
│                                         │
│  Client 1 Context → Filter → Exercise[] │
│  Client 2 Context → Filter → Exercise[] │
│  Client 3 Context → Filter → Exercise[] │
│  ...                                    │
└─────────────────────────────────────────┘

Output: FilteredExercises[] per client
```

### Phase 2: Exercise Scoring (No Changes)
```
Input: FilteredExercises[] per client

Process:
┌─────────────────────────────────────────┐
│          For Each Client:               │
│                                         │
│  Client 1 Exercises → Score → Scored[]  │
│  Client 2 Exercises → Score → Scored[]  │
│  Client 3 Exercises → Score → Scored[]  │
│  ...                                    │
└─────────────────────────────────────────┘

Output: ScoredExercise[] per client
```

### Phase 2.5: Group Merge Scoring (NEW - IMPLEMENTED)
```
Input: 
- ScoredExercise[] per client
- BlockConfig[] (from template)

Process:
┌─────────────────────────────────────────────────────┐
│              For Each Block:                        │
│                                                     │
│  1. Collect top N exercises from each client       │
│     N = Math.ceil(block.maxExercises * 1.5)        │
│  2. Merge into exercise map tracking overlaps      │
│  3. Calculate for each exercise:                   │
│     - Average score (only clients who have it)     │
│     - Cohesion bonus = (numClientsSharing - 1) * 0.5│
│     - Group score = avgScore + cohesionBonus       │
│  4. Sort by group score descending                 │
│                                                     │
│  Result stored in GroupContext.groupExercisePools  │
└─────────────────────────────────────────────────────┘

Output: GroupContext with groupExercisePools populated
```

### Phase 3: Set Count Determination (NO CHANGES NEEDED)
```
Each client maintains their own:
- Strength level
- Intensity preference
- Individual set count range

LLM will handle distribution during Phase 5
```

### Phase 4: Template Organization (Enhanced)
```
Input: 
- GroupExercisePool per block
- Individual ScoredExercise[] per client
- GroupCohesionSettings

Process:
┌─────────────────────────────────────────────────────────┐
│                  Block Planning                         │
│                                                         │
│  Block A (70% shared):                                 │
│  ├─ Select 2-3 from GroupExercisePool                  │
│  └─ Track which clients get which exercises            │
│                                                         │
│  Block B (50% shared):                                 │
│  ├─ Select 1-2 from GroupExercisePool                  │
│  └─ Reserve slots for individual exercises             │
│                                                         │
│  Block C (30% shared):                                 │
│  ├─ Mostly individual selections                       │
│  └─ Optional 1 shared exercise                         │
│                                                         │
│  Block D (100% shared):                                │
│  └─ Must find exercises ALL clients can do             │
└─────────────────────────────────────────────────────────┘

Output: BlockPlan with shared/individual exercise slots
```

### Phase 5: LLM Workout Generation (Hybrid Approach)
```
Input: BlockPlan with exercise candidates

Process:
┌─────────────────────────────────────────────────────────┐
│                  LLM Call Strategy                      │
│                                                         │
│  Step 1: Shared Group Call                             │
│  ├─ Input: GroupExercisePool, BlockPlan                │
│  ├─ Task: Select shared exercises                      │
│  └─ Output: SharedExerciseAssignments                  │
│                                                         │
│  Step 2: Parallel Individual Calls                     │
│  ├─ Input: SharedAssignments + Individual pools        │
│  ├─ Task: Fill remaining slots                         │
│  └─ Output: CompleteWorkout per client                 │
│                                                         │
│  Step 3: Final Assembly                                │
│  └─ Merge shared + individual into GroupWorkout        │
└─────────────────────────────────────────────────────────┘

Output: GroupWorkout with per-client variations
```

## Data Structure Flow

```
GroupContext
    ↓
┌───────────────────────────┐
│ Phase 1-2: Individual     │
│ ┌─────────┐ ┌─────────┐  │
│ │Client 1 │ │Client 2 │  │
│ │Filtered │ │Filtered │  │
│ │& Scored │ │& Scored │  │
│ └─────────┘ └─────────┘  │
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Phase 2.5: Group Merge    │
│ ┌─────────────────────┐  │
│ │  groupExercisePools: │  │
│ │  blockA: [...]       │  │
│ │  blockB: [...]       │  │
│ │  blockC: [...]       │  │
│ │  blockD: [...]       │  │
│ └─────────────────────┘  │
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Phase 4: Block Planning   │
│ ┌─────────────────────┐  │
│ │  Shared: [Ex1, Ex2] │  │
│ │  Individual: [...]   │  │
│ └─────────────────────┘  │
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Phase 5: LLM Generation   │
│ ┌─────────────────────┐  │
│ │  GroupWorkout       │  │
│ │  - Client workouts  │  │
│ │  - Shared blocks    │  │
│ └─────────────────────┘  │
└───────────────────────────┘
```

## Key Integration Points

### 1. Entry Point
- New endpoint: `/api/group-workout/generate`
- Reuses existing `filterExercisesFromInput.ts` with modifications

### 2. Minimal Changes to Existing Phases
- Phase 1 & 2: Run as-is, just multiple times
- Phase 3: New group calculation logic
- Phase 4: Enhanced to handle group constraints
- Phase 5: New hybrid LLM strategy

### 3. New Components
```
packages/ai/src/
├── types/
│   └── groupContext.ts         // GroupContext interface (IMPLEMENTED)
├── core/
│   └── group-scoring/         // (IMPLEMENTED)
│       ├── index.ts           // Exports
│       ├── mergeScores.ts     // Phase 2.5 main logic
│       └── cohesionCalculator.ts // Analysis utilities
└── workout-generation/
    └── group/                 // (PENDING - Phase C)
        ├── groupPromptBuilder.ts
        └── hybridLLMStrategy.ts
```

### 4. Implemented Types

```typescript
// GroupContext - Main container for group workout generation
interface GroupContext {
  clients: ClientContext[];
  groupCohesionSettings: GroupCohesionSettings;
  clientGroupSettings: ClientGroupSettings;
  sessionId: string;
  groupExercisePools?: {
    [blockId: string]: GroupScoredExercise[];
  };
  businessId: string;
  templateType?: 'standard' | 'circuit' | 'full_body';
}

// Flexible block-based cohesion configuration
interface GroupCohesionSettings {
  blockSettings: {
    [blockId: string]: {
      sharedRatio: number;      // 0.0-1.0
      enforceShared?: boolean;
    };
  };
  defaultSharedRatio: number;
}

// Per-client workout cohesion preferences
interface ClientGroupSettings {
  [clientId: string]: {
    cohesionRatio: number;  // 0.0-1.0
  };
}

// Exercise with group scoring metadata
interface GroupScoredExercise extends ScoredExercise {
  groupScore: number;
  clientScores: {
    clientId: string;
    individualScore: number;
    hasExercise: boolean;
  }[];
  cohesionBonus: number;
  clientsSharing: string[];
}
```

### 4. Database Considerations
```sql
-- Option 1: Extend existing workout table
ALTER TABLE workout ADD COLUMN group_workout_id UUID;
ALTER TABLE workout ADD COLUMN is_group_primary BOOLEAN DEFAULT FALSE;

-- Option 2: New group workout table
CREATE TABLE group_workout (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES training_session(id),
  cohesion_settings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_workout_member (
  group_workout_id UUID REFERENCES group_workout(id),
  workout_id UUID REFERENCES workout(id),
  client_id TEXT REFERENCES user(id),
  PRIMARY KEY (group_workout_id, client_id)
);
```

## Implementation Phases

### Phase A: Foundation ✅ COMPLETED
1. ✅ Create GroupContext type
   - Implemented flexible block-based cohesion settings
   - Added per-client cohesion preferences
   - Structured to flow through entire pipeline
   
2. ✅ Add Phase 2.5 group merge scoring
   - `performGroupMergeScoring()` orchestrates the process
   - Takes top 1.5x block max exercises per client
   - Cohesion bonus: (numClientsSharing - 1) * 0.5
   - Averages only clients who have the exercise
   
3. ✅ ~~Modify Phase 3 for group set counts~~
   - No changes needed - LLM handles distribution
   - Each client maintains individual intensity/strength

### Phase B: Block Planning (NEXT)
1. Enhance Phase 4 with group constraints
2. Create shared/individual slot allocation
3. Add cohesion ratio enforcement

### Phase C: LLM Integration
1. Build hybrid LLM strategy
2. Create group-aware prompts
3. Implement parallel client calls

### Phase D: Storage & UI
1. Database schema for group workouts
2. API endpoints
3. UI updates for group display

## Benefits of This Architecture

1. **Modular**: Each phase can be developed/tested independently
2. **Reuses Existing Code**: Phases 1-2 run unchanged
3. **Flexible**: Cohesion ratios are configurable
4. **Scalable**: Parallel processing where possible
5. **Backwards Compatible**: Individual workouts still work

## Open Questions for Implementation

1. Should group merge scoring (Phase 2.5) be optional or always run?
2. How do we handle client dropouts mid-generation?
3. Should we cache group pools for similar client combinations?
4. What's the maximum group size we should support?
5. How do we handle vastly different fitness levels in one group?