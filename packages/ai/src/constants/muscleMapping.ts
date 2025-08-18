/**
 * Muscle mapping configuration for consolidating muscle groups
 * Maps old muscle values (used in exercises) to new simplified muscle values (shown to users)
 */

// The 13 consolidated muscles that users will see
export const CONSOLIDATED_MUSCLES = [
  // Lower Body (5)
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "hips",

  // Core (2)
  "core",
  "obliques",

  // Upper Body Push (3)
  "chest",
  "shoulders",
  "triceps",

  // Upper Body Pull (3)
  "back",
  "traps",
  "biceps",
] as const;

export type ConsolidatedMuscle = (typeof CONSOLIDATED_MUSCLES)[number];

// Mapping from old muscle values to new consolidated values
export const MUSCLE_MAPPING: Record<string, ConsolidatedMuscle> = {
  // Back consolidation
  lats: "back",
  upper_back: "back",
  lower_back: "core", // Lower back moves to core

  // Chest consolidation
  chest: "chest",
  upper_chest: "chest",
  lower_chest: "chest",

  // Shoulder consolidation
  shoulders: "shoulders",
  delts: "shoulders",

  // Hip consolidation
  adductors: "hips",
  abductors: "hips",

  // Core (no change needed)
  core: "core",
  obliques: "obliques",
  lower_abs: "core",
  upper_abs: "core",

  // Arms (no change needed)
  biceps: "biceps",
  triceps: "triceps",
  traps: "traps",

  // Lower body (no change needed)
  glutes: "glutes",
  quads: "quads",
  hamstrings: "hamstrings",
  calves: "calves",
  shins: "calves", // Map shins to calves (closest muscle group)
  tibialis_anterior: "calves", // Map tibialis_anterior to calves
};

// Reverse mapping: from new muscles to all old muscles that map to it
export const REVERSE_MUSCLE_MAPPING: Record<ConsolidatedMuscle, string[]> = {
  back: ["lats", "upper_back", "back"],
  chest: ["chest", "upper_chest", "lower_chest"],
  shoulders: ["shoulders", "delts"],
  hips: ["adductors", "abductors", "hips"],
  core: ["core", "lower_back", "lower_abs", "upper_abs"],
  obliques: ["obliques"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  traps: ["traps"],
  glutes: ["glutes"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  calves: ["calves", "shins", "tibialis_anterior"], // shins/tibialis map to calves
};

// Helper function to map old muscle to new
export function mapMuscleToConsolidated(oldMuscle: string): ConsolidatedMuscle {
  const mapped = MUSCLE_MAPPING[oldMuscle.toLowerCase()];
  if (!mapped) {
    console.warn(`Unknown muscle: ${oldMuscle}, defaulting to original value`);
    return oldMuscle as ConsolidatedMuscle;
  }
  return mapped;
}

// Helper function to get all old muscles that correspond to a new muscle
export function getOldMusclesForConsolidated(
  consolidatedMuscle: ConsolidatedMuscle,
): string[] {
  // Try lowercase version first since our mapping uses lowercase keys
  const lowerMuscle = consolidatedMuscle.toLowerCase() as ConsolidatedMuscle;
  return (
    REVERSE_MUSCLE_MAPPING[lowerMuscle] ||
    REVERSE_MUSCLE_MAPPING[consolidatedMuscle] || [consolidatedMuscle]
  );
}

// Helper function to check if an exercise matches a user's muscle preference
export function exerciseMatchesMusclePreference(
  exerciseMuscle: string | undefined,
  userPreference: ConsolidatedMuscle,
): boolean {
  if (!exerciseMuscle) {
    console.log(`[muscleMapping] No exercise muscle provided`);
    return false;
  }

  // Get all old muscles that map to this consolidated muscle
  const oldMuscles = getOldMusclesForConsolidated(userPreference);
  const result = oldMuscles.includes(exerciseMuscle.toLowerCase());

  console.log(
    `[muscleMapping] Checking: "${exerciseMuscle}" vs preference "${userPreference}"`,
  );
  console.log(
    `[muscleMapping] Old muscles for "${userPreference}": [${oldMuscles.join(", ")}]`,
  );
  console.log(`[muscleMapping] Match result: ${result}`);

  return result;
}

// Muscle group expansions for preference parsing
export const MUSCLE_GROUP_EXPANSIONS: Record<string, ConsolidatedMuscle[]> = {
  legs: ["quads", "hamstrings", "glutes", "calves"],
  "upper body": ["chest", "back", "shoulders", "biceps", "triceps"],
  "lower body": ["glutes", "quads", "hamstrings", "calves", "hips"],
  arms: ["biceps", "triceps"],
  abs: ["core", "obliques"],
};
