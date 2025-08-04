/**
 * Prompt strategy for Full Body workouts (with and without finisher)
 */

import type { PromptStrategy, PromptStrategyConfig } from "./PromptStrategy";
import type { PreAssignedExercise } from "../../../../types/standardBlueprint";
import type { GroupScoredExercise } from "../../../../types/groupContext";
import { WorkoutType } from "../../../types/workoutTypes";

export class FullBodyPromptStrategy implements PromptStrategy {
  constructor(private config: PromptStrategyConfig) {}
  
  buildConstraints(): string {
    const withFinisher = this.config.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER;
    
    return `### ✅ MUST Follow (Hard Constraints)

1. **Movement Pattern Coverage**
   - Ensure variety across different movement patterns
   - ${withFinisher ? 'Include at least one high-intensity finisher exercise' : 'Focus on balanced strength movements'}
   - Avoid selecting multiple exercises from the same movement pattern unless targeting specific muscles

2. **Muscle Target Requirements**
   - MUST include exercises for all specified muscle targets
   - If a muscle is targeted, select 1-2 exercises that primarily work that muscle
   - Consider compound movements that hit multiple targets efficiently

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
    const withFinisher = this.config.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER;
    
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
- Include 2 core-focused exercises (vs 1 in with-finisher variant)
- Focus on strength and muscle building
- No specific conditioning requirement
- Ensure balanced coverage of all muscle groups`;
  }
  
  buildSelectionPriorities(): string {
    return `### ⚖️ Selection Priorities

1. **Shared Exercises** (Highest Priority)
   - Prefer exercises marked as shared when they fit constraints
   - Shared exercises enhance group cohesion and coaching efficiency
   - Only skip shared options if they violate hard constraints

2. **Movement Variety**
   - Distribute selections across different movement patterns
   - Avoid clustering (e.g., 3 pushing exercises)
   
3. **Score Optimization**
   - Among valid options, prefer higher-scoring exercises
   - Scores already factor in client preferences and capabilities
   
4. **Training Effect**
   - Consider exercise complexity and training stimulus
   - Mix bilateral and unilateral movements when appropriate`;
  }
  
  getExercisesToSelect(intensity: 'low' | 'moderate' | 'high'): number {
    // Adjust selection count based on intensity
    // Low: fewer exercises (more rest/recovery)
    // High: more exercises (higher volume)
    switch (intensity) {
      case 'low':
        return 3;  // 2 pre-assigned + 3 = 5 total (lighter day)
      case 'moderate':
        return 4;  // 2 pre-assigned + 4 = 6 total (standard)
      case 'high':
        return 5;  // 2 pre-assigned + 5 = 7 total (higher volume)
      default:
        return 4;
    }
  }
  
  formatPreAssignedExercises(preAssigned: PreAssignedExercise[]): string {
    if (preAssigned.length === 0) return "No pre-assigned exercises";
    
    let output = "Pre-assigned exercises (DO NOT select these again):\n";
    
    preAssigned.forEach((pa, idx) => {
      const ex = pa.exercise;
      output += `${idx + 1}. **${ex.name}**\n`;
      output += `   - Movement: ${ex.movementPattern}, Primary: ${ex.primaryMuscle}\n`;
      output += `   - Source: ${pa.source}`;
      if (pa.tiedCount) {
        output += ` (selected from ${pa.tiedCount} tied options)`;
      }
      output += '\n\n';
    });
    
    return output;
  }
  
  buildSharedExerciseGuidance(sharedExercises: GroupScoredExercise[]): string {
    if (sharedExercises.length === 0) {
      return "No shared exercises available for this group.";
    }
    
    let output = `### 🤝 Shared Exercise Opportunities

**Why Shared Exercises Matter:**
- Enhance group cohesion and camaraderie
- Simplify coaching and cueing
- Create competitive/collaborative moments
- All shared exercises are pre-validated for quality (score ≥ 5.0 for all applicable clients)

**Available Shared Exercises:**\n\n`;
    
    // Group by number of clients who can do them
    const byClientCount = new Map<number, GroupScoredExercise[]>();
    
    sharedExercises.forEach(ex => {
      const count = ex.clientsSharing.length;
      if (!byClientCount.has(count)) {
        byClientCount.set(count, []);
      }
      byClientCount.get(count)!.push(ex);
    });
    
    // Sort by client count (descending)
    const sortedCounts = Array.from(byClientCount.keys()).sort((a, b) => b - a);
    
    sortedCounts.forEach(count => {
      const exercises = byClientCount.get(count)!;
      output += `**Shared by ${count} clients:**\n`;
      
      exercises.slice(0, 5).forEach(ex => {
        output += `- ${ex.name} (group score: ${ex.groupScore.toFixed(1)})\n`;
      });
      
      if (exercises.length > 5) {
        output += `  _...and ${exercises.length - 5} more_\n`;
      }
      output += '\n';
    });
    
    return output;
  }
}