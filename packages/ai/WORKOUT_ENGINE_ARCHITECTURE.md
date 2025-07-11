# Workout Creation Engine - Technical Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Phase 1: Exercise Filtering](#phase-1-exercise-filtering)
3. [Phase 2: Exercise Scoring](#phase-2-exercise-scoring)
4. [Phase 3: Set Count Determination](#phase-3-set-count-determination)
5. [Phase 4: Template Organization & Block Selection](#phase-4-template-organization--block-selection)
6. [Phase 5: LLM Workout Generation](#phase-5-llm-workout-generation)
7. [API Interface](#api-interface)
8. [Data Flow](#data-flow)

---

## System Overview

### Purpose
The workout creation engine transforms client requirements into personalized, structured workout programs through a 5-phase pipeline.

### Architecture Pattern
Sequential pipeline with distinct phases, each building upon the previous phase's output.

### Key Modules
- `api/filterExercisesFromInput.ts` - Main entry point
- `core/filtering/` - Exercise filtering logic
- `core/scoring/` - Exercise scoring system
- `core/templates/` - Template organization and block selection
- `workout-interpretation/` - LLM integration

---

## Phase 1: Exercise Filtering

### Overview
Applies hard constraints to the exercise database, reducing the pool to only valid exercises for the client. This phase uses binary filtering (include/exclude) rather than graduated preferences.

### Input
- Client context:
  - Strength capacity level
  - Skill capacity level
  - Exercise requests (include/avoid lists)
  - Joint restrictions (avoid_joints)
  - Business ID
- Exercise database

### Core Components
- **Module**: `core/filtering/filterFunctions.ts`
- **Entry**: `core/filtering/filterExercises.ts`

### Filter Application Order
1. Include exercises (separated first)
2. Strength & Skill filters (on remaining exercises)
3. Joint avoidance (on all exercises)
4. Exclude filter (final, removes everything)

### Filtering Rules

#### 1.1 Strength Level Filtering
- Cascading inclusion (higher includes lower)
- Levels: `very_low` → `low` → `moderate` → `high`

#### 1.2 Skill Level Filtering  
- Cascading inclusion (higher includes lower)
- Levels: `very_low` → `low` → `moderate` → `high`

#### 1.3 Include Exercises Override
- Bypasses strength/skill restrictions
- Priority: Highest

#### 1.4 Avoid Exercises Override
- Removes exercises regardless of other logic
- Priority: Final (absolute)

#### 1.5 Joint Avoidance
- Filters exercises loading specified joints
- Applies to all exercises INCLUDING explicitly included ones
- Safety override - even requested exercises are filtered if they load avoided joints

#### 1.6 Business Validation
- UUID format validation
- Fallback: All exercises if invalid/missing

### Empty Results Handling
- If filters are too restrictive, system may return empty or limited results
- Process continues to next phases with available exercises
- LLM will work with whatever exercises pass through

### Output
Filtered exercise array meeting all hard constraints

---

## Phase 2: Exercise Scoring

### Overview
Assigns preference scores to filtered exercises based on client goals and workout parameters. Uses a two-pass scoring system to ensure included exercises always rank highest.

### Input
- Filtered exercises from Phase 1
- Scoring criteria from client context

### Core Components
- **Module**: `core/scoring/scoreExercises.ts`
- **Config**: `core/scoring/scoringConfig.ts`

### Two-Pass Scoring Process
1. **Pass 1**: Calculate base scores for all exercises
2. **Pass 2**: Boost included exercises to (highest_score + 1.0)

### Scoring System

#### 2.1 Base Score
- All exercises start at 5.0

#### 2.2 Muscle Target Bonuses (No Stacking)
- Primary muscle match: +3.0
- Secondary muscle match: +1.5
- Only highest bonus applies (no stacking for multiple muscle matches)

#### 2.3 Muscle Lessen Penalties (No Stacking)
- Primary muscle match: -3.0
- Secondary muscle match: -1.5
- Only highest penalty applies (no stacking for multiple muscle matches)

#### 2.4 Intensity Adjustments
- Maps workout intensity (low/moderate/high) to exercise fatigue profiles
- Fatigue profile types: `low_local`, `moderate_local`, `high_local`, `moderate_systemic`, `high_systemic`, `metabolic`
- No cascading - these represent different types of fatigue, not levels
- Adjustment values:
  - **Low intensity workout**: Prefers low fatigue (+1.5 low_local, +0.75 moderate_local, -1.5 for high/metabolic)
  - **Moderate intensity workout**: Neutral (0 for all fatigue types)
  - **High intensity workout**: Prefers high fatigue (+1.5 high/systemic/metabolic, -1.5 low_local)

#### 2.5 Include Exercise Priority Boost
- Included exercises guaranteed to score highest
- Boosted to reach (max_score + 1.0) during Pass 2
- Boost calculated as: (max_score + 1.0) - current_score
- Ensures they appear at top of sorted list

### Score Clamping
- Final scores clamped to minimum of 0
- No negative scores allowed

### Output
- Scored exercise array sorted by score (highest first)
- This order directly influences template selection in Phase 4

---

## Phase 3: Set Count Determination

### Overview
Calculates total workout volume based on client capacity and intensity level. Called within interpretExercisesNode before prompt building to provide set count constraints to the LLM.

### Input
- Client strength level: `'very_low' | 'low' | 'moderate' | 'high'` (optional)
- Workout intensity: `'low' | 'moderate' | 'high'` (optional)

### Core Components
- **Module**: `workout-interpretation/setCountLogic.ts`
- **Function**: `determineTotalSetCount()`

### Set Count Matrix

#### 3.1 Complete Strength × Intensity Matrix
| Strength Level | Low Intensity | Moderate Intensity | High Intensity |
|----------------|---------------|--------------------|----------------|
| very_low       | [14, 16]      | [16, 18]           | [18, 20]       |
| low            | [16, 18]      | [18, 20]           | [20, 22]       |
| moderate       | [17, 19]      | [19, 22]           | [22, 25]       |
| high           | [18, 20]      | [22, 25]           | [25, 27]       |

#### 3.2 Default Behavior
- When strength level not provided: defaults to `'moderate'`
- When intensity not provided: defaults to `'moderate'`
- Default range: `[19, 22]` sets


### Output
```typescript
{
  minSets: number,      // Lower bound of set range
  maxSets: number,      // Upper bound of set range
  reasoning: string     // Generated explanation for the range
}
```

### Integration Context
- Called after exercise scoring and before LLM prompt construction
- Set count range passed to WorkoutPromptBuilder for constraint application
- LLM uses this range to distribute sets across selected exercises

---

## Phase 4: Template Organization & Block Selection

### Overview
Organizes scored exercises into workout blocks with movement pattern constraints and selection strategies.

### Input
- Scored exercises from Phase 2
- Workout template (optional) - identified by `isFullBody` flag
  - `isFullBody: true` → uses 'full_body' template ID
  - `isFullBody: false` → uses 'workout' template ID
  - No template → returns null (no organization)

### Core Components
- **Handler**: `core/templates/WorkoutTemplateHandler.ts`
- **Config**: `core/templates/types/blockConfig.ts`
- **Strategies**: `core/templates/strategies/SelectionStrategy.ts`

### Block Structure

#### 4.1 Block Definitions
- **Block A**: Primary Strength (5 exercises max)
- **Block B**: Secondary Strength (8 exercises max)
- **Block C**: Accessory (8 exercises max)
- **Block D**: Core & Capacity (6 exercises max)

#### 4.2 Exercise Pre-filtering
Before selection begins, exercises are filtered by each block's function tag:
- Block A: Only exercises tagged 'primary_strength'
- Block B: Only exercises tagged 'secondary_strength'
- Block C: Only exercises tagged 'accessory'
- Block D: Only exercises tagged 'core_capacity'

#### 4.3 Two-Phase Selection Process
Each block uses a two-phase approach within its selection strategy:

##### Phase 1: Constraint Satisfaction
- Exercises selected if they "help meet" unsatisfied constraints
- Not just pattern matching - must fulfill unmet requirements
- Selection continues until:
  - All constraints satisfied, OR
  - Maximum exercises reached, OR
  - No remaining exercises can help meet constraints
- Tie-breaking:
  - **Deterministic (Block A)**: First highest-scoring exercise that meets constraints
  - **Randomized (Blocks B/C/D)**: Random selection from tied highest-scoring constraint candidates
- Movement pattern requirements:
  - Block A: squat/hinge AND push AND pull
  - Block B: squat/hinge AND push AND pull AND lunge
  - Block C: squat/hinge AND push AND pull
  - Block D: min 1 core AND min 2 capacity (function tags)

Movement pattern mappings:
- **squat/hinge**: includes 'squat' OR 'hinge' patterns
- **push**: includes 'horizontal_push' OR 'vertical_push' patterns
- **pull**: includes 'horizontal_pull' OR 'vertical_pull' patterns
- **lunge**: only 'lunge' pattern

##### Phase 2: Score-Based Filling
- After constraints satisfied, fills remaining slots
- Selection based on penalized scores
- Selection method:
  - **Deterministic (Block A)**: Takes exercises in score order (highest first)
  - **Randomized (Blocks B/C/D)**: Weighted random selection (using linear score weighting)
- Respects maximum exercise limits

#### 4.4 Cross-Block Penalty Mechanics
- Applied before selection as score reduction
- Original scores preserved in `originalScore` field
- Penalty values:
  - Block A → Block B: -2.0 penalty
  - Block B → Block C: -2.0 penalty
  - Block D: No penalties (allows reuse)
- Penalties prevent overuse of high-scoring exercises across blocks
- Applied to penalized score, not original score

#### 4.5 Selection Strategies
- **Block A**: Deterministic (highest scores)
- **Blocks B/C/D**: Randomized (weighted selection using linear score weighting)

#### 4.6 Full-Body Constraints
When enabled, applied to blocks A, B, and C only (not Block D):
- Minimum 2 lower body exercises per block
- Minimum 2 upper body exercises per block
- Checked during constraint satisfaction phase
- Block D (Core & Capacity) excluded from muscle constraints

### Output
- Organized exercise blocks with selections per block:
  - Block A: Up to 5 exercises
  - Block B: Up to 8 exercises
  - Block C: Up to 8 exercises
  - Block D: Up to 6 exercises
- Exercises appear in selection order (constraint-satisfying first, then score-based)
- When penalties applied, includes both original and penalized scores

**[Placeholder: Block Selection Workflow Diagram - showing constraint satisfaction and selection strategies]**

---

## Phase 5: LLM Workout Generation

### Overview
Transforms organized exercise blocks into a structured workout program with sets, reps, and progression logic.

### Input
- Organized blocks from Phase 4
- Client context
- Set count range from Phase 3

### Core Components
- **Node**: `workout-interpretation/interpretExercisesNode.ts`
- **Graph**: `workout-interpretation/workoutInterpretationGraph.ts`
- **Prompts**: `workout-interpretation/prompts/workoutPromptBuilder.ts`

### Prompt Building

#### 5.1 Dynamic Configuration
- Strict exercise limits toggle
- Example inclusion toggle
- Emphasis on requested exercises

#### 5.2 Context Integration
- Client limitations and preferences
- Set count constraints
- Exercise rationale

#### 5.3 Output Structure
- Structured JSON with workout blocks
- Sets and reps for each exercise
- Progression recommendations

### Output
Complete workout program ready for client use

**[Placeholder: LangGraph Workflow Diagram - showing nodes, states, and prompt assembly]**

---

## API Interface

### Primary Entry Point
`api/filterExercisesFromInput.ts`

### Request Flow
1. Receives client context and preferences
2. Orchestrates 5-phase pipeline
3. Returns structured workout data

### Error Handling
- Business validation errors
- Empty result handling
- LLM failure recovery

---

## Data Flow

### Sequential Pipeline
```
Client Request
    ↓
Phase 1: Filtering (Hard Constraints)
    ↓
Phase 2: Scoring (Preferences)
    ↓
Phase 3: Set Count Determination
    ↓
Phase 4: Template Organization
    ↓
Phase 5: LLM Generation
    ↓
Structured Workout Response
```

**[Placeholder: End-to-End Data Flow Diagram - showing data transformation at each phase]**