import type { Exercise } from "../types";

export type StrengthLevel = "very_low" | "low" | "moderate" | "high" | "very_high" | "all";
export type SkillLevel = "very_low" | "low" | "moderate" | "high" | "all";
export type IntensityLevel = "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all";

/**
 * Filter exercises by strength level requirement
 * @param exercises - Array of exercises to filter
 * @param strengthLevel - Desired strength level or "all"
 * @returns Filtered array of exercises
 */
export function filterByStrength(
  exercises: Exercise[],
  strengthLevel: StrengthLevel
): Exercise[] {
  if (strengthLevel === "all") {
    return exercises;
  }
  
  return exercises.filter(exercise => exercise.strengthLevel === strengthLevel);
}

/**
 * Filter exercises by skill/complexity level requirement
 * @param exercises - Array of exercises to filter
 * @param skillLevel - Desired skill level or "all" (maps to complexityLevel in DB)
 * @returns Filtered array of exercises
 */
export function filterBySkill(
  exercises: Exercise[],
  skillLevel: SkillLevel
): Exercise[] {
  if (skillLevel === "all") {
    return exercises;
  }
  
  return exercises.filter(exercise => exercise.complexityLevel === skillLevel);
}

/**
 * Filter exercises by intensity/fatigue profile
 * @param exercises - Array of exercises to filter
 * @param intensityLevel - Desired intensity level or "all" (maps to fatigueProfile in DB)
 * @returns Filtered array of exercises
 */
export function filterByIntensity(
  exercises: Exercise[],
  intensityLevel: IntensityLevel
): Exercise[] {
  if (intensityLevel === "all") {
    return exercises;
  }
  
  return exercises.filter(exercise => exercise.fatigueProfile === intensityLevel);
}

/**
 * Apply all filters to an exercise array
 * @param exercises - Array of exercises to filter
 * @param filters - Object containing all filter values
 * @returns Filtered array of exercises
 */
export function applyAllFilters(
  exercises: Exercise[],
  filters: {
    strength: StrengthLevel;
    skill: SkillLevel;
    intensity: IntensityLevel;
  }
): Exercise[] {
  let filtered = exercises;
  
  filtered = filterByStrength(filtered, filters.strength);
  filtered = filterBySkill(filtered, filters.skill);
  filtered = filterByIntensity(filtered, filters.intensity);
  
  return filtered;
}

/**
 * Get unique values for each filter type from exercises
 * Useful for dynamically generating filter options
 */
export function getAvailableFilterValues(exercises: Exercise[]) {
  const strengthLevels = new Set<string>();
  const skillLevels = new Set<string>();
  const intensityLevels = new Set<string>();
  
  exercises.forEach(exercise => {
    if (exercise.strengthLevel) strengthLevels.add(exercise.strengthLevel);
    if (exercise.complexityLevel) skillLevels.add(exercise.complexityLevel);
    if (exercise.fatigueProfile) intensityLevels.add(exercise.fatigueProfile);
  });
  
  return {
    strengthLevels: Array.from(strengthLevels).sort(),
    skillLevels: Array.from(skillLevels).sort(),
    intensityLevels: Array.from(intensityLevels).sort(),
  };
}