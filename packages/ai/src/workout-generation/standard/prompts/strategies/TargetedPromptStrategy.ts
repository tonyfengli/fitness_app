/**
 * Prompt strategy for Targeted workouts (with and without finisher, with and without core)
 */

import type { GroupScoredExercise } from "../../../../types/groupContext";
import type { PreAssignedExercise } from "../../../../types/standardBlueprint";
import type { PromptStrategy, PromptStrategyConfig } from "./PromptStrategy";
import { WorkoutType } from "../../../../types/clientTypes";

export class TargetedPromptStrategy implements PromptStrategy {
  constructor(private config: PromptStrategyConfig) {}

  buildConstraints(): string {
    // This method is not used in the new condensed prompt format
    // Constraints are now integrated into the main prompt
    return "";
  }

  buildWorkoutFlow(): string {
    const withFinisher =
      this.config.workoutType === WorkoutType.TARGETED_WITH_FINISHER ||
      this.config.workoutType === WorkoutType.TARGETED_WITH_FINISHER_WITH_CORE;

    if (withFinisher) {
      return `### 💪 Workout Flow Guidance - TARGETED WORKOUT WITH FINISHER

Your selections will complete this workout structure:
1. Pre-assigned exercises (already selected) - typically favorites/includes
2. Your selected exercises (${this.config.exercisesToSelect} to choose)
3. High-intensity finisher to end strong

Distribution Guidelines:
- Primary strength movements: 30-40%
- Secondary strength movements: 40-50%
- Accessory/targeted work: 20-30%
- Finisher: Include 1 high-rep metabolic exercise

**TARGETED WORKOUT NOTE**: Emphasize exercises that directly work the client's muscle targets.`;
    } else {
      return `### 💪 Workout Flow Guidance - TARGETED WORKOUT

Your selections will complete this workout structure:
1. Pre-assigned exercises (already selected) - typically favorites/includes
2. Your selected exercises (${this.config.exercisesToSelect} to choose)

Distribution Guidelines:
- Primary strength movements: 40-50%
- Secondary strength movements: 30-40%
- Accessory/targeted work: 20-30%

Balance the workout while maintaining variety.

**TARGETED WORKOUT NOTE**: Prioritize exercises that directly work the client's muscle targets.`;
    }
  }

  buildSelectionPriorities(): string {
    return `### 🎯 Selection Priorities (In Order) - TARGETED WORKOUT

1. **Muscle Targets First (CRITICAL for Targeted Workouts)**
   - Prioritize exercises that directly hit client's specified muscle targets
   - Must include all muscle_targets from preferences
   - Select exercises where target muscles are primary movers

2. **Movement Pattern Balance**
   - Don't over-select from one pattern unless targeting requires it
   - Ensure push-pull balance when possible
   - Mix compound and isolation movements

3. **Shared Exercises When Beneficial**
   - Choose shared exercises that align with muscle targets
   - Individual needs take priority over sharing
   - Consider exercises multiple clients can perform together

4. **Training Effect**
   - Match intensity to client's level
   - Appropriate volume for muscle groups
   - Smart exercise sequencing

**TARGETED WORKOUT REMINDER**: This is a targeted workout - muscle target coverage is the #1 priority!`;
  }

  getExercisesToSelect(
    intensity?: "low" | "moderate" | "high" | "intense",
  ): number {
    // Same logic as full body
    const totalExercises = this.getTotalExercisesForIntensity(intensity);
    return totalExercises - 2; // Assuming 2 pre-assigned
  }

  private getTotalExercisesForIntensity(
    intensity?: "low" | "moderate" | "high" | "intense",
  ): number {
    switch (intensity) {
      case "low":
        return 4;
      case "moderate":
        return 6;
      case "high":
        return 8;
      case "intense":
        return 10;
      default:
        return 6;
    }
  }

  formatPreAssignedExercises(preAssigned: PreAssignedExercise[]): string {
    if (preAssigned.length === 0) {
      return "No pre-assigned exercises";
    }

    return preAssigned
      .map((pa, idx) => {
        const source = pa.source === "shared_other" ? "Shared" : pa.source;
        const tieInfo = pa.tiedCount ? ` (tied with ${pa.tiedCount})` : "";
        return `${idx + 1}. ${pa.exercise.name} [${source}${tieInfo}]`;
      })
      .join("\n");
  }

  buildSharedExerciseGuidance(sharedExercises: GroupScoredExercise[]): string {
    if (sharedExercises.length === 0) {
      return "No shared exercises available - focus on individual client needs (TARGETED WORKOUT)";
    }

    const topShared = sharedExercises.slice(0, 5);

    return `### 🤝 Shared Exercise Opportunities (TARGETED WORKOUT)

These exercises work for multiple clients (only use if they match muscle targets):
${topShared
  .map(
    (ex, idx) =>
      `${idx + 1}. ${ex.name} (${ex.clientsSharing.length} clients, score: ${ex.groupScore.toFixed(1)})`,
  )
  .join("\n")}

**TARGETED WORKOUT NOTE**: Only select shared exercises if they align with client's muscle targets!`;
  }
}