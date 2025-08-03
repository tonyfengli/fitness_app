# GROUP_WORKOUT_ARCHITECTURE.md - Comprehensive Audit

## Executive Summary

This audit identifies discrepancies between the GROUP_WORKOUT_ARCHITECTURE.md documentation and the current codebase implementation. The document is significantly outdated and missing major features while containing some inaccurate information.

## 1. SCORING DISCREPANCIES

### ❌ Intensity Scoring is DEPRECATED
**Documentation Says:**
```
**Intensity Adjustments** (Positive-Only Scoring):
Maps workout intensity to exercise fatigue profiles:
| Workout Intensity | Exercise Fatigue Type | Adjustment |
|------------------|----------------------|------------|
| **Low** | low_local | +1.0 |
| **Low** | moderate_local | +0.5 |
...
```

**Reality:**
- Intensity scoring has been REMOVED from the system
- `calculateIntensityAdjustment()` always returns 0
- Comment in code: "DEPRECATED: Intensity no longer affects exercise scores"
- All intensity values in SCORING_CONFIG are set to 0

### ✅ Favorite Exercise Boost is Correct
- Documentation correctly states +2.0 boost
- Implemented in `firstPassScoring.ts` with `FAVORITE_EXERCISE_BOOST: 2.0`

### ✅ Other Scoring Values are Correct
- Base score: 5.0 ✓
- Muscle target bonuses: +3.0 primary, +1.5 secondary ✓
- Muscle lessen penalties: -3.0 primary, -1.5 secondary ✓

## 2. MISSING MAJOR FEATURES

### ❌ Standard Template System Not Documented
The document completely misses the new Standard Template system:
- `processForStandardGroup()` method in TemplateProcessor
- Two-phase LLM approach
- Client-pooled exercise organization
- Different from BMF block-based approach

### ❌ Pre-Assignment System Not Documented
Major missing feature:
- Pre-assignment phase (Phase 3) before template processing
- `PreAssignmentService` class
- `workoutTypeStrategies.ts` with workout-specific rules
- Body part balancing for favorites

### ❌ Bucketing System Not Documented
Complete constraint-based bucketing system missing:
- `fullBodyBucketing.ts` implementation
- 4-phase bucketing (movement patterns → muscle target → capacity → flex)
- Constraint fulfillment logic
- Tie-breaking system

### ❌ Workout Types Not Documented
Missing WorkoutType enum and configurations:
- FULL_BODY_WITH_FINISHER
- FULL_BODY_WITHOUT_FINISHER
- TARGETED_WITH_FINISHER
- TARGETED_WITHOUT_FINISHER
- BUCKET_CONFIGS with constraints per type

## 3. DATA STRUCTURE DISCREPANCIES

### ❌ ClientContext is Outdated
**Documentation Shows:**
```typescript
interface ClientContext {
  user_id: string;
  name: string;
  strength_capacity: 'very_low' | 'low' | 'moderate' | 'high';
  skill_capacity: 'very_low' | 'low' | 'moderate' | 'high';
  primary_goal: string;
  intensity: 'low' | 'moderate' | 'high';
  muscle_target?: string[];
  muscle_lessen?: string[];
  exercise_requests?: {
    include: string[];
    avoid: string[];
  };
  avoid_joints?: string[];
}
```

**Missing Fields:**
- `business_id?: string`
- `templateType?: "standard" | "circuit" | "full_body"`
- `default_sets?: number`
- `favoriteExerciseIds?: string[]`
- `intensity` now includes 'intense' option

### ❌ GroupContext is Outdated
**Missing Fields:**
- `workoutType?: WorkoutType`

### ❌ Missing New Types
Not documented:
- `StandardGroupWorkoutBlueprint`
- `ClientExercisePool`
- `PreAssignedExercise`
- `BucketedSelection`
- `BucketingResult`

## 4. PIPELINE FLOW DISCREPANCIES

### ❌ Phase 3 is Now Pre-Assignment
**Documentation Says:** Phase 3 is Template Processing
**Reality:** 
- Phase 3 is Pre-Assignment (new)
- Phase 4 is Template Processing
- Phase 5 is Bucketing (new)
- Phase 6 is LLM Generation

### ❌ Missing Standard Template Flow
Document only covers BMF template flow, missing:
- Standard template's client-pooled approach
- Two-phase LLM generation
- Different blueprint structure

## 5. OUTDATED INFORMATION TO REMOVE

### ❌ Legacy Field Still Marked as Active
```
// Legacy field - not actively used but still present in types
groupExercisePools?: {
  [blockId: string]: GroupScoredExercise[];
};
```
This is correctly marked as legacy in the doc.

### ❌ Phase Numbering is Wrong
- Document shows 5 phases
- Reality has 6+ phases with pre-assignment and bucketing

### ❌ Individual Workout Processing
Document mentions:
```
processForIndividual(exercises: ScoredExercise[]): Record<string, ScoredExercise[]> {
  throw new Error("Individual workout processing not implemented yet");
}
```
Still not implemented, but shouldn't be prominently featured.

## 6. MISSING IMPLEMENTATION DETAILS

### Not Documented:
1. **Tie-Breaking System**
   - Random selection from equal scores
   - UI indicators for tied exercises
   - Tracked throughout pre-assignment and bucketing

2. **Case-Insensitive Matching**
   - Movement patterns normalized to lowercase
   - Muscle names compared case-insensitively

3. **Constraint Analysis**
   - `constraintAnalyzer.ts` utilities
   - Real-time constraint fulfillment checking
   - `getRemainingNeeds()` function

4. **Frontend Updates**
   - Dynamic constraint display from BUCKET_CONFIGS
   - Pre-assignment requirements section
   - Smart bucketed selection display

## 7. API ENDPOINTS UPDATE NEEDED

### ❌ Missing Workout Type Parameter
Document doesn't mention that API endpoints now accept workoutType parameter for standard templates.

## RECOMMENDATIONS

### High Priority Updates:
1. Add complete Standard Template section
2. Document Pre-Assignment phase as new Phase 3
3. Document Bucketing phase as new Phase 5
4. Update all type definitions
5. Remove intensity scoring documentation
6. Update phase numbering throughout

### Medium Priority Updates:
1. Add workout types documentation
2. Document tie-breaking system
3. Add constraint fulfillment details
4. Update frontend integration section

### Low Priority Updates:
1. Remove emphasis on unimplemented individual workouts
2. Update performance characteristics
3. Add new file locations

### Sections to Remove:
1. Intensity scoring table and explanations
2. References to 5-phase pipeline (now 6+)
3. Outdated type definitions

The documentation needs a major overhaul to reflect the significant architectural changes, particularly the addition of the Standard Template system with its pre-assignment and bucketing features.