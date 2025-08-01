/**
 * Prompt builder for Phase 2: Round Organization
 */

import type { ExerciseSelection } from "../types";
import type { WorkoutTemplate } from "../../../core/templates/types/dynamicBlockTypes";

export class RoundOrganizationPromptBuilder {
  private exerciseSelection: ExerciseSelection;
  private template: WorkoutTemplate;
  private equipment: string[];
  
  constructor(
    exerciseSelection: ExerciseSelection, 
    template: WorkoutTemplate,
    equipment?: string[]
  ) {
    this.exerciseSelection = exerciseSelection;
    this.template = template;
    this.equipment = equipment || this.getDefaultEquipment();
  }
  
  build(): string {
    const sections = [
      this.buildHeader(),
      this.buildContext(),
      this.buildConstraints(),
      this.buildRoundStructure(),
      this.buildExerciseList(),
      this.buildOutputFormat()
    ];
    
    return sections.join('\n\n');
  }
  
  private buildHeader(): string {
    const clientCount = Object.keys(this.exerciseSelection.clientSelections).length;
    
    return `## 🏋️ BMF Round Organization System

You are organizing the selected exercises into a structured workout with specific rounds, sets, and reps. You have ${clientCount} clients with their assigned exercises that need to be organized into an effective group workout flow.`;
  }
  
  private buildContext(): string {
    const flow = this.template.metadata?.workoutFlow || 'strength-metabolic';
    const totalExercises = this.template.metadata?.totalExercisesPerClient || 8;
    
    return `### 📋 Context

**Workout Type:** ${flow === 'pure-strength' ? 'Pure Strength Focus' : 'Strength → Metabolic'}
**Duration:** 45-50 minutes
**Exercises per client:** ${totalExercises}
**Equipment Available:** ${this.equipment.join(', ')}

The exercises have already been selected based on client needs and preferences. Your task is to organize them into rounds that create an effective workout flow while managing equipment and timing.`;
  }
  
  private buildConstraints(): string {
    return `### ⚠️ Constraints

1. **Round Structure:**
   - 4 rounds total (matching pre-assigned rounds + 2 additional)
   - Each round should have a clear focus/theme
   - Rounds should progress logically (strength → metabolic or maintain strength focus)

2. **Timing:**
   - Total workout: 45-50 minutes
   - Include appropriate rest between sets
   - Consider setup/transition time between exercises

3. **Equipment Management:**
   - Minimize equipment conflicts (clients shouldn't need same equipment simultaneously)
   - Group exercises by equipment when possible
   - Consider equipment setup/breakdown time

4. **Sets & Reps:**
   - Match the workout flow (strength = lower reps, metabolic = higher reps)
   - Adjust volume based on exercise difficulty
   - Consider client intensity preferences

5. **Shared Exercises:**
   - Clients doing the same exercise should do it in the same round
   - Can have different set/rep schemes based on fitness level`;
  }
  
  private buildRoundStructure(): string {
    const flow = this.template.metadata?.workoutFlow || 'strength-metabolic';
    
    if (flow === 'pure-strength') {
      return `### 🔄 Round Structure (Pure Strength)

**Round 1: Lower Body Power** (Pre-assigned)
- Focus: Primary lower body strength
- Sets/Reps: 3-4 sets x 5-8 reps
- Rest: 90-120s between sets

**Round 2: Upper Body Pull** (Pre-assigned)
- Focus: Pulling strength
- Sets/Reps: 3-4 sets x 6-10 reps
- Rest: 75-90s between sets

**Round 3: Upper Body Push**
- Focus: Pressing/pushing movements
- Sets/Reps: 3-4 sets x 6-10 reps
- Rest: 75-90s between sets

**Round 4: Accessory & Core**
- Focus: Targeted strength work
- Sets/Reps: 3 sets x 8-12 reps
- Rest: 60-75s between sets`;
    }
    
    // Default: strength-metabolic
    return `### 🔄 Round Structure (Strength → Metabolic)

**Round 1: Lower Body Strength** (Pre-assigned)
- Focus: Primary lower body strength
- Sets/Reps: 3-4 sets x 6-10 reps
- Rest: 75-90s between sets

**Round 2: Upper Body Pull** (Pre-assigned)
- Focus: Pulling strength
- Sets/Reps: 3-4 sets x 8-12 reps
- Rest: 60-75s between sets

**Round 3: Strength Circuit**
- Focus: Compound movements, moderate intensity
- Sets/Reps: 3 sets x 10-15 reps
- Rest: 60s between sets

**Round 4: Metabolic Finisher**
- Focus: Higher intensity, conditioning
- Sets/Reps: 2-3 sets x 15-20 reps or time-based
- Rest: 45-60s between sets`;
  }
  
  private buildExerciseList(): string {
    let output = '### 💪 Exercises to Organize\n\n';
    
    // List shared exercises first
    output += '**Shared Exercises:**\n';
    for (const shared of this.exerciseSelection.sharedExercises) {
      const clients = shared.clientIds.map(id => 
        this.exerciseSelection.clientSelections[id]?.clientName || id
      ).join(', ');
      output += `- ${shared.exerciseName} (Clients: ${clients})\n`;
    }
    
    output += '\n**Individual Exercises by Client:**\n\n';
    
    // List each client's exercises
    for (const [clientId, selection] of Object.entries(this.exerciseSelection.clientSelections)) {
      output += `**${selection.clientName}:**\n`;
      
      // Pre-assigned (already in rounds 1-2)
      output += 'Pre-assigned (Rounds 1-2):\n';
      for (const exercise of selection.preAssigned) {
        output += `- ${exercise.exerciseName} (${exercise.source})\n`;
      }
      
      // Selected exercises to be organized
      output += 'To be organized (Rounds 3-4):\n';
      for (const exercise of selection.selected) {
        const shared = exercise.isShared ? ' [SHARED]' : '';
        output += `- ${exercise.exerciseName}${shared}\n`;
      }
      output += '\n';
    }
    
    return output;
  }
  
  private buildOutputFormat(): string {
    return `### 📋 Output Format

Return a JSON object with this structure:

\`\`\`json
{
  "rounds": [
    {
      "id": "Round1",
      "name": "Round 1: Lower Body Strength",
      "focus": "Primary lower body strength",
      "exercises": {
        "[clientId]": [
          {
            "exerciseId": "uuid",
            "exerciseName": "Barbell Back Squat",
            "sets": 4,
            "reps": "6-8",
            "restBetweenSets": "90s",
            "equipment": ["barbell", "squat rack"],
            "notes": "Focus on controlled tempo"
          }
        ]
      },
      "roundDuration": "12 min",
      "equipmentRotation": [
        {
          "station": 1,
          "equipment": "squat rack",
          "clientRotation": [["client1"], ["client2"], ["client3"]]
        }
      ]
    }
  ],
  "workoutSummary": {
    "totalDuration": "48 min",
    "equipmentNeeded": ["barbell", "dumbbells", "bench", "pull-up bar"],
    "flowDescription": "Progressive workout starting with heavy strength work and transitioning to metabolic conditioning"
  },
  "organizationReasoning": "Exercises organized to minimize equipment conflicts while maintaining workout flow..."
}
\`\`\``;
  }
  
  private getDefaultEquipment(): string[] {
    return [
      'barbell',
      'dumbbells',
      'kettlebells',
      'bench',
      'squat rack',
      'pull-up bar',
      'cables',
      'bands',
      'medicine ball',
      'floor space'
    ];
  }
}