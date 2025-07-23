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

### Phase 2: Exercise Scoring (Enhanced with Required ScoreBreakdown)
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
│                                         │
│  Each ScoredExercise now includes:     │
│  - score: number                        │
│  - scoreBreakdown: {                   │
│      base: 5.0                         │
│      muscleTargetBonus: 0-3.0          │
│      muscleLessenPenalty: 0 to -3.0    │
│      intensityAdjustment: -2.0 to +2.0 │
│      includeExerciseBoost: 0-N         │
│      total: sum of above               │
│    }                                    │
└─────────────────────────────────────────┘

Output: ScoredExercise[] per client (with mandatory scoreBreakdown)
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
- GroupExercisePool per block (from Phase 2.5)
- Individual ScoredExercise[] per client
- GroupCohesionSettings
- ClientGroupSettings

Process:
┌─────────────────────────────────────────────────────────┐
│              Block Blueprint Creation                   │
│                                                         │
│  For Each Block:                                       │
│  1. Calculate slot allocation:                         │
│     - targetShared = floor(maxExercises * sharedRatio) │
│     - actualShared = min(targetShared, qualityShared)  │
│     - individualSlots = maxExercises - actualShared    │
│                                                         │
│  2. Prepare shared candidates:                         │
│     - Filter exercises with 2+ clients                 │
│     - Include top N by group score                     │
│     - Calculate possible sub-groupings                 │
│                                                         │
│  3. Prepare individual candidates:                     │
│     - For each client's remaining slots                │
│     - Include their top-scored exercises               │
│     - Exclude already assigned shared exercises        │
│                                                         │
│  4. Track cohesion satisfaction per client            │
└─────────────────────────────────────────────────────────┘

Output: GroupBlockBlueprint[] with structure and candidates
```

### Phase 5: LLM Workout Generation (Hybrid Approach)
```
Input: GroupBlockBlueprint[] from Phase 4

Process:
┌─────────────────────────────────────────────────────────┐
│                  LLM Call Strategy                      │
│                                                         │
│  Step 1: Shared Group Call                             │
│  ├─ Input: All block blueprints with:                  │
│  │   - Shared candidate exercises                      │
│  │   - Possible sub-groupings                          │
│  │   - Client cohesion targets                         │
│  ├─ Task: Select which exercises from candidates       │
│  │   - Assign clients to sub-groups                    │
│  │   - Balance across blocks                           │
│  └─ Output: SharedExerciseSelections                   │
│                                                         │
│  Step 2: Parallel Individual Calls (N clients)         │
│  ├─ Input for each client:                             │
│  │   - Their assigned shared exercises                 │
│  │   - Their individual slot candidates                │
│  │   - Number of slots to fill per block               │
│  ├─ Task: Select individual exercises                  │
│  └─ Output: CompleteWorkout per client                 │
│                                                         │
│  Step 3: Final Assembly                                │
│  └─ Merge shared + individual into GroupWorkout        │
└─────────────────────────────────────────────────────────┘

Output: GroupWorkout with per-client variations and sub-groups
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
│ Phase 4: Block Blueprint  │
│ ┌─────────────────────┐  │
│ │  Blueprint:          │  │
│ │  - Slot allocations  │  │
│ │  - Candidates lists  │  │
│ │  - Sub-group options │  │
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
  // Inherits scoreBreakdown from ScoredExercise (now required)
}
```

### 5. Phase B Types (Blueprint Structure)

```typescript
// Main output from Phase 4
interface GroupWorkoutBlueprint {
  blocks: GroupBlockBlueprint[];
  clientCohesionTracking: ClientCohesionTracking[];
  validationWarnings?: string[];
}

// Blueprint for each block
interface GroupBlockBlueprint {
  blockId: string;
  blockConfig: BlockConfig;
  
  // Slot allocation
  slots: {
    total: number;
    targetShared: number;
    actualSharedAvailable: number;
    individualPerClient: number;
  };
  
  // Candidates for LLM selection
  sharedCandidates: {
    exercises: GroupScoredExercise[];
    minClientsRequired: number;
    subGroupPossibilities: SubGroupPossibility[];
  };
  
  individualCandidates: {
    [clientId: string]: {
      exercises: ScoredExercise[]; // Each includes scoreBreakdown
      slotsToFill: number;
    };
  };
  
  // Cohesion state after this block
  cohesionSnapshot: ClientCohesionTracking[];
}

// Tracks client cohesion satisfaction
interface ClientCohesionTracking {
  clientId: string;
  cohesionRatio: number;
  totalExercisesInWorkout: number;
  targetSharedExercises: number;
  currentSharedSlots: number;
  remainingSharedNeeded: number;
  satisfactionStatus: 'on_track' | 'needs_more' | 'satisfied' | 'over';
}

// Sub-group possibilities for shared exercises
interface SubGroupPossibility {
  exerciseId: string;
  clientIds: string[];
  groupSize: number;
}
```

### 6. Phase B Decision Summary

**Cohesion Enforcement**
- ✅ Enforced across entire workout (not per block)
- ✅ Mandatory shared exercises (enforceShared: true) don't count against preference ratio

**Slot Allocation**
- ✅ Flexible based on quality: actualShared = min(target, available)
- ✅ Quality threshold: 2+ clients minimum
- ✅ Individual slots = total - actualShared

**Edge Cases**
- ✅ No shared candidates: Report 0, let LLM adapt
- ✅ Block conflicts: Block settings override client preferences
- ✅ Sub-groups: Track for equipment/timing coordination

### 7. Database Considerations
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

### Phase B: Block Planning ✅ COMPLETED
1. ✅ Enhance Phase 4 with group constraints
   - Created separate GroupWorkoutTemplateHandler (composition pattern)
   - Uses group scores for all selections (already includes overlap + quality)
   - Tracks sub-groups for equipment/timing coordination
   
2. ✅ Create shared/individual slot allocation
   - Flexible: actualShared = min(targetShared, qualityAvailable)
   - Quality threshold: 2+ clients minimum for shared
   - Remaining slots cascade to individual assignments
   - Sub-group tracking for trainer visibility
   
3. ✅ Add cohesion ratio enforcement
   - Enforces across entire workout (not per block)
   - Tracks progress: target, current, remaining needed
   - Block settings override when enforceShared = true
   - Passes targets and status to LLM for decisions

### ScoreBreakdown Refactor ✅ COMPLETED
1. ✅ Made scoreBreakdown required in ScoredExercise interface
   - Changed from optional (`scoreBreakdown?`) to required
   - TypeScript now enforces inclusion throughout pipeline
   - Prevents scoreBreakdown from being lost during transformations
   
2. ✅ Updated scoring functions
   - `scoreExercise()` always creates scoreBreakdown
   - Removed `includeBreakdown` parameter - always included
   - `scoreAndSortExercises()` simplified API
   
3. ✅ Benefits of the refactor
   - Frontend visualization always has accurate score components
   - No more guessing "Target +1.5" vs "Target +3.0"
   - Score transparency for debugging and user understanding
   - Type safety ensures data flows through entire pipeline

### Implementation Integration (IN PROGRESS)
1. ⏳ API Integration
   - `generateGroupWorkoutBlueprint()` function exists but needs export
   - Needs API endpoint to call from frontend
   - Requires ClientContext creation from session data
   
2. ⏳ Frontend Visualization
   - Display Phase A group scoring results
   - Show Phase B blueprint allocation
   - Visualize cohesion tracking
   - ✅ Score breakdown display now always accurate

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