/**
 * Prompt strategy for Full Body workouts (with and without finisher)
 */

import type { GroupScoredExercise } from "../../../../types/groupContext";
import type { PreAssignedExercise } from "../../../../types/standardBlueprint";
import type { PromptStrategy, PromptStrategyConfig } from "./PromptStrategy";
import { WorkoutType } from "../../../types/workoutTypes";

export class FullBodyPromptStrategy implements PromptStrategy {
  constructor(private config: PromptStrategyConfig) {}

  buildConstraints(): string {
    const withFinisher =
      this.config.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER;

    return `### ✅ MUST Follow (Hard Constraints)

1. **Movement Pattern Coverage**
   - Ensure variety across different movement patterns
   - ${withFinisher ? "Include at least one high-intensity finisher exercise" : "Focus on balanced strength movements"}
   - Avoid selecting multiple exercises from the same movement pattern unless targeting specific muscles

2. **🎯 Muscle Target Requirements (Final)**
   - You MUST include exercises for all muscle_targets provided by the client
   - If only one muscle is targeted, assign at least one exercise that trains that muscle as a primary mover, and a second exercise that targets it either as a primary or secondary mover
   - If two or more muscles are targeted, assign at least one primary exercise for each target muscle
   - ❗ MAXIMUM 2 exercises per primary muscle group across your entire selection to ensure balanced programming
   - Consider compound movements that hit multiple targets efficiently
   - If the client has no specific muscle targets, ensure exercises are distributed evenly across upper body, lower body, and core, without overloading any single region
   - ❗ Do not include more than 1 compound lower-body movement (squat, deadlift, lunge variations) unless the client specifically targets lower body. Count pre-assigned exercises toward this limit

3. **Avoid Muscle Lessens**
   - DO NOT select exercises that significantly work "lessen" muscles
   - Check both primary and secondary muscle groups

4. **Joint Safety**
   - Avoid exercises that stress joints marked as "avoid"
   - Consider exercise modifications if needed

5. **No Duplicates**
   - Do not select exercises already in the pre-assigned list
   - Each exercise can only appear once per client`;
  }

  buildWorkoutFlow(): string {
    const withFinisher =
      this.config.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER;

    if (withFinisher) {
      return `### 🏃 Workout Flow

**Full Body with Metabolic Finisher**

Structure: Compound strength movements → Accessory work → High-intensity finisher

Exercise Selection Guidance:
- Start with multi-joint compound movements (squats, presses, pulls)
- Include targeted accessory work for muscle targets
- End with 1-2 metabolic/conditioning exercises
- Ensure at least one exercise has capacity/conditioning focus
- Balance push/pull and upper/lower movements`;
    }

    return `### 🏃 Workout Flow

**Full Body Strength Focus**

Structure: Progressive strength training across all major movement patterns

Exercise Selection Guidance:
- Prioritize compound movements for efficiency
- Focus on strength and muscle building
- No specific conditioning requirement
- Ensure balanced coverage of all muscle groups`;
  }

  buildSelectionPriorities(): string {
    return `### ⚖️ Selection Priorities

1. **🎯 Muscle Target Requirements** (Highest Priority)
   - You MUST include exercises for all muscle_targets provided by the client
   - If only one muscle is targeted, assign at least one exercise that trains that muscle as a primary mover, and a second exercise that targets it either as a primary or secondary mover
   - If two or more muscles are targeted, assign at least one primary exercise for each target muscle
   - Consider compound movements that hit multiple targets efficiently

2. **Gap Analysis - Fill the Blanks**
   - CAREFULLY review the pre-assigned exercises to identify:
     * Movement patterns already covered (e.g., if hinge is covered, prioritize push/pull/squat/lunge)
     * Muscle groups already worked (e.g., if glutes/lats are covered, prioritize chest/shoulders/quads)
     * Exercise types present (e.g., if isolation exercises dominate, add compound movements)
   - Your selections should complement, not duplicate, what's already assigned
   - Aim for a complete, balanced workout across all movement patterns and muscle groups
   - Even when targeting specific muscles, maintain overall balance (max 2 exercises per primary muscle)

3. **Movement Variety**
   - Distribute selections across different movement patterns
   - Avoid clustering (e.g., 3 pushing exercises)
   - Count pre-assigned exercises when evaluating pattern distribution
   
4. **Score Optimization**
   - Among valid options, prefer higher-scoring exercises
   - Scores already factor in client preferences and capabilities
   
5. **Training Effect**
   - Consider exercise complexity and training stimulus
   - Mix bilateral and unilateral movements when appropriate`;
  }

  getExercisesToSelect(
    intensity?: "low" | "moderate" | "high" | "intense",
  ): number {
    // Use the already calculated value from config
    // This accounts for variable pre-assigned counts (2 or 3)
    return this.config.exercisesToSelect;
  }

  formatPreAssignedExercises(preAssigned: PreAssignedExercise[]): string {
    if (preAssigned.length === 0) return "No pre-assigned exercises";

    let output = "Pre-assigned exercises (DO NOT select these again):\n";

    preAssigned.forEach((pa, idx) => {
      const ex = pa.exercise;
      output += `${idx + 1}. **${ex.name}**\n`;
      output += `   - Movement: ${ex.movementPattern}, Primary: ${ex.primaryMuscle}`;
      if (ex.secondaryMuscles && ex.secondaryMuscles.length > 0) {
        output += `, Secondary: ${ex.secondaryMuscles.join(", ")}`;
      }
      output += "\n";
      output += `   - Source: ${pa.source}`;
      if (pa.tiedCount) {
        output += ` (selected from ${pa.tiedCount} tied options)`;
      }
      if (pa.sharedWith && pa.sharedWith.length > 0) {
        output += `\n   - Shared with ${pa.sharedWith.length} other client${pa.sharedWith.length > 1 ? "s" : ""}`;
      }
      output += "\n\n";
    });

    // Add summary of what's already covered
    output += "**Coverage Analysis:**\n";
    const movements = preAssigned
      .map((pa) => pa.exercise.movementPattern)
      .filter(Boolean);
    const uniqueMovements = [...new Set(movements)];
    output += `- Movement Patterns: ${uniqueMovements.join(", ") || "none"}\n`;

    const primaryMuscles = preAssigned
      .map((pa) => pa.exercise.primaryMuscle)
      .filter(Boolean);
    const secondaryMuscles = preAssigned.flatMap(
      (pa) => pa.exercise.secondaryMuscles || [],
    );
    const allMuscles = [...new Set([...primaryMuscles, ...secondaryMuscles])];
    output += `- Muscle Groups: ${allMuscles.join(", ") || "none"}\n`;

    return output;
  }

  buildSharedExerciseGuidance(sharedExercises: GroupScoredExercise[]): string {
    // No longer needed - shared exercises are handled in pre-assignment
    return "";
  }
}
