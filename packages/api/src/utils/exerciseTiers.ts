/**
 * Exercise tier classification for deterministic round placement
 * 
 * Tier 1: 
 *   - High fatigue exercises (high_local/high_systemic) with proper equipment (excluding capacity/core)
 *   - Lower body compound movements with primary_strength tag
 * Tier 1.5: Upper body barbell compounds
 * Tier 2: Lower body movements without primary_strength or proper equipment
 * Tier 2.5: Upper body secondary compounds and accessories
 * Tier 3: Isolation, core, and finishers
 */

export interface ExerciseWithTier {
  exerciseId: string;
  clientId: string;
  name?: string;
  tier: number;
  movementPattern?: string;
  equipment?: string[];
  functionTags?: string[];
  primaryMuscle?: string;
  modality?: string;
  fatigueProfile?: string;
}

// Lower body compound patterns that qualify for Tier 1
const TIER1_MOVEMENT_PATTERNS = ["squat", "deadlift", "hinge", "lunge"];

// Equipment that qualifies for Tier 1 when combined with lower body compounds
const TIER1_EQUIPMENT = ["barbell", "landmine", "kettlebell", "dumbbells", "trap_bar", "pull_up_bar"];

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
  fatigueProfile?: string;
  name?: string;
}): number {
  const movementPattern = exercise.movementPattern?.toLowerCase();
  const functionTags = exercise.functionTags || [];
  const equipment = exercise.equipment || [];
  const modality = exercise.modality?.toLowerCase();
  const fatigueProfile = exercise.fatigueProfile?.toLowerCase();
  
  // Log Pull-Ups specifically for debugging
  if (exercise.name?.toLowerCase().includes('pull-up') || exercise.name?.toLowerCase().includes('pull up')) {
    console.log(`=== TIER ASSIGNMENT FOR ${exercise.name} ===`);
    console.log(`  - Movement Pattern: ${movementPattern}`);
    console.log(`  - Equipment: ${JSON.stringify(equipment)}`);
    console.log(`  - Function Tags: ${JSON.stringify(functionTags)}`);
    console.log(`  - Fatigue Profile: ${fatigueProfile || 'MISSING'}`);
    console.log(`  - Has high fatigue: ${fatigueProfile === 'high_local' || fatigueProfile === 'high_systemic'}`);
    console.log(`  - Has proper Tier 1 equipment: ${equipment.some(eq => TIER1_EQUIPMENT.includes(eq.toLowerCase()))}`);
  }

  // PRIORITY 0: Check for high fatigue exercises (excluding capacity/core)
  // High fatigue exercises with proper equipment get Tier 1
  if ((fatigueProfile === 'high_local' || fatigueProfile === 'high_systemic') && 
      !functionTags.includes('capacity') && 
      !functionTags.includes('core')) {
    // Must have proper equipment
    const hasProperEquipment = equipment.some(eq => 
      TIER1_EQUIPMENT.includes(eq.toLowerCase())
    );
    
    if (hasProperEquipment) {
      return 1;
    }
  }

  // PRIORITY 1: Check for Tier 1 - Lower body compounds
  // These take precedence even if tagged as accessory
  if (movementPattern && TIER1_MOVEMENT_PATTERNS.includes(movementPattern)) {
    // Must have proper equipment
    const hasProperEquipment = equipment.some(eq => 
      TIER1_EQUIPMENT.includes(eq.toLowerCase())
    );
    
    if (hasProperEquipment) {
      // Only accept primary_strength for Tier 1
      if (functionTags.includes("primary_strength")) {
        return 1;
      }
      
      // Lower body compounds without primary_strength fall through to Tier 2
      return 2;
    }
    
    // Lower body patterns without proper equipment also get Tier 2
    return 2;
  }

  // PRIORITY 2: Check for Tier 1.5 - Upper body barbell compounds
  if (movementPattern && TIER1_5_MOVEMENT_PATTERNS.includes(movementPattern)) {
    // Must have barbell or landmine
    const hasBarbell = equipment.some(eq => 
      ["barbell", "landmine"].includes(eq.toLowerCase())
    );
    
    if (hasBarbell && functionTags.includes("primary_strength")) {
      return 1.5;
    }
  }

  // PRIORITY 3: Check for true isolation movements - Tier 3
  // Only if movement pattern is explicitly isolation
  if (movementPattern && ISOLATION_PATTERNS.includes(movementPattern)) {
    return 3;
  }

  // PRIORITY 4: Check for conditioning modality - Tier 3
  if (modality === "conditioning") {
    return 3;
  }

  // PRIORITY 5: Check for Tier 2.5 - Upper body secondary compounds and accessories
  // This includes secondary_strength that isn't lower body compound
  if (functionTags.includes("secondary_strength") || 
      functionTags.includes("accessory")) {
    // If it has an upper body compound movement pattern (push/pull) it's Tier 2.5
    if (movementPattern && 
        ["vertical_push", "horizontal_push", "vertical_pull", "horizontal_pull", "row"].includes(movementPattern)) {
      return 2.5;
    }
  }

  // PRIORITY 6: Core-specific exercises - Tier 3
  if (functionTags.includes("core")) {
    return 3;
  }

  // Default to Tier 2.5 for everything else
  const finalTier = 2.5;
  
  // Log final tier assignment for Pull-Ups
  if (exercise.name?.toLowerCase().includes('pull-up') || exercise.name?.toLowerCase().includes('pull up')) {
    console.log(`  => FINAL TIER: ${finalTier}`);
  }
  
  return finalTier;
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
    fatigueProfile?: string;
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