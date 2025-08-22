/**
 * Exercise tier classification for deterministic round placement
 * 
 * Tier 1: Lower body compound movements (highest priority)
 * Tier 1.5: Upper body barbell compounds
 * Tier 2: Secondary compounds and accessories
 * Tier 3: Isolation, core, and finishers
 */

export interface ExerciseWithTier {
  exerciseId: string;
  clientId: string;
  tier: number;
  movementPattern?: string;
  equipment?: string[];
  functionTags?: string[];
  primaryMuscle?: string;
  modality?: string;
}

// Lower body compound patterns that qualify for Tier 1
const TIER1_MOVEMENT_PATTERNS = ["squat", "deadlift", "hinge", "lunge"];

// Equipment that qualifies for Tier 1 when combined with lower body compounds
const TIER1_EQUIPMENT = ["barbell", "landmine", "kettlebell", "dumbbells", "trap_bar"];

// Upper body patterns for Tier 1.5
const TIER1_5_MOVEMENT_PATTERNS = ["vertical_push", "horizontal_push", "row"];

// Isolation patterns that force Tier 3
const ISOLATION_PATTERNS = ["arm_isolation", "shoulder_isolation", "leg_isolation", "core"];

/**
 * Assigns tier classification to an exercise based on movement pattern,
 * equipment, and function tags
 */
export function assignExerciseTier(exercise: {
  movementPattern?: string;
  equipment?: string[];
  functionTags?: string[];
  modality?: string;
}): number {
  const movementPattern = exercise.movementPattern?.toLowerCase();
  const functionTags = exercise.functionTags || [];
  const equipment = exercise.equipment || [];
  const modality = exercise.modality?.toLowerCase();

  // Check for isolation movements - always Tier 3
  if (movementPattern && ISOLATION_PATTERNS.includes(movementPattern)) {
    return 3;
  }

  // Check for conditioning modality - Tier 3
  if (modality === "conditioning") {
    return 3;
  }

  // Check for core or accessory function tags - Tier 3
  if (functionTags.includes("core") || functionTags.includes("accessory")) {
    return 3;
  }

  // Check for Tier 1: Lower body compounds
  if (movementPattern && TIER1_MOVEMENT_PATTERNS.includes(movementPattern)) {
    // Must have proper equipment
    const hasProperEquipment = equipment.some(eq => 
      TIER1_EQUIPMENT.includes(eq.toLowerCase())
    );
    
    if (hasProperEquipment) {
      // Must have strength tags (primary or secondary)
      if (functionTags.includes("primary_strength") || 
          functionTags.includes("secondary_strength")) {
        return 1;
      }
      
      // Log warning for missing function tags on likely compound
      console.warn(
        `Exercise with pattern '${movementPattern}' and equipment '${equipment.join(', ')}' ` +
        `missing function tags - defaulting to Tier 2`
      );
    }
  }

  // Check for Tier 1.5: Upper body barbell compounds
  if (movementPattern && TIER1_5_MOVEMENT_PATTERNS.includes(movementPattern)) {
    // Must have barbell or landmine
    const hasBarbell = equipment.some(eq => 
      ["barbell", "landmine"].includes(eq.toLowerCase())
    );
    
    if (hasBarbell && functionTags.includes("primary_strength")) {
      return 1.5;
    }
  }

  // Check for Tier 2: Secondary strength
  if (functionTags.includes("secondary_strength")) {
    return 2;
  }

  // Default to Tier 2 for everything else
  return 2;
}

/**
 * Assigns tiers to a list of exercises
 */
export function assignExerciseTiers(
  exercises: Array<{
    exerciseId: string;
    clientId: string;
    movementPattern?: string;
    equipment?: string[];
    functionTags?: string[];
    primaryMuscle?: string;
    modality?: string;
  }>
): ExerciseWithTier[] {
  return exercises.map(exercise => ({
    ...exercise,
    tier: assignExerciseTier(exercise)
  }));
}

/**
 * Groups exercises by tier for easier processing
 */
export function groupExercisesByTier(
  exercisesWithTiers: ExerciseWithTier[]
): Record<string, Record<number, ExerciseWithTier[]>> {
  const grouped: Record<string, Record<number, ExerciseWithTier[]>> = {};
  
  for (const exercise of exercisesWithTiers) {
    if (!grouped[exercise.clientId]) {
      grouped[exercise.clientId] = {};
    }
    
    const tier = exercise.tier;
    if (!grouped[exercise.clientId][tier]) {
      grouped[exercise.clientId][tier] = [];
    }
    
    grouped[exercise.clientId][tier].push(exercise);
  }
  
  return grouped;
}

/**
 * Sorts exercises by tier priority (lower tier = higher priority)
 * Within same tier, maintains original order
 */
export function sortExercisesByTier(
  exercises: ExerciseWithTier[]
): ExerciseWithTier[] {
  return [...exercises].sort((a, b) => a.tier - b.tier);
}