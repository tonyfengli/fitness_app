# Standard Template Flow - Visual Architecture

## Complete Flow: Session Lobby → Generated Workout

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SESSION LOBBY                                 │
│                                                                     │
│  1. Create/Join Session                                            │
│  2. Check in Clients                                               │
│  3. Select Template: "Standard" → Choose Workout Type              │
│     - Full Body With Finisher                                      │
│     - Full Body Without Finisher                                   │
│     - Targeted With Finisher                                       │
│     - Targeted Without Finisher                                    │
│  4. Set Client Preferences:                                        │
│     - Intensity (low/moderate/high)                                │
│     - Target Muscles (e.g., Biceps, Glutes)                       │
│     - Avoid Muscles (e.g., Calves)                                │
│     - Favorite Exercises (from user profile)                       │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1 & 2: FILTER + SCORE                      │
│                    (Same as original architecture)                   │
│                                                                     │
│  For each client independently:                                     │
│  ├─ Filter by strength/skill capacity                              │
│  ├─ Apply joint restrictions                                        │
│  ├─ Score based on:                                                │
│  │   - Base: 5.0                                                   │
│  │   - Muscle target: +3.0 (primary), +1.5 (secondary)            │
│  │   - Muscle lessen: -3.0 (primary), -1.5 (secondary)            │
│  │   - Favorites: +2.0                                             │
│  │   - Intensity adjustments                                       │
│  └─ Output: Map<clientId, ScoredExercise[]>                       │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: PRE-ASSIGNMENT                          │
│                         (NEW FEATURE)                               │
│                                                                     │
│  Based on Workout Type Strategy:                                   │
│                                                                     │
│  Full Body (With/Without Finisher):                                │
│  ├─ Select 2 favorites total                                       │
│  ├─ MUST be 1 upper body + 1 lower body                           │
│  ├─ Body part classification:                                      │
│  │   - Primary muscle takes precedence                             │
│  │   - Core muscle/pattern → lower body                           │
│  │   - Upper: chest, back, shoulders, arms                        │
│  │   - Lower: legs, glutes, core                                  │
│  └─ Tie-breaking: Random selection from equal scores              │
│                                                                     │
│  Targeted Workouts:                                                │
│  ├─ Up to 4 pre-assignments                                       │
│  ├─ Focus on muscle targets                                       │
│  └─ Include capacity exercises                                    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 4: TEMPLATE PROCESSING                           │
│                   (Standard Template)                               │
│                                                                     │
│  Creates StandardGroupWorkoutBlueprint:                             │
│  ├─ Client Exercise Pools:                                         │
│  │   - Pre-assigned exercises (from Phase 3)                      │
│  │   - Available candidates (all scored exercises)                 │
│  │   - Tracks exercises needed (15 total - pre-assigned)          │
│  └─ Shared Exercise Pool (exercises available to 2+ clients)      │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 5: BUCKETING                               │
│                      (NEW FEATURE)                                  │
│                                                                     │
│  Systematic constraint fulfillment (13 exercises):                 │
│                                                                     │
│  1. Movement Patterns (6-7 exercises):                             │
│     ├─ Fill remaining patterns not in pre-assigned                │
│     ├─ Exclude favorites to avoid duplication                     │
│     └─ Tie-breaking for equal scores                              │
│                                                                     │
│  2. Muscle Target (2-4 exercises):                                 │
│     ├─ PRIMARY muscle only                                         │
│     ├─ Case-insensitive matching                                  │
│     ├─ Balanced distribution:                                      │
│     │   - 1 muscle: all 4 exercises                               │
│     │   - 2 muscles: 2 each                                       │
│     └─ Account for pre-assigned muscle targets                    │
│                                                                     │
│  3. Capacity (0-1 exercise):                                       │
│     ├─ With Finisher: 1 capacity exercise                         │
│     └─ Without Finisher: 0 capacity exercises                     │
│                                                                     │
│  4. Flex Slots (remaining to reach 13):                            │
│     ├─ Prioritize unused favorites                                │
│     └─ Fill with highest scoring exercises                        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 PHASE 6: LLM GENERATION                             │
│                    (Two-Phase Approach)                             │
│                                                                     │
│  Different from BMF single-phase generation:                        │
│                                                                     │
│  Round 1: Individual Workouts                                      │
│  ├─ Generate workout for each client                              │
│  ├─ Using their 15 selected exercises                             │
│  └─ Create sets, reps, rest periods                               │
│                                                                     │
│  Round 2: Group Coordination                                        │
│  ├─ Identify shared exercises across clients                       │
│  ├─ Synchronize timing and equipment                              │
│  └─ Create final group workout structure                          │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FINAL OUTPUT                                   │
│                                                                     │
│  Group Workout with:                                               │
│  - 15 exercises per client (2 pre + 13 bucketed)                  │
│  - All constraints satisfied                                       │
│  - Body part balance maintained                                   │
│  - Shared exercises coordinated                                    │
│  - Complete workout structure (sets, reps, rest)                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Constraint Fulfillment Example

### Full Body With Finisher (15 total exercises)

```
Pre-assigned (2):
├─ 1 Upper Body Favorite (e.g., "3-Point Dumbbell Row")
└─ 1 Lower Body Favorite (e.g., "Kettlebell Swings")

Bucketed (13):
├─ Movement Patterns (6):
│   ├─ horizontal_push: 1
│   ├─ vertical_push: 1
│   ├─ vertical_pull: 1
│   ├─ squat: 1 (if not pre-assigned)
│   ├─ hinge: 1 (if not pre-assigned)
│   └─ lunge: 1
├─ Muscle Target (4):
│   └─ Based on client preferences
├─ Capacity (1):
│   └─ Exercise with 'capacity' tag
└─ Flex (2):
    └─ Remaining favorites or highest scored
```

### Full Body Without Finisher (15 total exercises)

```
Pre-assigned (2):
├─ 1 Upper Body Favorite
└─ 1 Lower Body Favorite

Bucketed (13):
├─ Movement Patterns (7):
│   ├─ Same as above PLUS
│   └─ core: 2 (instead of 1)
├─ Muscle Target (4):
│   └─ Same as With Finisher
├─ Capacity (0):
│   └─ None required
└─ Flex (2):
    └─ Same as With Finisher
```

## Key Differences from BMF Template

| Aspect | BMF Template | Standard Template |
|--------|--------------|-------------------|
| Organization | Block-based (rounds) | Client-pooled |
| Pre-assignment | None | 2-4 exercises |
| Selection | Direct from blocks | Constraint bucketing |
| LLM Approach | Single phase | Two phases |
| Constraints | Function tags per block | Movement patterns + functional |
| Body Balance | Not enforced | Required for favorites |

## Frontend Display Updates

1. **Constraint Analysis Section**:
   - Shows pre-assigned exercises separately
   - Real-time constraint fulfillment status
   - Distinguishes violations vs. met constraints

2. **Exercise Display**:
   - Pre-assigned marked with source
   - Bucketed exercises show constraint type
   - Tie-breaking indicators when applicable

3. **Smart Bucketed Selection**:
   - Always shows 13 exercises
   - Labels: movement pattern, muscle target, capacity, flex
   - Shared exercises marked appropriately