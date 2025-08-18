/**
 * Builds exercise selection prompts for individual clients
 * Adapts content based on workout type and intensity
 */

import type { ClientContext } from "../../../types/clientContext";
import type { GroupScoredExercise } from "../../../types/groupContext";
import type { ScoredExercise } from "../../../types/scoredExercise";
import type { PreAssignedExercise } from "../../../types/standardBlueprint";
import type { PromptStrategy } from "./strategies/PromptStrategy";
import { WorkoutType } from "../../types/workoutTypes";
import { FullBodyPromptStrategy } from "./strategies/FullBodyPromptStrategy";

export interface ClientPromptConfig {
  client: ClientContext;
  workoutType: WorkoutType;
  preAssigned: PreAssignedExercise[];
  candidates: ScoredExercise[]; // The 15 bucketed candidates
  sharedExercises: GroupScoredExercise[]; // Shared pool info
  otherClientsInfo: Array<{
    // Basic info about other clients for context
    name: string;
    muscleTargets: string[];
  }>;
}

export class ClientExerciseSelectionPromptBuilder {
  private strategy: PromptStrategy;

  constructor(private config: ClientPromptConfig) {
    // Select appropriate strategy based on workout type
    this.strategy = this.createStrategy();
  }

  private createStrategy(): PromptStrategy {
    // First determine how many exercises to select based on intensity and pre-assigned count
    const exercisesToSelect = this.getExercisesToSelectForIntensity(
      this.config.client.intensity,
      this.config.preAssigned.length,
    );

    const strategyConfig = {
      workoutType: this.config.workoutType,
      intensity: this.config.client.intensity,
      totalExercisesNeeded: this.config.preAssigned.length + exercisesToSelect,
      exercisesToSelect,
    };

    // Create the strategy with the full config
    return this.createStrategyFromConfig(strategyConfig);
  }

  private createStrategyFromConfig(strategyConfig: any): PromptStrategy {
    // Add more strategies here as workout types are implemented
    switch (this.config.workoutType) {
      case WorkoutType.FULL_BODY_WITH_FINISHER:
      case WorkoutType.FULL_BODY_WITHOUT_FINISHER:
        return new FullBodyPromptStrategy(strategyConfig);

      case WorkoutType.TARGETED_WITH_FINISHER:
      case WorkoutType.TARGETED_WITHOUT_FINISHER:
        // TODO: Implement TargetedPromptStrategy
        throw new Error(`Targeted workout prompts not yet implemented`);

      default:
        throw new Error(`Unknown workout type: ${this.config.workoutType}`);
    }
  }

  // Standalone method to get exercise count based on intensity
  private getExercisesToSelectForIntensity(
    intensity?: "low" | "moderate" | "high" | "intense",
    preAssignedCount: number = 2,
  ): number {
    const totalExercises = this.getTotalExercisesForIntensity(intensity);
    return totalExercises - preAssignedCount;
  }

  private getTotalExercisesForIntensity(
    intensity?: "low" | "moderate" | "high" | "intense",
  ): number {
    switch (intensity) {
      case "low":
        return 4;
      case "moderate":
        return 5;
      case "high":
        return 6;
      case "intense":
        return 7;
      default:
        return 5; // Default to moderate
    }
  }

  private getExercisesToSelect(): number {
    // Use the already calculated value from strategy config
    return this.getExercisesToSelectForIntensity(
      this.config.client.intensity,
      this.config.preAssigned.length,
    );
  }

  build(): string {
    const exercisesToSelect = this.getExercisesToSelect();

    return `SYSTEM PROMPT — Phase 1 Exercise Selector (Condensed)
You are selecting EXACTLY ${exercisesToSelect} exercises for a single client from a curated list. These will complement the client's pre-assigned exercises to complete today's workout.

Inputs (filled at runtime)
Client: ${this.buildClientInfo()}

Pre-assigned exercises: ${this.config.preAssigned.length} items (do not re-select)
${this.buildPreAssignedList()}

Available options: ${this.config.candidates.length} items
${this.buildCandidatesList()}

Workout type: ${this.formatWorkoutType(this.config.workoutType)}

Hard Rules
Select exactly ${exercisesToSelect} new exercises (not pre-assigned).

Names must match exactly (case-sensitive).

${this.buildClientConstraints()}

Movement & muscle balance: Complement pre-assigned patterns/muscles; avoid stacking duplicates unless required by targets.

${this.buildMuscleTargetRules()}

Max 2 exercises per primary muscle across the whole session (including pre-assigned).

Lower-body compound limit: Do not exceed 1 compound lower-body movement (squat/deadlift/lunge family) across pre-assigned + selected unless the client explicitly targets lower body.

Prefer higher score among equally valid choices.

Avoid unnecessary complexity; pick options appropriate for ${this.config.client.intensity} intensity.

Selection Priorities (apply in order)
Satisfy muscle target requirements.

Fill gaps from pre-assigned (patterns/muscles).

Maintain variety (push/pull, upper/lower, core vs non-core).

Prefer higher score ties.

Output (JSON only)
Return only this JSON. Keep reasoning short (≤ 20 words). No extra keys.

\`\`\`json
{
  "selectedExercises": [${this.buildExerciseTemplate(exercisesToSelect)}
  ],
  "summary": {
    "totalSelected": ${exercisesToSelect},
    "sharedExercises": 0,
    "muscleTargetsCovered": ["<targets covered across pre-assigned + selected>"],
    "movementPatterns": ["<patterns across pre-assigned + selected>"],
    "overallReasoning": "≤25 words."
  }
}
\`\`\`

Guardrails
Do not invent exercises.

If constraints conflict, prioritize in this order: safety (joints/lessen) → muscle target coverage → movement balance → score.

If no valid pair exists under all rules, choose the safest valid pair and note trade-off in overallReasoning.

Stop after selecting the first valid high-scoring exercise combination that satisfies all constraints. Do not generate or compare alternative combinations once a valid set is found.`;
  }

  private buildClientInfo(): string {
    const client = this.config.client;
    const parts = [
      `name: ${client.name}`,
      `goal: ${client.primary_goal || "general_fitness"}`,
      `intensity: ${client.intensity}`,
    ];

    if (client.muscle_target && client.muscle_target.length > 0) {
      parts.push(`muscle_targets: ${client.muscle_target.join(", ")}`);
    }

    if (client.muscle_lessen && client.muscle_lessen.length > 0) {
      parts.push(`muscles_to_lessen: ${client.muscle_lessen.join(", ")}`);
    }

    if (client.avoid_joints && client.avoid_joints.length > 0) {
      parts.push(`joints_to_avoid: ${client.avoid_joints.join(", ")}`);
    }

    return parts.join(", ");
  }

  private buildPreAssignedList(): string {
    return this.config.preAssigned
      .map(
        (pa) =>
          `- ${pa.exercise.name} (${pa.exercise.movementPattern}, primary: ${pa.exercise.primaryMuscle}, secondary: ${pa.exercise.secondaryMuscles?.join(", ") || "none"}, score: ${Math.round(pa.exercise.score)})`,
      )
      .join("\n");
  }

  private buildCandidatesList(): string {
    return this.config.candidates
      .map(
        (ex, idx) =>
          `${idx + 1}. ${ex.name} (${ex.movementPattern}, primary: ${ex.primaryMuscle}, secondary: ${ex.secondaryMuscles?.join(", ") || "none"}, score: ${Math.round(ex.score)})`,
      )
      .join("\n");
  }

  private buildClientConstraints(): string {
    const constraints = [];

    if (
      this.config.client.muscle_lessen &&
      this.config.client.muscle_lessen.length > 0
    ) {
      constraints.push(
        `Respect muscles_to_lessen (${this.config.client.muscle_lessen.join(", ")}): exclude exercises that significantly load them.`,
      );
    }

    if (
      this.config.client.avoid_joints &&
      this.config.client.avoid_joints.length > 0
    ) {
      constraints.push(
        `Respect joints_to_avoid (${this.config.client.avoid_joints.join(", ")}): exclude exercises that stress these joints.`,
      );
    }

    return constraints.join("\n\n");
  }

  private buildMuscleTargetRules(): string {
    if (
      !this.config.client.muscle_target ||
      this.config.client.muscle_target.length === 0
    ) {
      return "";
    }

    const targets = this.config.client.muscle_target;

    if (targets.length === 1) {
      return `Muscle targets: ${targets[0]} → pick one primary for that muscle + one that hits it primary or secondary.`;
    } else {
      return `Muscle targets: ${targets.join(", ")} → pick ≥1 primary for each target (across pre-assigned + selected).`;
    }
  }

  private buildExerciseTemplate(count: number): string {
    const templates = [];
    for (let i = 0; i < count; i++) {
      templates.push(`
    {
      "exerciseName": "<exact from list>",
      "isShared": false,
      "satisfiesConstraints": ["muscle_target", "movement_variety"],
      "reasoning": "≤20 words."
    }`);
    }
    return templates.join(",");
  }

  private buildClientContext(): string {
    const client = this.config.client;

    let output = `### 👤 Client Profile

**${client.name}**
- Fitness Goal: ${this.formatGoal(client.primary_goal || "general_fitness")}
- Intensity Level: ${client.intensity}
- Muscle Targets: ${this.formatMuscleList(client.muscle_target)}
- Muscles to Lessen: ${this.formatMuscleList(client.muscle_lessen)}
- Joints to Avoid: ${this.formatJointList(client.avoid_joints)}`;

    if (
      client.exercise_requests?.include &&
      client.exercise_requests.include.length > 0
    ) {
      output += `\n- Requested Exercises: ${client.exercise_requests.include.join(", ")}`;
    }

    // Add pre-assigned exercises
    output +=
      "\n\n" +
      this.strategy.formatPreAssignedExercises(this.config.preAssigned);

    return output;
  }

  // Helper methods
  private formatGoal(goal: string): string {
    return goal.replace(/_/g, " ").toLowerCase();
  }

  private formatMuscleList(muscles?: string[]): string {
    if (!muscles || muscles.length === 0) return "none";
    return muscles.map((m) => m.replace(/_/g, " ")).join(", ");
  }

  private formatJointList(joints?: string[]): string {
    if (!joints || joints.length === 0) return "none";
    return joints.map((j) => j.replace(/_/g, " ")).join(", ");
  }

  private formatExerciseDetailsWithoutId(exercise: ScoredExercise): string {
    let details = `   - Movement: ${exercise.movementPattern}, Primary: ${exercise.primaryMuscle}\n`;
    if (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0) {
      details += `   - Secondary: ${exercise.secondaryMuscles.join(", ")}\n`;
    }
    details += `   - Equipment: ${exercise.equipment || "none"}\n`;
    details += `   - Score: ${exercise.score.toFixed(1)}`;
    return details;
  }

  private buildExerciseOptions(): string {
    let output = `### 📋 Available Exercise Options\n\n`;

    // List all candidates without shared/non-shared distinction
    this.config.candidates.forEach((ex, idx) => {
      output += `${idx + 1}. **${ex.name}**\n`;
      output += this.formatExerciseDetailsWithoutId(ex);
      output += "\n";
    });

    return output;
  }

  private buildOutputFormat(): string {
    const exercisesToSelect = this.getExercisesToSelect();

    return `### 📋 Output Format

Return a JSON object with exactly ${exercisesToSelect} selected exercises:

\`\`\`json
{
  "selectedExercises": [
    {
      "exerciseName": "3-Point Dumbbell Row",
      "reasoning": "Brief explanation of why this exercise was selected",
      "isShared": true,
      "satisfiesConstraints": ["muscle_target", "movement_variety"]
    }
  ],
  "summary": {
    "totalSelected": ${exercisesToSelect},
    "sharedExercises": 2,
    "muscleTargetsCovered": ["chest", "back"],
    "movementPatterns": ["push", "pull", "squat"],
    "overallReasoning": "Brief explanation of overall selection strategy"
  }
}
\`\`\`

**CRITICAL:**
- Select EXACTLY ${exercisesToSelect} exercises
- **Use the EXACT exercise name** from the list above
- Names are case-sensitive - copy them exactly as shown
- Do NOT modify or abbreviate exercise names
- Ensure all muscle targets are covered across selected + pre-assigned exercises`;
  }

  // Helper methods
  private formatWorkoutType(type: WorkoutType): string {
    return type.replace(/_/g, "_").toLowerCase();
  }
}
