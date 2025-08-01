import type { exercises } from "@acme/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Exercise = InferSelectModel<typeof exercises>;

/**
 * LLM output format - what the LLM generates
 */
export type LLMWorkoutOutput = {
  [blockKey: string]: Array<{
    exercise: string;
    sets: number;
    reps?: string;
    rest?: string;
    notes?: string;
  }>;
} & {
  reasoning?: string;
}

/**
 * Database format - what we need to save
 */
export interface WorkoutDBFormat {
  workout: {
    name: string;
    description?: string;
    workoutType: string;
    totalPlannedSets: number;
    llmOutput: LLMWorkoutOutput;
    templateConfig?: Record<string, any>;
  };
  exercises: Array<{
    exerciseId: string;
    exerciseName: string; // For fallback/reference
    sets: number;
    reps?: string;
    restPeriod?: string;
    notes?: string;
    orderIndex: number;
    groupName: string; // "Block A", "Round 1", etc.
  }>;
}

/**
 * Transform LLM output to database format
 */
export async function transformLLMOutputToDB(
  llmOutput: LLMWorkoutOutput,
  exerciseLookup: Map<string, Exercise>,
  templateType: string = 'standard',
  workoutName?: string,
  workoutDescription?: string
): Promise<WorkoutDBFormat> {
  const exercises: WorkoutDBFormat['exercises'] = [];
  let totalSets = 0;
  let orderIndex = 0;

  // Process each block/round in the LLM output
  for (const [blockKey, blockExercises] of Object.entries(llmOutput)) {
    // Skip non-exercise keys like 'reasoning'
    if (!Array.isArray(blockExercises)) continue;

    // Determine group name based on template type and block key
    const groupName = formatGroupName(blockKey, templateType);

    // Process each exercise in the block
    for (const exercise of blockExercises) {
      // Skip exercises without a name
      if (!exercise.exercise || exercise.exercise.trim() === '') {
        continue;
      }
      
      const exerciseEntity = findExerciseByName(exercise.exercise, exerciseLookup);
      
      exercises.push({
        exerciseId: exerciseEntity?.id || 'unknown',
        exerciseName: exercise.exercise,
        sets: exercise.sets || 0,
        reps: exercise.reps,
        restPeriod: exercise.rest,
        notes: exercise.notes,
        orderIndex: orderIndex++,
        groupName
      });

      totalSets += exercise.sets || 0;
    }
  }

  return {
    workout: {
      name: workoutName || generateWorkoutName(templateType),
      description: workoutDescription,
      workoutType: templateType,
      totalPlannedSets: totalSets,
      llmOutput,
      templateConfig: getTemplateConfig(templateType)
    },
    exercises
  };
}

/**
 * Format group name based on template type and block key
 */
function formatGroupName(blockKey: string, templateType: string): string {
  // Handle different naming conventions
  const key = blockKey.toLowerCase();
  
  if (templateType === 'circuit') {
    // Convert round1, round2, etc. to "Round 1", "Round 2"
    if (key.startsWith('round')) {
      const roundNumber = key.replace('round', '');
      return `Round ${roundNumber}`;
    }
  }
  
  // BMF templates don't use block naming, only round naming

  // Fallback: just capitalize first letter
  return blockKey.charAt(0).toUpperCase() + blockKey.slice(1);
}

/**
 * Find exercise by name (case-insensitive)
 */
function findExerciseByName(
  exerciseName: string, 
  exerciseLookup: Map<string, Exercise>
): Exercise | undefined {
  // First try exact match
  const exactMatch = Array.from(exerciseLookup.values())
    .find(ex => ex.name === exerciseName);
  
  if (exactMatch) return exactMatch;

  // Try case-insensitive match
  const lowerName = exerciseName.toLowerCase();
  return Array.from(exerciseLookup.values())
    .find(ex => ex.name.toLowerCase() === lowerName);
}

/**
 * Generate a default workout name based on template type
 */
function generateWorkoutName(templateType: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  switch (templateType) {
    case 'circuit':
      return `Circuit Training - ${date}`;
    default:
      return `Strength Training - ${date}`;
  }
}

/**
 * Get template configuration metadata
 */
function getTemplateConfig(templateType: string): Record<string, any> {
  switch (templateType) {
    case 'circuit':
      return {
        rounds: 3,
        workRestRatio: '45s/15s',
        format: 'time-based'
      };
    default:
      return {
        blocks: ['A', 'B', 'C', 'D'],
        format: 'rep-based'
      };
  }
}

/**
 * Validate that all exercises in the output can be found in the database
 */
export function validateExerciseLookup(
  llmOutput: LLMWorkoutOutput,
  exerciseLookup: Map<string, Exercise>
): { 
  valid: boolean; 
  missingExercises: string[];
  warnings: string[]; 
} {
  const missingExercises: string[] = [];
  const warnings: string[] = [];

  for (const [blockKey, blockExercises] of Object.entries(llmOutput)) {
    if (!Array.isArray(blockExercises)) continue;

    for (const exercise of blockExercises) {
      // Skip exercises without a name
      if (!exercise.exercise || exercise.exercise.trim() === '') {
        warnings.push(`Exercise in ${blockKey} has no name`);
        continue;
      }
      
      const found = findExerciseByName(exercise.exercise, exerciseLookup);
      
      if (!found) {
        missingExercises.push(exercise.exercise);
        warnings.push(`Exercise "${exercise.exercise}" in ${blockKey} not found in database`);
      }
    }
  }

  return {
    valid: missingExercises.length === 0,
    missingExercises,
    warnings
  };
}