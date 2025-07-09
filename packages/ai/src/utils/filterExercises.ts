import type { Exercise } from "../types";

export type StrengthLevel = "very_low" | "low" | "moderate" | "high";
export type SkillLevel = "very_low" | "low" | "moderate" | "high";
export type IntensityLevel = "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic";

/**
 * Generic function to get allowed levels based on cascading logic
 * Higher levels include all lower levels
 * @param selectedLevel - The user-selected level
 * @returns Array of levels that should be included
 */
function getAllowedCascadingLevels(selectedLevel: string): string[] {
  const levels = ["very_low", "low", "moderate", "high"];
  const selectedIndex = levels.indexOf(selectedLevel);
  
  if (selectedIndex === -1) {
    return [];
  }
  
  // Return all levels up to and including the selected level
  return levels.slice(0, selectedIndex + 1);
}

/**
 * Filter exercises by strength level requirement (inclusive/cascading)
 * Higher levels include all lower levels
 * @param exercises - Array of exercises to filter
 * @param strengthLevel - Desired strength level
 * @returns Filtered array of exercises
 */
export function filterByStrength(
  exercises: Exercise[],
  strengthLevel: StrengthLevel
): Exercise[] {
  // No need for special case anymore - high includes all levels
  
  const allowedLevels = getAllowedStrengthLevels(strengthLevel);
  return exercises.filter(exercise => 
    allowedLevels.includes(exercise.strengthLevel)
  );
}

// For backward compatibility, create aliases
const getAllowedStrengthLevels = (selectedLevel: StrengthLevel) => 
  getAllowedCascadingLevels(selectedLevel);

const getAllowedSkillLevels = (selectedLevel: SkillLevel) => 
  getAllowedCascadingLevels(selectedLevel);


/**
 * Filter exercises by skill/complexity level requirement (inclusive/cascading)
 * Higher levels include all lower levels
 * @param exercises - Array of exercises to filter
 * @param skillLevel - Desired skill level (maps to complexityLevel in DB)
 * @returns Filtered array of exercises
 */
export function filterBySkill(
  exercises: Exercise[],
  skillLevel: SkillLevel
): Exercise[] {
  // No need for special case anymore - high includes all levels
  
  const allowedLevels = getAllowedSkillLevels(skillLevel);
  return exercises.filter(exercise => 
    allowedLevels.includes(exercise.complexityLevel)
  );
}

/**
 * Filter exercises by intensity/fatigue profile
 * Note: Unlike strength/skill, intensity does NOT use cascading logic
 * because intensity levels represent different types of fatigue, not progressive levels:
 * - low_local/moderate_local/high_local = localized muscle fatigue
 * - moderate_systemic/high_systemic = whole-body systemic fatigue
 * - metabolic = metabolic conditioning fatigue
 * @param exercises - Array of exercises to filter
 * @param intensityLevel - Desired intensity level (maps to fatigueProfile in DB)
 * @returns Filtered array of exercises
 */
export function filterByIntensity(
  exercises: Exercise[],
  intensityLevel: IntensityLevel
): Exercise[] {
  // No special case needed - filter by exact match
  
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
    const exerciseJoints = exercise.loadedJoints ?? [];
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