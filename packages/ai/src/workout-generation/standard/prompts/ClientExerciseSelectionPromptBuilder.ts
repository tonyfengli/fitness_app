/**
 * Builds exercise selection prompts for individual clients
 * Adapts content based on workout type and intensity
 */

import type { ClientContext } from "../../../types/clientContext";
import type { ScoredExercise } from "../../../types/scoredExercise";
import type { PreAssignedExercise } from "../../../types/standardBlueprint";
import type { GroupScoredExercise } from "../../../types/groupContext";
import { WorkoutType } from "../../types/workoutTypes";
import type { PromptStrategy } from "./strategies/PromptStrategy";
import { FullBodyPromptStrategy } from "./strategies/FullBodyPromptStrategy";

export interface ClientPromptConfig {
  client: ClientContext;
  workoutType: WorkoutType;
  preAssigned: PreAssignedExercise[];
  candidates: ScoredExercise[];  // The 15 bucketed candidates
  sharedExercises: GroupScoredExercise[];  // Shared pool info
  otherClientsInfo: Array<{  // Basic info about other clients for context
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
      this.config.preAssigned.length
    );
    
    const strategyConfig = {
      workoutType: this.config.workoutType,
      intensity: this.config.client.intensity,
      totalExercisesNeeded: this.config.preAssigned.length + exercisesToSelect,
      exercisesToSelect
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
  private getExercisesToSelectForIntensity(intensity?: 'low' | 'moderate' | 'high' | 'intense', preAssignedCount: number = 2): number {
    const totalExercises = this.getTotalExercisesForIntensity(intensity);
    return totalExercises - preAssignedCount;
  }
  
  private getTotalExercisesForIntensity(intensity?: 'low' | 'moderate' | 'high' | 'intense'): number {
    switch (intensity) {
      case 'low':
        return 4;
      case 'moderate':
        return 5;
      case 'high':
        return 6;
      case 'intense':
        return 7;
      default:
        return 5;  // Default to moderate
    }
  }
  
  private getExercisesToSelect(): number {
    // Use the already calculated value from strategy config
    return this.getExercisesToSelectForIntensity(
      this.config.client.intensity,
      this.config.preAssigned.length
    );
  }
  
  build(): string {
    const sections = [
      this.buildHeader(),
      this.buildClientContext(),
      this.strategy.buildConstraints(),
      this.strategy.buildWorkoutFlow(),
      this.strategy.buildSelectionPriorities(),
      this.buildExerciseOptions(),
      this.buildOutputFormat()
    ];
    
    return sections.join('\n\n');
  }
  
  private buildHeader(): string {
    const exercisesToSelect = this.getExercisesToSelect();
    
    return `## 💪 Exercise Selection for ${this.config.client.name}

You are selecting ${exercisesToSelect} exercises from a curated list of ${this.config.candidates.length} options. These exercises will complement ${this.config.preAssigned.length} pre-assigned exercises to create a complete workout.

**Workout Type:** ${this.formatWorkoutType(this.config.workoutType)}
**Intensity:** ${this.config.client.intensity}
**Total Exercises Needed:** ${this.config.preAssigned.length + exercisesToSelect}`;
  }
  
  private buildClientContext(): string {
    const client = this.config.client;
    
    let output = `### 👤 Client Profile

**${client.name}**
- Fitness Goal: ${this.formatGoal(client.primary_goal || 'general_fitness')}
- Intensity Level: ${client.intensity}
- Muscle Targets: ${this.formatMuscleList(client.muscle_target)}
- Muscles to Lessen: ${this.formatMuscleList(client.muscle_lessen)}
- Joints to Avoid: ${this.formatJointList(client.avoid_joints)}`;
    
    if (client.exercise_requests?.include && client.exercise_requests.include.length > 0) {
      output += `\n- Requested Exercises: ${client.exercise_requests.include.join(', ')}`;
    }
    
    // Add pre-assigned exercises
    output += '\n\n' + this.strategy.formatPreAssignedExercises(this.config.preAssigned);
    
    return output;
  }
  
  private buildExerciseOptions(): string {
    let output = `### 📋 Available Exercise Options\n\n`;
    
    // List all candidates without shared/non-shared distinction
    this.config.candidates.forEach((ex, idx) => {
      output += `${idx + 1}. **${ex.name}**\n`;
      output += this.formatExerciseDetailsWithoutId(ex);
      output += '\n';
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
  private identifySharedExercises(): ScoredExercise[] {
    const sharedIds = new Set(this.config.sharedExercises.map(s => s.id));
    return this.config.candidates.filter(ex => sharedIds.has(ex.id));
  }
  
  private formatExerciseDetails(ex: ScoredExercise): string {
    let details = `   - ID: ${ex.id}\n`;
    details += `   - Movement: ${ex.movementPattern}, Primary: ${ex.primaryMuscle}\n`;
    details += `   - Score: ${ex.score.toFixed(1)}`;
    
    if (ex.scoreBreakdown) {
      const factors = this.formatScoreFactors(ex.scoreBreakdown);
      if (factors) {
        details += ` (${factors})`;
      }
    }
    
    if (ex.functionTags && ex.functionTags.length > 0) {
      details += `\n   - Tags: ${ex.functionTags.join(', ')}`;
    }
    
    return details;
  }
  
  private formatExerciseDetailsWithoutId(ex: ScoredExercise): string {
    let details = `   - Movement: ${ex.movementPattern}, Primary: ${ex.primaryMuscle}\n`;
    details += `   - Score: ${ex.score.toFixed(1)}`;
    
    if (ex.scoreBreakdown) {
      const factors = this.formatScoreFactors(ex.scoreBreakdown);
      if (factors) {
        details += ` (${factors})`;
      }
    }
    
    if (ex.functionTags && ex.functionTags.length > 0) {
      details += `\n   - Tags: ${ex.functionTags.join(', ')}`;
    }
    
    return details;
  }
  
  private formatScoreFactors(breakdown: any): string {
    const factors: string[] = [];
    
    if (breakdown.muscleTargetBonus > 0) {
      factors.push(`targets muscle +${breakdown.muscleTargetBonus.toFixed(1)}`);
    }
    
    if (breakdown.muscleLessenPenalty < 0) {
      factors.push(`lessens muscle ${breakdown.muscleLessenPenalty.toFixed(1)}`);
    }
    
    if (breakdown.intensityAdjustment !== 0) {
      const sign = breakdown.intensityAdjustment > 0 ? '+' : '';
      factors.push(`intensity ${sign}${breakdown.intensityAdjustment.toFixed(1)}`);
    }
    
    return factors.join(', ');
  }
  
  private formatWorkoutType(type: WorkoutType): string {
    return type.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  private formatGoal(goal: string): string {
    return goal.replace(/_/g, ' ').toLowerCase();
  }
  
  private formatMuscleList(muscles?: string[]): string {
    if (!muscles || muscles.length === 0) return 'none';
    return muscles.map(m => m.replace(/_/g, ' ')).join(', ');
  }
  
  private formatJointList(joints?: string[]): string {
    if (!joints || joints.length === 0) return 'none';
    return joints.join(', ');
  }
}