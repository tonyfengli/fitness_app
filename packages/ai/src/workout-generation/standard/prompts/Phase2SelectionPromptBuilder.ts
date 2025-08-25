import { ExerciseWithTier } from '../../../types/exerciseTiers';
import { FixedAssignment, AllowedSlotsResult } from '../../../types/phase2Types';

interface CompactExerciseOption {
  id: string;
  client: string;
  allowed: number[];
  movementPattern: string;
  functionTag: string;
  primaryMuscle: string;
}

interface CompactPhase2Input {
  rounds: number;
  slotsRemaining: Record<string, number[]>;
  fixed: Array<[string, number, string]>; // [clientId, round, exerciseName]
  options: CompactExerciseOption[];
}

export class Phase2SelectionPromptBuilder {
  /**
   * Build the system prompt for Phase 2 exercise selection
   */
  buildSystemPrompt(): string {
    return `You are a fitness coach organizing remaining exercises into a group workout plan.

TASK: For each exercise in "options", select exactly ONE round from its "allowed" list.

HARD RULES:
1. Do not move or modify "fixed" exercises
2. Respect "slotsRemaining" - never exceed the available slots for any (client, round)
3. If a client has 2+ slots in a round, you MUST fill all slots to create a superset

PROGRAMMING PRINCIPLES:
1. Balance patterns across the session:
   - Aim for 1 each of push, pull/row, lower (squat/hinge if present), plus core/finisher
   - Avoid same pattern in adjacent rounds when alternatives exist

2. Place by function tag (fatigue management):
   - secondary_strength → earlier mid-session (R2-R3)
   - accessory → mid/late (R3-R4)
   - core/capacity → late (R4-R5)

3. Smart supersets (when round has 2+ slots):
   - Pair non-competing movements:
     * push ↔ pull/row
     * lower (squat/hinge) ↔ upper accessory or core
     * Avoid same muscle group pairings

PROCESS:
- Review fixed exercises and slot availability
- For each option in order, select the best available round considering:
  1. Function tag placement guidelines
  2. Pattern distribution
  3. Superset opportunities
  4. Client's other exercises

OUTPUT FORMAT:
Return a JSON object with:
1. "placements": array of [exercise_id, round_number] pairs
2. "roundNames": object mapping round numbers to creative 3-word names

Round naming guidelines:
- Maximum 3 words per name
- Reflect the focus/theme of ALL exercises in that round (both fixed and your selections)
- Be creative but professional (examples: "Hip Drive Flow", "Push Pull Power", "Core Stability Work")
- Consider movement patterns, muscle groups, and training intent

Example output:
{
  "placements": [["s_db_press", 2], ["s_row", 3], ["s_deadbug", 5]],
  "roundNames": {
    "1": "Heavy Hip Drive",
    "2": "Upper Body Power",
    "3": "Row Flow Series",
    "4": "Accessory Work",
    "5": "Core Finisher"
  }
}`;
  }

  /**
   * Transform preprocessing output to compact format for LLM
   */
  transformToCompactFormat(
    preprocessingResult: AllowedSlotsResult,
    exercises: ExerciseWithTier[],
    totalRounds: number
  ): CompactPhase2Input {
    // Build exercise lookup map
    const exerciseMap = new Map<string, ExerciseWithTier>();
    exercises.forEach(ex => {
      exerciseMap.set(`${ex.exerciseId}:${ex.clientId}`, ex);
    });

    // Transform fixed assignments to compact format
    const fixed: Array<[string, number, string]> = preprocessingResult.fixedAssignments.map(fa => {
      const exercise = exerciseMap.get(`${fa.exerciseId}:${fa.clientId}`);
      return [
        fa.clientId,
        fa.round,
        exercise?.name || fa.exerciseId
      ];
    });

    // Calculate slots remaining
    const slotsRemaining: Record<string, number[]> = {};
    
    // Get unique client IDs
    const clientIds = new Set<string>();
    exercises.forEach(ex => clientIds.add(ex.clientId));
    preprocessingResult.fixedAssignments.forEach(fa => clientIds.add(fa.clientId));
    
    // Initialize slots remaining for each client
    clientIds.forEach(clientId => {
      slotsRemaining[clientId] = Array(totalRounds).fill(0);
      
      // Calculate max slots per round (from bundle skeleton or default to 1)
      // This will be provided by the caller who has access to clientPlans
      // For now, we'll calculate based on what's used
      for (let r = 0; r < totalRounds; r++) {
        const maxSlots = this.inferMaxSlots(clientId, r + 1, exercises, preprocessingResult);
        const usedSlots = preprocessingResult.clientUsedSlots[clientId]?.[r] || 0;
        slotsRemaining[clientId][r] = maxSlots - usedSlots;
      }
    });

    // Transform exercise options
    const options: CompactExerciseOption[] = preprocessingResult.exerciseOptions.map(opt => {
      const exercise = exerciseMap.get(`${opt.exerciseId}:${opt.clientId}`);
      
      // Extract the primary function tag
      const functionTag = this.extractPrimaryFunctionTag(exercise?.functionTags || []);
      
      return {
        id: `${opt.clientId}_${exercise?.name?.toLowerCase().replace(/\s+/g, '_') || opt.exerciseId}`,
        client: opt.clientId,
        allowed: opt.allowedRounds,
        movementPattern: exercise?.movementPattern || 'unknown',
        functionTag: functionTag,
        primaryMuscle: exercise?.primaryMuscle || 'unknown'
      };
    });

    return {
      rounds: totalRounds,
      slotsRemaining,
      fixed,
      options
    };
  }

  /**
   * Extract the most relevant function tag for the LLM
   */
  private extractPrimaryFunctionTag(functionTags: string[]): string {
    // Priority order for function tags
    const priorityOrder = [
      'primary_strength',
      'secondary_strength',
      'accessory',
      'core',
      'capacity'
    ];

    for (const priority of priorityOrder) {
      if (functionTags.includes(priority)) {
        return priority;
      }
    }

    return 'accessory'; // Default fallback
  }

  /**
   * Infer max slots for a client in a round based on exercise distribution
   * This is a temporary solution until we have access to clientPlans
   */
  private inferMaxSlots(
    clientId: string,
    round: number,
    exercises: ExerciseWithTier[],
    preprocessingResult: AllowedSlotsResult
  ): number {
    // Count total exercises for this client
    const clientExercises = exercises.filter(ex => ex.clientId === clientId);
    const totalExercises = clientExercises.length;
    
    // Count how many rounds this client participates in
    const roundsWithExercises = new Set<number>();
    
    // Check fixed assignments
    preprocessingResult.fixedAssignments
      .filter(fa => fa.clientId === clientId)
      .forEach(fa => roundsWithExercises.add(fa.round));
    
    // Check exercise options
    preprocessingResult.exerciseOptions
      .filter(opt => opt.clientId === clientId)
      .forEach(opt => {
        opt.allowedRounds.forEach(r => roundsWithExercises.add(r));
      });
    
    const totalRoundsParticipating = Math.max(roundsWithExercises.size, 1);
    
    // Simple heuristic: if exercises > rounds, some rounds need supersets
    if (totalExercises > totalRoundsParticipating) {
      // For now, assume max 2 per round (supersets)
      // More sophisticated logic would use actual bundle skeleton
      return 2;
    }
    
    return 1;
  }

  /**
   * Build the human message with the compact input
   */
  buildHumanMessage(compactInput: CompactPhase2Input): string {
    return `Select rounds for the following exercises:

${JSON.stringify(compactInput, null, 2)}

Remember to:
1. Respect slots remaining per client per round
2. Create balanced movement patterns
3. Follow function tag placement guidelines
4. Fill all slots when a round has 2+ available (supersets)`;
  }
}