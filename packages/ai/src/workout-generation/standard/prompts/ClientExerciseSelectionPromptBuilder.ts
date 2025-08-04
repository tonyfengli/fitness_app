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
    const exercisesToSelect = this.getExercisesToSelect();
    
    const strategyConfig = {
      workoutType: this.config.workoutType,
      intensity: this.config.client.intensity,
      totalExercisesNeeded: this.config.preAssigned.length + exercisesToSelect,
      exercisesToSelect
    };
    
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
  
  private getExercisesToSelect(): number {
    return this.strategy.getExercisesToSelect(this.config.client.intensity);
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
    
    // Add group context
    if (this.config.otherClientsInfo.length > 0) {
      output += '\n### 👥 Group Context\n\n';
      output += 'Other clients in this session:\n';
      this.config.otherClientsInfo.forEach(other => {
        output += `- ${other.name}: targets ${this.formatMuscleList(other.muscleTargets)}\n`;
      });
    }
    
    return output;
  }
  
  private buildExerciseOptions(): string {
    let output = `### 📋 Available Exercise Options

You must select ${this.getExercisesToSelect()} exercises from the following ${this.config.candidates.length} options:\n\n`;
    
    // First, show shared exercises if any
    const sharedInCandidates = this.identifySharedExercises();
    if (sharedInCandidates.length > 0) {
      output += '**🤝 Shared Exercise Options (prefer these when constraints allow):**\n\n';
      
      sharedInCandidates.forEach((ex, idx) => {
        const sharedInfo = this.config.sharedExercises.find(s => s.id === ex.id);
        output += `${idx + 1}. **${ex.name}** [SHARED with ${sharedInfo?.clientsSharing.length || 0} clients]\n`;
        output += this.formatExerciseDetails(ex);
        output += '\n';
      });
      
      output += '\n';
    }
    
    // Then show non-shared exercises
    const nonShared = this.config.candidates.filter(ex => 
      !sharedInCandidates.some(s => s.id === ex.id)
    );
    
    if (nonShared.length > 0) {
      output += '**💪 Individual Exercise Options:**\n\n';
      
      nonShared.forEach((ex, idx) => {
        output += `${sharedInCandidates.length + idx + 1}. ${ex.name}\n`;
        output += this.formatExerciseDetails(ex);
        output += '\n';
      });
    }
    
    // Add shared exercise guidance
    output += '\n' + this.strategy.buildSharedExerciseGuidance(this.config.sharedExercises);
    
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
      "exerciseId": "uuid-here",
      "exerciseName": "Exercise Name",
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

**Important:**
- Select EXACTLY ${exercisesToSelect} exercises
- Use the exact exercise IDs from the provided options
- Prefer shared exercises when they meet constraints
- Ensure all muscle targets are covered across selected + pre-assigned exercises`;
  }
  
  // Helper methods
  private identifySharedExercises(): ScoredExercise[] {
    const sharedIds = new Set(this.config.sharedExercises.map(s => s.id));
    return this.config.candidates.filter(ex => sharedIds.has(ex.id));
  }
  
  private formatExerciseDetails(ex: ScoredExercise): string {
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