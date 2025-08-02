/**
 * Prompt builder for Phase 1: Exercise Selection
 */

import type { StandardGroupWorkoutBlueprint } from "../../../types/standardBlueprint";
import type { GroupContext, ClientContext } from "../../../types/groupContext";
import type { GroupScoredExercise } from "../../../types/groupContext";
import type { ScoredExercise } from "../../../types/scoredExercise";
import { WorkoutType } from "../../types/workoutTypes";

export class ExerciseSelectionPromptBuilder {
  private blueprint: StandardGroupWorkoutBlueprint;
  private groupContext: GroupContext;
  private workoutType: WorkoutType;
  
  constructor(
    blueprint: StandardGroupWorkoutBlueprint, 
    groupContext: GroupContext,
    workoutType?: WorkoutType
  ) {
    this.blueprint = blueprint;
    this.groupContext = groupContext;
    // Default to full body with finisher if not specified
    this.workoutType = workoutType || WorkoutType.FULL_BODY_WITH_FINISHER;
  }
  
  build(): string {
    const sections = [
      this.buildHeader(),
      this.buildGoal(),
      this.buildMustFollowConstraints(),
      this.buildSoftPriorities(),
      this.buildWorkoutFlow(),
      this.buildClientProfiles(),
      this.buildAvailableExercises(),
      this.buildOutputFormat()
    ];
    
    return sections.join('\n\n');
  }
  
  private buildHeader(): string {
    const clientCount = this.groupContext.clients.length;
    return `## 💪 BMF Exercise Selection System

You are a group fitness coordinator selecting exercises for a small group workout with ${clientCount} clients. Each client already has 2 pre-assigned exercises. Your task is to choose additional exercises for each client so they end up with a balanced and effective full-body workout.`;
  }
  
  private buildGoal(): string {
    const totalExercises = this.blueprint.metadata.totalExercisesPerClient;
    const preAssigned = this.blueprint.metadata.preAssignedCount;
    const additional = totalExercises - preAssigned;
    
    if (preAssigned > 0) {
      return `### 🎯 Your Goal

For each client:
- Provide a complete exercise list based on their specified total (${totalExercises} exercises)
- ${preAssigned} are already pre-assigned (do not change or repeat them)
- Select ${additional} additional exercises
- Focus on exercise quality, movement variety, and group cohesion`;
    } else {
      return `### 🎯 Your Goal

For each client:
- Select ${totalExercises} exercises total
- Focus on exercise quality, movement variety, and group cohesion
- Ensure balanced programming across all muscle groups`;
    }
  }
  
  private buildMustFollowConstraints(): string {
    return `### ✅ MUST Follow (Hard Constraints)

1. **Preserve all pre-assigned exercises** (include them in final output)
2. **Each client must have at least 1 shared exercise** in their final list
   - A pre-assigned exercise may fulfill this requirement
3. **All muscle targets must be covered**
   - Assign at least 1 exercise that trains each target muscle
   - Pre-assigned exercises may already satisfy this requirement
   - Consider assigning multiple exercises for important targets when possible
4. **Avoid all "lessen" muscles**
   - Never assign exercises that significantly recruit the muscle groups the client wants to avoid
5. **Do not assign duplicate exercises** (already assigned or repeated within the client's list)`;
  }
  
  private buildSoftPriorities(): string {
    return `### ⚖️ Prefer (Soft Priorities)

Priority order:
1. Hard constraints (muscle targets, lessen muscles, no duplicates)
2. Movement variety (prefer different movement patterns over multiple exercises from the same pattern)
3. Exercise scores (optimize for highest individual scores within the above constraints)

Additional preferences:
- Muscle group balance: If no target specified, build well-rounded selection
- Favor shared exercises when multiple clients have high compatibility

Example Scenario:
Client has "chest" as muscle target and pre-assigned exercises are squat + pull.
✅ Include 1-2 chest exercises (aim for 2 when possible to thoroughly address the target)
✅ Try to include different patterns like push, core, or hinge
❌ NOT select 3 chest exercises just because they score highest`;
  }
  
  private buildWorkoutFlow(): string {
    const flow = this.blueprint.metadata.workoutFlow;
    
    if (flow === 'pure-strength') {
      return `### 🏃 Workout Flow

**Pure Strength Focus**

"workoutFlow": {
  "structure": "Full-body strength-focused workout with progressive loading",
  "exerciseRoles": [
    "2 pre-assigned: lower body and pull (completed)",
    "Need 1-2: primary pushing/pressing movements (upper body balance)",
    "Need 1-2: accessory strength work (isolation or compound variations)"
  ],
  "guidance": "Select exercises that complement the pre-assigned work and build comprehensive strength across all muscle groups. Consider including core stability work."
}`;
    }
    
    // Default: strength-metabolic
    return `### 🏃 Workout Flow

**Strength → Metabolic**

"workoutFlow": {
  "structure": "Full-body workout progressing from strength to metabolic",
  "exerciseRoles": [
    "2 pre-assigned: lower body and pull (completed)",
    "Need 1-2: primary strength work (compound movements, heavier loads)",
    "Need 1-2: conditioning/metabolic finishers (higher rep, cardio effect)"
  ],
  "guidance": "Select exercises that create a natural progression from strength-focused to metabolic-focused work. Aim to include at least one core-focused exercise."
}`;
  }
  
  private buildClientProfiles(): string {
    let profiles = '### 👥 Client Profiles\n\n';
    
    for (const client of this.groupContext.clients) {
      const pool = this.blueprint.clientExercisePools[client.user_id];
      if (!pool) continue; // Skip if no pool for this client
      
      profiles += `**${client.name}**\n`;
      profiles += `- Fitness Goal: ${this.formatGoal(client.primary_goal || 'general_fitness')}\n`;
      profiles += `- Intensity: ${client.intensity}\n`;
      profiles += `- Muscle Targets: ${this.formatMuscleList(client.muscle_target)}\n`;
      profiles += `- Muscle Lessen: ${this.formatMuscleList(client.muscle_lessen)}\n`;
      profiles += `- Joints to Avoid: ${this.formatJointList(client.avoid_joints)}\n`;
      profiles += `- Total Exercises Needed: ${pool.totalExercisesNeeded}`;
      
      if (pool.preAssigned.length > 0) {
        profiles += ` (${pool.preAssigned.length} pre-assigned)\n`;
        profiles += `- Pre-assigned Exercises:\n`;
        
        for (const preAssigned of pool.preAssigned) {
          const ex = preAssigned.exercise;
          profiles += `  - ${ex.name} (${ex.movementPattern}, primary: ${this.formatMuscle(ex.primaryMuscle)})\n`;
        }
      } else {
        profiles += '\n';
      }
      
      profiles += '\n';
    }
    
    return profiles;
  }
  
  private buildAvailableExercises(): string {
    let output = '### 📋 Available Exercises\n\n';
    
    // Scoring explanation
    output += `📊 **Scoring System**

Each exercise has a score (0-10) indicating fit for that client. Scores start at 5.0 (neutral) and adjust based on muscle targets (+3.0), muscle lessens (-3.0), client requests (+2.0), skill/intensity match, and other factors shown in the score breakdown.\n\n`;
    
    // Shared exercises
    output += `🤝 **Shared Exercise Guidance**

- Shared exercises are pre-filtered for quality (all clients score ≥5.0)
- Exercises shared by more clients are generally preferred
- Higher group scores indicate better overall fit
- You may assign the same shared exercise to 2-3 clients while others do different exercises\n\n`;
    
    output += '**Shared Exercise Options:**\n\n';
    
    // Group shared exercises by client count
    const sharedByCount = this.groupSharedExercisesByClientCount();
    
    for (const [count, exercises] of sharedByCount) {
      if (exercises.length === 0) continue;
      
      output += `_Can be done by ${count} clients:_\n`;
      
      exercises.slice(0, 15).forEach((ex, idx) => {
        output += `${idx + 1}. **${ex.name}** (group score: ${ex.groupScore.toFixed(1)})\n`;
        output += `   - Movement: ${ex.movementPattern}, Primary: ${this.formatMuscle(ex.primaryMuscle)}\n`;
        output += `   - Can do: ${ex.clientsSharing.map(id => this.getClientName(id)).join(', ')}\n\n`;
      });
    }
    
    // Individual exercises per client
    output += '\n**Individual Exercise Options:**\n\n';
    
    for (const client of this.groupContext.clients) {
      const pool = this.blueprint.clientExercisePools[client.user_id];
      if (!pool) continue; // Skip if no pool for this client
      
      output += `**${client.name}:**\n\n`;
      
      // Show top available exercises
      const topExercises = pool.availableCandidates.slice(0, 15);
      
      topExercises.forEach((ex, idx) => {
        output += `${idx + 1}. ${ex.name} (${ex.score.toFixed(1)})\n`;
        output += `   - Movement: ${ex.movementPattern}, Primary: ${this.formatMuscle(ex.primaryMuscle)}\n`;
        
        if (ex.scoreBreakdown) {
          const factors = this.formatScoreFactors(ex.scoreBreakdown);
          if (factors) {
            output += `   - Score factors: ${factors}\n`;
          }
        }
        output += '\n';
      });
      
      // Add summary of available exercises
      output += `_Showing top ${topExercises.length} of ${pool.availableCandidates.length} available exercises_\n`;
      
      output += '\n';
    }
    
    return output;
  }
  
  private buildOutputFormat(): string {
    return `### 📋 Output Format

Return a JSON object with this structure:

\`\`\`json
{
  "clientSelections": {
    "[clientId]": {
      "clientName": "Tony",
      "preAssigned": [
        {
          "exerciseId": "uuid",
          "exerciseName": "Barbell Back Squat",
          "movementPattern": "squat",
          "primaryMuscle": "glutes",
          "source": "Round1"
        }
      ],
      "selected": [
        {
          "exerciseId": "uuid",
          "exerciseName": "Barbell Bench Press",
          "movementPattern": "horizontal_push",
          "primaryMuscle": "chest",
          "score": 8.5,
          "isShared": true,
          "sharedWith": ["client2-id"]
        }
      ],
      "totalExercises": 8
    }
  },
  "sharedExercises": [
    {
      "exerciseId": "uuid",
      "exerciseName": "Barbell Bench Press",
      "clientIds": ["client1-id", "client2-id"],
      "averageScore": 7.8
    }
  ],
  "selectionReasoning": "Brief explanation of overall selection strategy"
}
\`\`\``;
  }
  
  // Helper methods
  private formatGoal(goal: string): string {
    return goal.replace(/_/g, ' ').toLowerCase();
  }
  
  private formatMuscle(muscle: string): string {
    return muscle.replace(/_/g, ' ');
  }
  
  private formatMuscleList(muscles?: string[]): string {
    if (!muscles || muscles.length === 0) return 'none';
    return muscles.map(m => this.formatMuscle(m)).join(', ');
  }
  
  private formatJointList(joints?: string[]): string {
    if (!joints || joints.length === 0) return 'none';
    return joints.join(', ');
  }
  
  private getClientName(clientId: string): string {
    const client = this.groupContext.clients.find(c => c.user_id === clientId);
    return client?.name || clientId;
  }
  
  private groupSharedExercisesByClientCount(): Map<number, GroupScoredExercise[]> {
    const grouped = new Map<number, GroupScoredExercise[]>();
    
    // Initialize groups
    for (let i = 2; i <= this.groupContext.clients.length; i++) {
      grouped.set(i, []);
    }
    
    // Group exercises
    for (const exercise of this.blueprint.sharedExercisePool) {
      const count = exercise.clientsSharing.length;
      const group = grouped.get(count) || [];
      group.push(exercise);
      grouped.set(count, group);
    }
    
    // Sort each group by score
    for (const [count, exercises] of grouped) {
      exercises.sort((a, b) => b.groupScore - a.groupScore);
    }
    
    return grouped;
  }
  
  private formatScoreFactors(breakdown: any): string {
    const factors: string[] = [];
    
    if (breakdown.includeExerciseBoost > 0) {
      factors.push(`client requested (+${breakdown.includeExerciseBoost.toFixed(1)})`);
    }
    
    if (breakdown.muscleTargetBonus > 0) {
      const isPrimary = breakdown.muscleTargetBonus >= 3.0;
      factors.push(`targets muscle${isPrimary ? '' : ' (secondary)'} (+${breakdown.muscleTargetBonus.toFixed(1)})`);
    }
    
    if (breakdown.muscleLessenPenalty < 0) {
      factors.push(`lessens muscle (${breakdown.muscleLessenPenalty.toFixed(1)})`);
    }
    
    if (breakdown.intensityAdjustment !== 0) {
      const sign = breakdown.intensityAdjustment > 0 ? '+' : '';
      factors.push(`intensity match (${sign}${breakdown.intensityAdjustment.toFixed(1)})`);
    }
    
    return factors.join(', ');
  }
}