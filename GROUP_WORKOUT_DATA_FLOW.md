# Group Workout Data Flow Analysis

## Overview
This document details the complete data flow for group workouts from LLM response through database storage to frontend display.

## Data Flow Diagram

```
┌─────────────────────┐
│   Phase 1: Setup    │
│                     │
│ 1. Create Training  │
│    Session          │
│ 2. Users Register   │
│ 3. Collect Prefs    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Phase 2: Blueprint  │
│    Generation       │
│                     │
│ 1. Filter Exercises │
│ 2. Score Per Client │
│ 3. Create Blueprint │
│ 4. Store in         │
│    templateConfig   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Phase 3: Workout    │
│    Creation         │
│                     │
│ 1. LLM Phase 1:     │
│    Select Exercises │
│ 2. Create Workout   │
│    Records          │
│ 3. Store in         │
│    WorkoutExercise  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Phase 4: Round      │
│    Organization     │
│                     │
│ 1. LLM Phase 2:     │
│    Organize Rounds  │
│ 2. Update           │
│    workoutOrg       │
│ 3. Update groupName │
│    in exercises     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Phase 5: Display    │
│                     │
│ 1. Query sessionW   │
│    orkoutsWithEx    │
│ 2. Group by round   │
│ 3. Display stations │
└─────────────────────┘
```

## Database Schema

### TrainingSession Table
```typescript
{
  id: uuid,
  businessId: uuid,
  trainerId: text,
  name: varchar(255),
  scheduledAt: timestamp,
  templateType: varchar(50), // e.g., "full_body_bmf"
  templateConfig: jsonb,     // Stores group workout blueprint
  workoutOrganization: jsonb, // Stores Phase 2 round organization
  status: enum // "open", "in_progress", "completed", "cancelled"
}
```

### Workout Table
```typescript
{
  id: uuid,
  trainingSessionId: uuid,  // Optional - can be null for individual workouts
  userId: text,
  businessId: uuid,
  createdByTrainerId: text,
  completedAt: timestamp,
  notes: text,
  workoutType: text,
  totalPlannedSets: integer,
  llmOutput: jsonb,         // Raw LLM response
  templateConfig: jsonb,    // Template-specific config
  context: text,            // "group", "individual", "homework", "assessment"
  status: varchar(50)       // "draft", "ready", "completed"
}
```

### WorkoutExercise Table
```typescript
{
  id: uuid,
  workoutId: uuid,
  exerciseId: uuid,
  orderIndex: integer,      // Order within workout
  setsCompleted: integer,
  groupName: text,          // "Round 1", "Round 2", etc. (populated by Phase 2)
  isShared: boolean,
  sharedWithClients: text[],
  selectionSource: varchar(50), // "llm_phase1", "manual_swap", "pre_assigned"
  createdAt: timestamp
}
```

## Detailed Flow Steps

### 1. Blueprint Generation (generateGroupWorkout)
- **Input**: Session ID, group context, exercises
- **Process**: 
  - Filter exercises per client preferences
  - Score exercises based on client needs
  - Create blueprint with shared/individual pools
- **Output**: Blueprint stored in `TrainingSession.templateConfig`

### 2. Workout Creation (LLM Phase 1)
- **Input**: Blueprint with exercise pools
- **Process**:
  - LLM selects exercises from pools
  - Creates `Workout` record per client
  - Creates `WorkoutExercise` records with initial orderIndex
- **Output**: Workouts with exercises (no rounds yet)

### 3. Round Organization (LLM Phase 2 - startWorkout)
- **Input**: All workouts and exercises for session
- **Process**:
  - Fetch all workouts with exercises
  - LLM organizes into rounds (max 5)
  - Updates `TrainingSession.workoutOrganization`
  - Updates `WorkoutExercise.groupName` with round names
  - Updates `WorkoutExercise.orderIndex` for proper ordering
- **Output**: Organized rounds stored in database

### 4. Frontend Display (workout-live)
- **Query**: `sessionWorkoutsWithExercises`
  - Fetches all workouts for session
  - Includes exercise details
  - Includes groupName (round assignment)
- **Processing**:
  - Groups exercises by round (groupName)
  - Groups participants by exercise
  - Displays as stations

## Key Data Transformations

### 1. Blueprint → Exercise Selection
```typescript
// Blueprint structure
{
  clientExercisePools: {
    [clientId]: {
      preAssigned: Exercise[],
      availableCandidates: Exercise[],
      totalExercisesNeeded: number
    }
  },
  sharedExercisePool: Exercise[]
}

// Transformed to WorkoutExercise records
{
  exerciseId: string,
  orderIndex: number,
  setsCompleted: number,
  groupName: null // Initially null
}
```

### 2. Exercise Selection → Round Organization
```typescript
// Phase 2 LLM output
{
  rounds: [
    {
      roundNumber: 1,
      roundName: "Round 1 - Lower Body Focus",
      duration: "10 minutes",
      exercises: [
        {
          exerciseName: "Barbell Back Squat",
          participants: ["John", "Sarah"],
          sets: 3,
          reps: "8-10",
          equipment: ["barbell", "squat rack"]
        }
      ]
    }
  ]
}

// Updates WorkoutExercise.groupName
"Round 1 - Lower Body Focus"
```

## Architecture Observations

### Strengths
1. **Separation of Concerns**: Clear phases with distinct responsibilities
2. **Flexibility**: Supports both group and individual workouts
3. **Audit Trail**: Stores raw LLM outputs for debugging
4. **Real-time Updates**: Frontend can query latest round organization

### Areas for Improvement

1. **Round Organization Storage**:
   - Currently stored in two places (workoutOrganization + groupName)
   - Could be normalized into a separate Round table

2. **Exercise Metadata**:
   - Sets/reps stored in notes field as text
   - Could benefit from structured fields

3. **Performance**:
   - sessionWorkoutsWithExercises fetches all data
   - Could optimize with round-specific queries

4. **State Management**:
   - No clear state machine for workout progression
   - Could track which round is active

## Recommendations

### 1. Add Round Table
```sql
CREATE TABLE workout_round (
  id UUID PRIMARY KEY,
  training_session_id UUID REFERENCES training_session(id),
  round_number INTEGER,
  round_name TEXT,
  duration_minutes INTEGER,
  equipment_needed TEXT[],
  notes TEXT
);
```

### 2. Enhance WorkoutExercise
```sql
ALTER TABLE workout_exercise ADD COLUMN
  round_id UUID REFERENCES workout_round(id),
  target_sets INTEGER,
  target_reps TEXT,
  rest_seconds INTEGER;
```

### 3. Add Session State Tracking
```sql
ALTER TABLE training_session ADD COLUMN
  current_round INTEGER DEFAULT 1,
  round_started_at TIMESTAMP;
```

### 4. Optimize Queries
- Add query to fetch exercises for specific round
- Cache round organization on frontend
- Use database views for common queries

## Security Considerations

1. **Access Control**: 
   - Trainers can see all workouts
   - Clients only see their own
   - Proper business scope validation

2. **Data Validation**:
   - Exercise IDs validated against business exercises
   - Round count limited to 5
   - Proper null checks on optional fields