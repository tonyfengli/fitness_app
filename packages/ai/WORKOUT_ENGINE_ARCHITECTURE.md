# Workout Creation Engine - Technical Architecture

## 🚀 Session Initialization Protocol

**IMPORTANT: If you're reading this at the start of a session, follow these steps:**

### 1. Read This Document Completely
Read through this entire architecture document to understand how all components work together before making any changes.

### 2. Run Tests
```bash
cd /Users/tonyli/Desktop/fitness_app/packages/ai
npm test
```
Ensure all tests pass. If any fail, investigate and fix before proceeding.

### 3. Check Terminal for Issues
Look for any red ✗ marks or error indicators in the terminal output. Common issues to check:
- TypeScript errors (red squiggly lines)
- ESLint warnings
- Failed test assertions
- Missing dependencies

### 4. Light Architecture Audit
Perform a quick consistency check between this document and the codebase. Focus on:
- **Major discrepancies only** - Don't report minor details
- **Structural changes** - New phases, removed components, renamed modules
- **Critical paths** - Changes to main entry points or core workflows

**Audit Checklist:**
- [ ] Verify the 5-phase pipeline structure still exists as documented
- [ ] Check if main entry point is still `api/filterExercisesFromInput.ts`
- [ ] Confirm core modules match documented paths (filtering/, scoring/, templates/)
- [ ] Verify any new major features are reflected in the architecture

**Note**: Only report findings if there are significant structural changes that would impact understanding of the system. Minor implementation details and small refactors don't need to be reported.

---

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
Filtered exercise array (`Exercise[]`) meeting all hard constraints

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
- **Utilities**: `core/scoring/scoreAnalysis.ts` - Score distribution analysis
- **First Pass**: `core/scoring/firstPassScoring.ts`
- **Second Pass**: `core/scoring/secondPassScoring.ts`

### Two-Pass Scoring Process
1. **Pass 1**: Calculate base scores for all exercises
2. **Pass 2**: Re-score included exercises with boost to guarantee (highest_score + 1.0)

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

### ScoredExercise Type
```typescript
interface ScoredExercise extends Exercise {
  score: number;
  scoreBreakdown?: {
    base: number;
    includeExerciseBoost: number;
    muscleTargetBonus: number;
    muscleLessenPenalty: number;
    intensityAdjustment: number;
    total: number;
  };
}
```

### Output
- Scored exercise array (`ScoredExercise[]`) sorted by score (highest first)
- Each exercise includes:
  - `score`: number - The calculated preference score
  - `scoreBreakdown`: Optional breakdown of scoring components
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
- Scored exercises from Phase 2 (`ScoredExercise[]`)
- Workout template (optional) - identified by `isFullBody` flag
  - `isFullBody: true` → uses 'full_body' template ID
  - `isFullBody: false` → uses 'workout' template ID
  - No template → returns null (no organization)

### Core Components
- **Handler**: `core/templates/WorkoutTemplateHandler.ts`
- **Types**: 
  - `core/templates/types/blockConfig.ts` - Legacy block configuration
  - `core/templates/types/dynamicBlockTypes.ts` - Dynamic block definitions
- **Templates**: `core/templates/config/defaultTemplates.ts` - Predefined workout templates
- **Strategies**: `core/templates/strategies/SelectionStrategy.ts`
- **Utilities**: 
  - `core/templates/strategies/ConstraintTracker.ts` - Tracks constraint satisfaction
  - `core/templates/adapters/BlockAdapter.ts` - Format conversion between internal dynamic and external fixed structure

### Block Structure

#### 4.1 Block Structure
The system uses a fixed 4-block structure with dynamic configuration support:

**Current Block Definitions**
- **Block A**: Primary Strength (5 exercises max)
- **Block B**: Secondary Strength (8 exercises max) 
- **Block C**: Accessory (8 exercises max)
- **Block D**: Core & Capacity (6 exercises max)

**Internal Dynamic System**
The WorkoutTemplateHandler internally uses a dynamic block system for flexibility:
- Blocks are configured with:
  - `id`: Unique identifier
  - `name`: Display name
  - `functionTags`: Exercise categories to include
  - `maxExercises`: Maximum exercises in block
  - `constraints`: Movement pattern requirements (optional)
  - `selectionStrategy`: 'deterministic' or 'randomized'
  - `penaltyForReuse`: Score reduction when reusing exercises
- The dynamic system is converted back to the fixed blockA/B/C/D format for consistency

#### 4.2 Exercise Pre-filtering
Before selection begins, exercises are filtered by each block's function tags:
- Each block only considers exercises matching its `functionTags` array
- For standard template:
  - Block A: Only exercises tagged 'primary_strength'
  - Block B: Only exercises tagged 'secondary_strength'
  - Block C: Only exercises tagged 'accessory'
  - Block D: Only exercises tagged 'core' or 'capacity'

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

#### 4.7 Template Configuration
The system supports multiple workout templates:

**Available Templates**:
1. **Standard Workout** (`id: 'workout'`)
   - 4 blocks: Primary, Secondary, Accessory, Core/Capacity
   - Traditional structure with specific movement patterns per block

2. **Full Body** (`id: 'full_body'`)
   - Same as standard but with muscle group constraints
   - Minimum 2 upper/lower body exercises per block

3. **Circuit Training** (`id: 'circuit_training'`)
   - 6 rounds, 1 exercise per round
   - Placeholder for future implementation

**Template Selection**:
- Based on `isFullBody` flag in input
- Templates defined in `core/templates/config/defaultTemplates.ts`
- Easily extensible for new workout styles

#### 4.8 Block Format Conversion
The system uses `BlockAdapter` to convert between formats:
- **Module**: `core/templates/adapters/BlockAdapter.ts`
- `toLegacyFormat()`: Converts internal dynamic blocks to fixed blockA/B/C/D structure
- `toDynamicFormat()`: Converts blockA/B/C/D to dynamic format when needed
- This allows the internal system to be flexible while maintaining a consistent external interface

### Output
The system outputs exercises in the fixed blockA/B/C/D format:
- **Block A**: Up to 5 primary strength exercises
- **Block B**: Up to 8 secondary strength exercises
- **Block C**: Up to 8 accessory exercises
- **Block D**: Up to 6 core/capacity exercises
- Exercises appear in selection order (constraint-satisfying first, then score-based)
- When penalties applied, includes both original and penalized scores
- The internal dynamic system allows for future flexibility without changing the API

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
- **Prompts**: `workout-interpretation/prompts/promptBuilder.ts`
- **Prompt Sections**: `workout-interpretation/prompts/sections/` - Modular prompt components

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

---

## API Interface

### Primary Entry Point
`api/filterExercisesFromInput.ts`

### Request Interface
```typescript
interface FilterExercisesOptions {
  userInput?: string;
  clientContext?: ClientContext;
  workoutTemplate?: FilterWorkoutTemplate; // Extends WorkoutTemplate with isFullBody
  exercises?: any[]; // Optional: Pass exercises directly to avoid DB queries
  intensity?: "low" | "moderate" | "high"; // For scoring, separate from client context
}
```

Note: `FilterWorkoutTemplate` extends the standard `WorkoutTemplate` with an optional `isFullBody: boolean` property used for template selection.

### Response Structure
```typescript
{
  userInput: string;
  programmedRoutine: string;
  exercises: []; // Always empty in response
  clientContext: ClientContext;
  filteredExercises: ScoredExercise[]; // Includes scores and presentation flags
  workoutTemplate: WorkoutTemplate;
}
```

### Request Flow
1. Receives client context and preferences
2. Orchestrates 5-phase pipeline
3. Returns structured workout data with scored exercises

### Error Handling
- Business validation errors
- Empty result handling
- LLM failure recovery

---

## Data Flow

### Sequential Pipeline
```
Client Request (FilterExercisesOptions)
    ↓
Phase 1: Filtering (Hard Constraints)
    → Output: Exercise[]
    ↓
Phase 2: Scoring (Preferences)
    → Output: ScoredExercise[]
    ↓
Phase 3: Set Count Determination
    → Output: {minSets, maxSets, reasoning}
    ↓
Phase 4: Template Organization
    → Output: OrganizedExercises (blocks A/B/C/D)
    ↓
Phase 5: LLM Generation
    → Output: Complete workout program
    ↓
Structured Workout Response
```

---

## Debugging & Development Tools

### Block System Debugger
A comprehensive debugging system tracks exercise transformations through all phases.

#### Components
- **BlockDebugger**: Core utility at `utils/blockDebugger.ts`
- **Debug API**: REST endpoint at `/api/debug/blocks`
- **Client Helper**: Browser utility at `utils/blockDebugClient.ts`

#### How to Use

1. **Enable debugging** (enabled by default in development)
2. **Run a workout filter** through the UI
3. **In browser console**, access debug data:
   ```javascript
   // View formatted logs showing exercise flow
   await blockDebug.logToConsole()
   
   // Download detailed report
   await blockDebug.downloadReport()
   
   // Clear logs before new test
   await blockDebug.clearLogs()
   ```

#### What Gets Logged

##### Phase 1 & 2 (Filtering/Scoring)
- Exercise counts by function tag
- Filtered results

##### Phase 4 (Template Organization)
- **WorkoutTemplateHandler**: 
  - Input exercises and configuration
  - Block selections with penalties
  - Constraint satisfaction details
  - Final exercise assignments
- **exerciseFlags**: 
  - UI flag assignments (isSelectedBlockA, etc.)
  - Block membership tracking
  - Dynamic selectedBlocks array for flexible templates

##### Phase 5 (LLM Interpretation)
- Input exercise blocks
- LLM request/response details
- Timing breakdowns

#### Debug Data Structure
Each log entry contains:
- `timestamp`: When the transformation occurred
- `stage`: Which component/phase logged it
- `data`: The actual data being transformed
- Input/output states for transformations

This debugging system is essential for:
- Understanding block assignment logic
- Tracking down why specific exercises are selected/rejected
- Verifying template constraints are met
- Performance profiling of each phase

### 3. Filter State Persistence & Enhanced Debugging

#### Overview
The system provides multiple levels of debugging data persistence for comprehensive analysis and support.

#### Basic Filter State Persistence
1. Every time the `exercise.filter` endpoint is called, the current filter state and results are saved to:
   - **File**: `current-filter-state.json`
   - **Location**: `/Users/tonyli/Desktop/fitness_app/` (project root directory, NOT in packages/ai)
2. This file contains:
   - Current filter selections (intensity, muscle targets, capacity levels, etc.)
   - Filtered exercise results organized by block
   - Top exercises in each block with their scores
   - Timestamp of when the filter was applied

#### Enhanced Debug Mode
When `debug: true` is passed to the filter endpoint, additional detailed tracking is enabled:

1. **Exclusion Tracking** (`ExclusionTracker`)
   - Tracks WHY each exercise was excluded from results
   - Records all reasons for exclusion (strength level, skill level, joint restrictions, etc.)
   - Helps identify overly restrictive filters

2. **Constraint Analysis** (`ConstraintAnalysisTracker`)
   - Tracks constraint satisfaction progress for each block
   - Records which constraints are required, satisfied, and unsatisfied
   - Logs every exercise attempt with constraint matching details
   - Shows why exercises were selected or rejected for constraint satisfaction

3. **Score Breakdowns** (Removed)
   - Enhanced scoring system has been removed
   - Score breakdowns are no longer tracked in debug mode
   - Consider adding this functionality to regular scoring if needed

4. **Real-time Debug Logging** (`DebugLogger`)
   - Step-by-step logging of the entire pipeline
   - Performance metrics for each phase
   - Exercise counts affected at each step
   - Organized by phase: filtering, scoring, organizing, constraint_check, selection

5. **Workout Generation History**
   - Persists to `/Users/tonyli/Desktop/fitness_app/workout-generation-history.json`
   - Tracks all generated workouts with session IDs
   - Includes filter parameters, results, and timing
   - Space for user feedback (rating, swaps, completion rate)

#### File Locations (All in project root, NOT packages/ai)
- **Basic State**: `/Users/tonyli/Desktop/fitness_app/current-filter-state.json`
- **Enhanced Debug**: `/Users/tonyli/Desktop/fitness_app/enhanced-debug-state.json`
- **Workout History**: `/Users/tonyli/Desktop/fitness_app/workout-generation-history.json`

#### Usage with Claude Code
When working with Claude Code, you can ask:
- "What filters do I have selected?"
- "Why was exercise X excluded?"
- "Show me the constraint analysis for block B"
- "What's the score for exercise Y?" (Note: detailed breakdowns no longer available)
- "Read the enhanced debug data"

#### Implementation
- **Basic Module**: `utils/debugToFile.ts`
- **Enhanced Module**: `utils/enhancedDebug.ts`
- **Integration**: `api/src/router/exercise.ts` (filter endpoint)
- **Enhanced Integration**: `api/enhancedFilterExercisesFromInput.ts`

This comprehensive debugging system enables:
- Real-time debugging without console access
- Historical analysis of workout generation patterns
- Detailed troubleshooting of filter/scoring issues
- Performance profiling of each pipeline phase

### 4. Debug-to-Test Workflow

#### Overview
Convert interesting debug states into integration tests on-demand. This system helps capture edge cases and bugs as they occur, then convert them into regression tests when needed.

#### How It Works

##### Step 1: Capture During Development
When you encounter an issue or interesting scenario:

**From Browser Console:**
```javascript
// After clicking filter and seeing the issue
saveScenario('joint_bug', 'Squats showing despite knee restriction')
// ✅ Scenario saved!
```

**From Terminal:**
```bash
# Save current debug state with a name
npm run debug-to-test save muscle_conflict "Chest target conflicts with tricep lessen"
```

##### Step 2: Review Saved Scenarios
```bash
# List all saved scenarios
npm run debug-to-test list

# Output:
# 📁 Saved scenarios (3):
# 1. joint_bug - Squats showing despite knee restriction
#    ID: scenario_1234567890
#    Saved: 1/11/2025, 10:30 AM
# 
# 2. muscle_conflict - Chest target conflicts with tricep lessen
#    ID: scenario_1234567891
#    Saved: 1/11/2025, 11:45 AM
```

##### Step 3: Generate Test When Ready
```bash
# Generate test code from a saved scenario
npm run debug-to-test generate joint_bug

# Outputs test code to copy into your test file:
# it('Squats showing despite knee restriction', async () => {
#   const debugData = { /* captured state */ };
#   // ... generated test code
# });
```

##### Step 4: Customize and Add to Test Suite
1. Copy generated test code
2. Add to appropriate test file (e.g., `restrictive-filters.test.ts`)
3. Add specific assertions for the issue
4. Run tests to ensure they catch the bug

#### What Gets Saved
- Complete filter state from `current-filter-state.json`
- Enhanced debug data (if available) with exclusion reasons and score breakdowns
- Your description and optional notes
- Timestamp and unique ID

#### File Locations
- **Saved scenarios**: `/Users/tonyli/Desktop/fitness_app/saved-test-scenarios/`
- **Test helper**: `utils/debugToTest.ts`
- **Browser helper**: `apps/nextjs/src/utils/testHelper.ts`

#### Benefits
- **On-demand**: Nothing automatic - you control when to save and convert
- **Named scenarios**: Easy to find and remember edge cases
- **Test generation**: Creates test skeleton with captured data
- **Edge case library**: Build up a collection of real-world scenarios
- **Regression prevention**: Turn bugs into permanent test guards

This workflow bridges the gap between debugging and testing, making it easy to convert real issues into integration tests without manual data copying.

---

## Testing Architecture

### Overview
The workout engine has comprehensive test coverage across all 5 phases of the pipeline, ensuring reliability and correctness of the workout generation process.

### Test Organization
Tests are organized by pipeline phase and testing scope:

#### Integration Tests (`test/integration/workout-generation/`)
- **restrictive-filters.test.ts** - Phase 1: Exercise filtering edge cases and safety
- **muscle-targeting.test.ts** - Phase 2: Exercise scoring and targeting logic  
- **set-count-determination.test.ts** - Phase 3: Set count matrix coverage
- **template-organization.test.ts** - Phase 4: Block organization and constraints
- **llm-generation.test.ts** - Phase 5: LLM integration and response handling
- **error-scenarios.test.ts** - Error handling across all phases
- **presentation-flags.test.ts** - UI flag generation
- **basic-scenarios.test.ts** - Happy path scenarios
- **filter-edge-cases.test.ts** - Cascading logic and validation

#### Unit Tests (`test/unit/`)
- **setCountLogic.test.ts** - Set count determination logic

### Key Test Scenarios

#### Safety-Critical Tests
- Joint restriction overrides (must exclude even if included)
- Score clamping (no negative scores)
- Empty result handling

#### Edge Case Coverage
- Mismatched strength/skill levels
- Missing or malformed data
- Extreme scoring scenarios
- Insufficient exercises for constraints

#### Integration Testing
- Full pipeline execution
- Phase interaction verification
- Client context preservation across phases

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test restrictive-filters.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Helpers
- **test-helpers.ts** - Common test utilities and contexts
- **exerciseDataHelper.ts** - Exercise data generation
- **mockLLM.ts** - LLM mocking for Phase 5 tests