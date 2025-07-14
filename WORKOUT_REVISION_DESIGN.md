# Workout Revision System Design

## Overview
When an LLM generates a workout, trainers should be able to request revisions with specific feedback. The system should maintain history while keeping the data model clean.

## Proposed Schema Changes

### 1. Update Workout Table
```sql
-- Add to existing Workout table
ALTER TABLE workout ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workout ADD COLUMN parent_workout_id UUID REFERENCES workout(id);
-- parent_workout_id points to the PREVIOUS version (v2 points to v1)
ALTER TABLE workout ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
-- status values: 'draft', 'active', 'superseded', 'rejected'
ALTER TABLE workout ADD COLUMN finalized_at TIMESTAMP;
```

### 2. New WorkoutRevisionRequest Table
```typescript
export const WorkoutRevisionRequest = pgTable("workout_revision_request", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  workoutId: t.uuid().notNull().references(() => Workout.id),
  
  // What changes are requested
  requestType: t.text().notNull(), // 'regenerate', 'modify_exercises', 'adjust_volume', etc.
  requestDetails: t.jsonb().notNull(), // Structured feedback
  requestText: t.text(), // Free-form trainer notes
  
  // Who and when
  requestedBy: t.text().notNull().references(() => user.id),
  createdAt: t.timestamp().defaultNow().notNull(),
  
  // Resolution
  resolvedAt: t.timestamp(),
  resolvedWorkoutId: t.uuid().references(() => Workout.id), // The new workout created from this request
}));
```

## Version Chain Example

```
Workout v1 (initial)          Workout v2                    Workout v3 (final)
id: aaa-111                   id: bbb-222                   id: ccc-333
version: 1                    version: 2                    version: 3
parent_workout_id: null  <--  parent_workout_id: aaa-111  <-- parent_workout_id: bbb-222
status: 'superseded'          status: 'superseded'          status: 'active'
                                                            finalized_at: 2024-01-10 10:30
```

The parent_workout_id creates a linked list going backwards through the revision history.

## Workflow

### Initial Generation
1. Trainer requests workout generation for client
2. LLM generates workout
3. Workout saved with `status: 'draft'`, `version: 1`
4. Trainer reviews workout

### Revision Flow
1. If trainer wants changes:
   - Create `WorkoutRevisionRequest` with specific feedback
   - Pass original workout + feedback to LLM
   - Generate new workout with `version: 2`, `parent_workout_id: [original]`
   - Original workout gets `status: 'superseded'`
   
2. If trainer accepts:
   - Update workout `status: 'active'`, set `finalized_at`
   - This becomes the official workout for the session

### Benefits of This Approach

1. **Audit Trail**: Every version is saved
2. **Learning Opportunity**: Can analyze revision patterns to improve initial generation
3. **Client Transparency**: Can show clients how their workout was refined
4. **Rollback Capability**: Can revert to previous versions if needed
5. **Clean Active State**: Easy to query for current active workouts

## API Endpoints

### 1. Generate Initial Workout
```typescript
// Existing endpoint
api.workout.saveWorkout({
  trainingSessionId: "...",
  userId: "...",
  llmOutput: {...},
  workoutType: "standard"
})
```

### 2. Request Revision
```typescript
api.workout.requestRevision({
  workoutId: "...",
  requestType: "modify_exercises",
  requestDetails: {
    blockA: { 
      feedback: "Replace barbell squat with goblet squat",
      reason: "Client has lower back issues"
    }
  },
  requestText: "Client mentioned lower back discomfort..."
})
```

### 3. Generate Revised Workout
```typescript
api.workout.generateRevision({
  revisionRequestId: "...",
  // This will:
  // 1. Get original workout + revision request
  // 2. Call LLM with context
  // 3. Create new workout with version+1
  // 4. Link to parent workout
  // 5. Update revision request with resolution
})
```

### 4. Finalize Workout
```typescript
api.workout.finalize({
  workoutId: "...",
  // Updates status to 'active', sets finalized_at
})
```

## Frontend UI Flow

1. **Initial Generation**:
   - "Generate Workout" button
   - Shows generated workout with "Accept" / "Request Changes" buttons

2. **Revision Interface**:
   - Structured feedback form (checkboxes for common issues)
   - Free text area for specific notes
   - "Regenerate" button

3. **History View**:
   - Show version timeline
   - Display what changed between versions
   - Show revision reasons

## Database Queries

### Get Active Workout for Session
```sql
SELECT * FROM workout 
WHERE training_session_id = ? 
  AND user_id = ?
  AND status = 'active'
ORDER BY version DESC
LIMIT 1;
```

### Get Workout History
```sql
WITH RECURSIVE workout_tree AS (
  -- Get the latest workout
  SELECT * FROM workout 
  WHERE training_session_id = ? AND user_id = ?
  ORDER BY version DESC LIMIT 1
  
  UNION ALL
  
  -- Get all parent workouts
  SELECT w.* FROM workout w
  INNER JOIN workout_tree wt ON w.id = wt.parent_workout_id
)
SELECT * FROM workout_tree ORDER BY version DESC;
```

## Future Enhancements

1. **ML Feedback Loop**: Use revision patterns to improve initial generation
2. **Revision Templates**: Common revision types (e.g., "Lower intensity", "No equipment")
3. **Batch Revisions**: Apply similar changes to multiple clients
4. **Revision Analytics**: Dashboard showing common revision patterns