import type { Exercise } from "../types";

export type StrengthLevel = "very_low" | "low" | "moderate" | "high" | "very_high" | "all";
export type SkillLevel = "very_low" | "low" | "moderate" | "high" | "all";
export type IntensityLevel = "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic" | "all";

/**
 * Get allowed strength levels based on cascading logic
 * @param selectedLevel - The user-selected strength level
 * @returns Array of strength levels that should be included
 */
function getAllowedStrengthLevels(selectedLevel: StrengthLevel): string[] {
  switch (selectedLevel) {
    case "very_low":
      return ["very_low"];
    case "low":
      return ["very_low", "low"];
    case "moderate":
      return ["very_low", "low", "moderate"];
    case "high":
      return ["very_low", "low", "moderate", "high"]; // Full range
    case "very_high":
      return ["very_low", "low", "moderate", "high", "very_high"]; // Full range + very_high
    case "all":
      return ["very_low", "low", "moderate", "high", "very_high"];
    default:
      return [];
  }
}

/**
 * Filter exercises by strength level requirement (inclusive/cascading)
 * Higher levels include all lower levels
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
  
  const allowedLevels = getAllowedStrengthLevels(strengthLevel);
  return exercises.filter(exercise => 
    allowedLevels.includes(exercise.strengthLevel)
  );
}

/**
 * Get allowed skill levels based on cascading logic
 * @param selectedLevel - The user-selected skill level
 * @returns Array of skill levels that should be included
 */
function getAllowedSkillLevels(selectedLevel: SkillLevel): string[] {
  switch (selectedLevel) {
    case "very_low":
      return ["very_low"];
    case "low":
      return ["very_low", "low"];
    case "moderate":
      return ["very_low", "low", "moderate"];
    case "high":
      return ["very_low", "low", "moderate", "high"]; // Full range
    case "all":
      return ["very_low", "low", "moderate", "high"];
    default:
      return [];
  }
}

/**
 * Filter exercises by skill/complexity level requirement (inclusive/cascading)
 * Higher levels include all lower levels
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
  
  const allowedLevels = getAllowedSkillLevels(skillLevel);
  return exercises.filter(exercise => 
    allowedLevels.includes(exercise.complexityLevel)
  );
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
 * Apply all filters to an exercise array with proper priority:
 * 1. Include filters take highest priority (override strength/skill restrictions)
 * 2. Standard filters (strength/skill/intensity*) apply to remaining exercises (*intensity is optional)
 * 3. Exclude filters take final priority (remove even if included by other filters)
 * @param exercises - Array of exercises to filter
 * @param filters - Object containing all filter values
 * @returns Filtered array of exercises
 */
export function applyAllFilters(
  exercises: Exercise[],
  filters: {
    strength: StrengthLevel;
    skill: SkillLevel;
    intensity?: IntensityLevel;
    include?: string[];
    avoid?: string[];
    avoidJoints?: string[];
  }
): Exercise[] {
  // Step 1: Handle include filters first - these override strength/skill restrictions
  let includedExercises: Exercise[] = [];
  let remainingExercises = exercises;
  
  if (filters.include && filters.include.length > 0) {
    // Get explicitly included exercises (regardless of strength/skill)
    includedExercises = exercises.filter(exercise => 
      filters.include?.includes(exercise.name) ?? false
    );
    
    // Remove included exercises from remaining pool to avoid duplicates
    remainingExercises = exercises.filter(exercise => 
      !(filters.include?.includes(exercise.name) ?? false)
    );
  }
  
  // Step 2: Apply standard filters (strength/skill/intensity/joints) to remaining exercises
  let standardFiltered = remainingExercises;
  standardFiltered = filterByStrength(standardFiltered, filters.strength);
  standardFiltered = filterBySkill(standardFiltered, filters.skill);
  
  // Only apply intensity filtering if provided (will be handled by LLM later)
  if (filters.intensity) {
    standardFiltered = filterByIntensity(standardFiltered, filters.intensity);
  }
  
  // Apply joint filtering to both included and remaining exercises
  if (filters.avoidJoints && filters.avoidJoints.length > 0) {
    includedExercises = filterByAvoidJoints(includedExercises, filters.avoidJoints);
    standardFiltered = filterByAvoidJoints(standardFiltered, filters.avoidJoints);
  }
  
  // Step 3: Combine included exercises with standard filtered exercises
  let combined = [...includedExercises, ...standardFiltered];
  
  // Step 4: Apply exclude filters last - these override everything
  if (filters.avoid && filters.avoid.length > 0) {
    combined = filterByExclude(combined, filters.avoid);
  }
  
  return combined;
}

/**
 * Filter exercises to include only those in the include list
 * @param exercises - Array of exercises to filter
 * @param includeNames - Array of exercise names to include (if empty, includes all)
 * @returns Filtered array of exercises
 */
export function filterByInclude(
  exercises: Exercise[],
  includeNames: string[]
): Exercise[] {
  if (includeNames.length === 0) {
    return exercises;
  }
  
  return exercises.filter(exercise => 
    includeNames.includes(exercise.name)
  );
}

/**
 * Filter exercises to exclude those in the avoid list
 * @param exercises - Array of exercises to filter
 * @param avoidNames - Array of exercise names to avoid
 * @returns Filtered array of exercises
 */
export function filterByExclude(
  exercises: Exercise[],
  avoidNames: string[]
): Exercise[] {
  if (avoidNames.length === 0) {
    return exercises;
  }
  
  return exercises.filter(exercise => 
    !avoidNames.includes(exercise.name)
  );
}

/**
 * Filter exercises to exclude those that load specific joints
 * @param exercises - Array of exercises to filter
 * @param avoidJoints - Array of joint names to avoid (for injuries/limitations)
 * @returns Filtered array of exercises
 */
export function filterByAvoidJoints(
  exercises: Exercise[],
  avoidJoints: string[]
): Exercise[] {
  if (avoidJoints.length === 0) {
    return exercises;
  }
  
  return exercises.filter(exercise => {
    // Check if exercise loads any of the joints to avoid
    const exerciseJoints = exercise.loadedJoints || [];
    return !exerciseJoints.some(joint => avoidJoints.includes(joint));
  });
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