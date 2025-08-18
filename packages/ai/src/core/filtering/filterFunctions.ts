/**
 * Core filtering functions
 * Extracted from utils/filterExercises.ts with improvements
 */

import type { Exercise } from "../../types";
import type { FilterCriteria, SkillLevel, StrengthLevel } from "./types";
import { CASCADING_LEVELS } from "./types";

/**
 * Generic function to get allowed levels based on cascading logic
 * Higher levels include all lower levels
 */
function getAllowedCascadingLevels(selectedLevel: string): string[] {
  const selectedIndex = CASCADING_LEVELS.indexOf(selectedLevel as any);

  if (selectedIndex === -1) {
    return [];
  }

  // Return all levels up to and including the selected level
  return CASCADING_LEVELS.slice(0, selectedIndex + 1);
}

/**
 * Filter exercises by strength level requirement (inclusive/cascading)
 * Higher levels include all lower levels
 */
export function filterByStrength(
  exercises: Exercise[],
  strengthLevel: StrengthLevel,
): Exercise[] {
  const allowedLevels = getAllowedCascadingLevels(strengthLevel);
  return exercises.filter((exercise) => {
    // Skip exercises with null/undefined strength level
    if (!exercise.strengthLevel) return false;
    return allowedLevels.includes(exercise.strengthLevel);
  });
}

/**
 * Filter exercises by skill/complexity level requirement (inclusive/cascading)
 * Higher levels include all lower levels
 */
export function filterBySkill(
  exercises: Exercise[],
  skillLevel: SkillLevel,
): Exercise[] {
  const allowedLevels = getAllowedCascadingLevels(skillLevel);
  return exercises.filter((exercise) => {
    // Skip exercises with null/undefined complexity level
    if (!exercise.complexityLevel) return false;
    return allowedLevels.includes(exercise.complexityLevel);
  });
}

/**
 * Filter exercises to include only those in the include list
 */
export function filterByInclude(
  exercises: Exercise[],
  includeNames: string[],
): Exercise[] {
  if (includeNames.length === 0) {
    return exercises;
  }

  return exercises.filter((exercise) => includeNames.includes(exercise.name));
}

/**
 * Filter exercises to exclude those in the avoid list
 */
export function filterByExclude(
  exercises: Exercise[],
  avoidNames: string[],
): Exercise[] {
  if (avoidNames.length === 0) {
    return exercises;
  }

  return exercises.filter((exercise) => !avoidNames.includes(exercise.name));
}

/**
 * Filter exercises to exclude those that load specific joints
 */
export function filterByAvoidJoints(
  exercises: Exercise[],
  avoidJoints: string[],
): Exercise[] {
  if (avoidJoints.length === 0) {
    return exercises;
  }

  return exercises.filter((exercise) => {
    const exerciseJoints = exercise.loadedJoints ?? [];
    return !exerciseJoints.some((joint) => avoidJoints.includes(joint));
  });
}

/**
 * Validate that an exercise has all required fields
 */
function isValidExercise(exercise: Exercise): boolean {
  return !!(
    exercise.id &&
    exercise.name &&
    exercise.primaryMuscle &&
    exercise.strengthLevel &&
    exercise.complexityLevel
  );
}

/**
 * Apply all filters to an exercise array with proper priority:
 * 1. Include filters take highest priority (override strength/skill restrictions)
 * 2. Standard filters (strength/skill/intensity) apply to remaining exercises
 * 3. Joint restrictions apply to all exercises
 * 4. Exclude filters take final priority (remove even if included by other filters)
 */
export function applyAllFilters(
  exercises: Exercise[],
  filters: FilterCriteria,
): Exercise[] {
  // First, filter out invalid exercises
  const validExercises = exercises.filter(isValidExercise);
  // Step 1: Handle include filters first - these override strength/skill restrictions
  let includedExercises: Exercise[] = [];
  let remainingExercises = validExercises;

  if (filters.include && filters.include.length > 0) {
    // Get explicitly included exercises (regardless of strength/skill)
    includedExercises = validExercises.filter(
      (exercise) => filters.include?.includes(exercise.name) ?? false,
    );

    // Remove included exercises from remaining pool to avoid duplicates
    remainingExercises = validExercises.filter(
      (exercise) => !(filters.include?.includes(exercise.name) ?? false),
    );
  }

  // Step 2: Apply standard filters to remaining exercises
  let standardFiltered = remainingExercises;
  standardFiltered = filterByStrength(standardFiltered, filters.strength);
  standardFiltered = filterBySkill(standardFiltered, filters.skill);

  // Apply joint filtering to both included and remaining exercises
  if (filters.avoidJoints && filters.avoidJoints.length > 0) {
    includedExercises = filterByAvoidJoints(
      includedExercises,
      filters.avoidJoints,
    );
    standardFiltered = filterByAvoidJoints(
      standardFiltered,
      filters.avoidJoints,
    );
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
 * Get unique values for each filter type from exercises
 * Useful for dynamically generating filter options
 */
export function getAvailableFilterValues(exercises: Exercise[]) {
  const strengthLevels = new Set<string>();
  const skillLevels = new Set<string>();
  const intensityLevels = new Set<string>();

  exercises.forEach((exercise) => {
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
