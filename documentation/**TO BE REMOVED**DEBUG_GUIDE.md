# Comprehensive Debug Guide

This guide covers all debugging tools in the fitness app, including both frontend (authentication, UI) and backend (workout engine, AI) systems.

## Table of Contents
1. [Bug Reporting Protocol](#bug-reporting-protocol)
2. [Frontend Debug Tools](#frontend-debug-tools)
3. [Workout Engine Debug Tools](#workout-engine-debug-tools)
4. [Architecture Overview](#architecture-overview)

---
## To Enable Debugging
  1. Frontend Debug Client:
    - Disabled by default
    - Enable with: window.frontendDebug.setEnabled(true)
    - No more automatic logging slowing down auth flows
  2. Block Debug System:
    - Disabled by default
    - Enable with: await blockDebug.enable()



## Bug Reporting Protocol

When you encounter a bug, use this exact prompt:

---
First, read the DEBUG_GUIDE.md for full context on available debug tools.

I'm following the debug protocol from DEBUG_GUIDE.md. Here's my bug report:

1. **What I'm trying to do**: [action]
2. **What happens**: [actual result]  
3. **What should happen**: [expected result]

### Instructions for Claude:
1. First, provide specific debug commands based on the issue (e.g., `await debugAuth()` or `await blockDebug.logToConsole()`)
2. Only request console.logs if debug tools don't capture the needed information
3. If existing debug tools lack necessary detail, create minimal additions to capture just what's needed
4. Avoid over-engineering - add only essential debug capabilities
5. Keep responses focused on solving the specific bug
---

---

## Frontend Debug Tools

### Quick Start
The frontend debug tools are automatically available in development mode but **disabled by default for performance**. 

To enable debugging:
```javascript
window.frontendDebug.setEnabled(true)
```

### Available Commands

#### 1. `debugAuth()`
Comprehensive auth debugging report that checks:
- Current authentication state
- Session response structure
- API endpoint comparison
- Automatic recommendations

```javascript
// In browser console:
await debugAuth()
```

#### 2. `enableAutoCapture()`
Automatically captures navigation events and auth state changes:

```javascript
// In browser console:
enableAutoCapture()
```

#### 3. `FrontendDebugClient`
Direct access to the debug client for custom logging:

```javascript
// In browser console:
FrontendDebugClient.log('MyComponent', 'Custom event', { data: 'value' })
FrontendDebugClient.getLogs() // Get all logs
FrontendDebugClient.clear() // Clear logs
```

### Common Frontend Debugging Scenarios

#### Auth Not Working
1. Run `await debugAuth()` in console
2. Check the "Session Responses" section
3. Look for structure mismatches between client/server
4. Follow the recommendation provided

#### Navigation Issues
1. Run `enableAutoCapture()` before navigating
2. Navigate through your app
3. Check console for auth state after each navigation

#### Component State Issues
1. Add debug logging to your component:
```typescript
import { FrontendDebugClient } from '~/utils/frontendDebugClient';

// In your component
FrontendDebugClient.log('ComponentName', 'Event description', { 
  state: currentState,
  props: relevantProps 
});
```

2. Use `FrontendDebugClient.getLogs()` to review

### Frontend Best Practices

1. **Clear logs between tests**: `FrontendDebugClient.clear()`
2. **Use descriptive event names**: Makes filtering easier
3. **Include relevant data**: But avoid sensitive information
4. **Check structure differences**: Many issues come from API response structure mismatches

### Zero Production Impact
All frontend debug code is compiled away in production builds through dead code elimination.

---

## Workout Engine Debug Tools

### Block System Debugger
A comprehensive debugging system tracks exercise transformations through all phases of workout generation.

#### Components
- **BlockDebugger**: Core utility at `packages/ai/src/utils/blockDebugger.ts`
- **Debug API**: REST endpoint at `/api/debug/blocks`
- **Client Helper**: Browser utility at `apps/nextjs/src/utils/blockDebugClient.ts`

#### How to Use

1. **Enable debugging** (disabled by default for performance):
   ```javascript
   await blockDebug.enable()
   ```
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

### Filter State Persistence & Enhanced Debugging

#### Basic Filter State Persistence
1. Every time the `exercise.filter` endpoint is called, the current filter state and results are saved to:
   - **File**: `current-filter-state.json`
   - **Location**: Project root directory
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

3. **Real-time Debug Logging** (`DebugLogger`)
   - Step-by-step logging of the entire pipeline
   - Performance metrics for each phase
   - Exercise counts affected at each step
   - Organized by phase: filtering, scoring, organizing, constraint_check, selection

4. **Workout Generation History**
   - Persists to `workout-generation-history.json`
   - Tracks all generated workouts with session IDs
   - Includes filter parameters, results, and timing
   - Space for user feedback (rating, swaps, completion rate)

#### File Locations (All in project root)
- **Basic State**: `current-filter-state.json`
- **Enhanced Debug**: `enhanced-debug-state.json`
- **Workout History**: `workout-generation-history.json`

#### Usage with Claude Code
When working with Claude Code, you can ask:
- "What filters do I have selected?"
- "Why was exercise X excluded?"
- "Show me the constraint analysis for block B"
- "Read the enhanced debug data"

### Debug-to-Test Workflow

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
```

##### Step 3: Generate Test When Ready
```bash
# Generate test code from a saved scenario
npm run debug-to-test generate joint_bug
```

##### Step 4: Customize and Add to Test Suite
1. Copy generated test code
2. Add to appropriate test file
3. Add specific assertions for the issue
4. Run tests to ensure they catch the bug

#### What Gets Saved
- Complete filter state
- Enhanced debug data (if available)
- Your description and notes
- Timestamp and unique ID

#### File Locations
- **Saved scenarios**: `saved-test-scenarios/`
- **Test helper**: `packages/ai/src/utils/debugToTest.ts`
- **Browser helper**: `apps/nextjs/src/utils/testHelper.ts`

### Group Workout Data Debugging

The group workout test data has been restructured for efficient querying of client exercises and scores.

#### New Data Structure
Group workout data is saved to `apps/nextjs/session-test-data/group-workouts/latest-group-workout.json` with an improved structure:

```typescript
{
  phaseB: {
    blocks: [
      {
        blockId: "A",
        individualExercises: {
          "clientId": {
            clientName: "Curtis Yu",
            exercises: [
              {
                exerciseName: "Landmine Shoulder Press",
                individualScore: 5.75,
                rank: 1  // Position in list
              }
              // ... all 21 exercises
            ],
            totalCount: 21
          }
        }
      }
    ]
  }
}
```

#### Query Examples

##### 1. Get All Exercises for a Specific Client in a Block
```bash
# Using jq to get Curtis Yu's Block A exercises
jq '.phaseB.blocks[] | select(.blockId=="A") | .individualExercises | to_entries[] | select(.value.clientName=="Curtis Yu") | .value.exercises' latest-group-workout.json

# Simplified view (names and scores only)
jq '.phaseB.blocks[] | select(.blockId=="A") | .individualExercises | to_entries[] | select(.value.clientName=="Curtis Yu") | .value.exercises[] | {rank, name: .exerciseName, score: .individualScore}' latest-group-workout.json
```

##### 2. Compare All Clients in a Block
```bash
jq '.phaseB.blocks[] | select(.blockId=="A") | {
  blockId,
  clients: .individualExercises | to_entries | map({
    name: .value.clientName,
    count: .value.totalCount,
    selected: (.value.exercises | map(select(.isSelected)) | length)
  })
}' latest-group-workout.json
```

##### 3. Find Who Has a Specific Exercise
```bash
# Find who has "Barbell Bench Press" in Block A
jq '.phaseB.blocks[] | select(.blockId=="A") | .individualExercises | to_entries | map(select(.value.exercises[] | .exerciseName == "Barbell Bench Press") | .value.clientName)' latest-group-workout.json
```

##### 4. Get Shared Exercises in a Block
```bash
jq '.phaseB.blocks[] | select(.blockId=="A") | .sharedExercises[] | {name: .exerciseName, groupScore, sharedBy: .clientsSharing | length}' latest-group-workout.json
```

#### TypeScript Query Utilities
```typescript
// Use the provided utilities
import { getClientBlockExercises, compareClientsInBlock } from '@acme/api/utils/queryGroupWorkoutData';

// Get Curtis Yu's Block A exercises
const exercises = await getClientBlockExercises('latest-group-workout.json', 'Curtis Yu', 'A');

// Compare all clients in Block A
const comparison = await compareClientsInBlock('latest-group-workout.json', 'A');
```

#### When to Use
- Debugging exercise selection issues
- Verifying score calculations
- Checking cohesion requirements
- Comparing client exercise assignments

---

## Architecture Overview

### Separation of Concerns
The debug systems are intentionally separate:

1. **Frontend Debug System** (`apps/nextjs`)
   - Browser-based logging
   - Authentication and UI state tracking
   - Memory-based storage
   - Zero production overhead

2. **Workout Engine Debug System** (`packages/ai`)
   - Server-side processing
   - AI and workout generation tracking
   - File-based persistence
   - Detailed algorithm analysis

### Why This Separation?
- **Different Environments**: Backend (Node.js) vs Frontend (Browser)
- **Different Concerns**: AI logic vs User interactions
- **Different Performance Needs**: File I/O vs Memory constraints
- **Clear Boundaries**: Easy to understand what each system does

### Implementation Files

#### Frontend Debug Implementation
- `apps/nextjs/src/utils/frontendDebugClient.ts` - Main debug client
- `apps/nextjs/src/utils/debugCommands.ts` - Console commands
- `apps/nextjs/src/app/_components/debug-initializer.tsx` - Auto-initialization

#### Workout Engine Debug Implementation
- `packages/ai/src/utils/blockDebugger.ts` - Core block debugger
- `packages/ai/src/utils/enhancedDebug.ts` - Enhanced debug tracking
- `packages/ai/src/utils/debugToFile.ts` - File persistence
- `packages/ai/src/utils/debugToTest.ts` - Test generation
- `apps/nextjs/src/app/api/debug/blocks/route.ts` - Debug API endpoint
- `apps/nextjs/src/utils/blockDebugClient.ts` - Browser helper

---


---

This architecture ensures each system is optimized for its specific use case while maintaining clear separation of concerns.