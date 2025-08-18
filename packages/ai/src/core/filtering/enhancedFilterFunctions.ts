/**
 * Enhanced filtering functions with debug tracking
 */

import type { Exercise } from "../../types";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { FilterCriteria, SkillLevel, StrengthLevel } from "./types";
import { debugLogger, exclusionTracker } from "../../utils/enhancedDebug";
import { CASCADING_LEVELS } from "./types";

/**
 * Generic function to get allowed levels based on cascading logic
 */
function getAllowedCascadingLevels(selectedLevel: string): string[] {
  const selectedIndex = CASCADING_LEVELS.indexOf(selectedLevel as any);

  if (selectedIndex === -1) {
    return [];
  }

  return CASCADING_LEVELS.slice(0, selectedIndex + 1);
}

/**
 * Enhanced filter by strength with exclusion tracking
 */
export function filterByStrengthEnhanced(
  exercises: ScoredExercise[],
  strengthLevel: StrengthLevel,
): ScoredExercise[] {
  const startTime = performance.now();
  const allowedLevels = getAllowedCascadingLevels(strengthLevel);

  debugLogger.log("filtering", `Filtering by strength: ${strengthLevel}`, {
    allowedLevels,
    inputCount: exercises.length,
  });

  const filtered = exercises.filter((exercise) => {
    const isAllowed = allowedLevels.includes(exercise.strengthLevel);
    if (!isAllowed) {
      exclusionTracker.addExclusion(
        exercise,
        `strength_too_high:${exercise.strengthLevel}_exceeds_${strengthLevel}`,
      );
    }
    return isAllowed;
  });

  const duration = performance.now() - startTime;
  debugLogger.log(
    "filtering",
    `Strength filtering complete`,
    {
      excluded: exercises.length - filtered.length,
      remaining: filtered.length,
    },
    exercises.length - filtered.length,
  );
  debugLogger.logPerformance(debugLogger.getLogs().length, duration);

  return filtered;
}

/**
 * Enhanced filter by skill with exclusion tracking
 */
export function filterBySkillEnhanced(
  exercises: ScoredExercise[],
  skillLevel: SkillLevel,
): ScoredExercise[] {
  const startTime = performance.now();
  const allowedLevels = getAllowedCascadingLevels(skillLevel);

  debugLogger.log("filtering", `Filtering by skill: ${skillLevel}`, {
    allowedLevels,
    inputCount: exercises.length,
  });

  const filtered = exercises.filter((exercise) => {
    const isAllowed = allowedLevels.includes(exercise.complexityLevel);
    if (!isAllowed) {
      exclusionTracker.addExclusion(
        exercise,
        `complexity_too_high:${exercise.complexityLevel}_exceeds_${skillLevel}`,
      );
    }
    return isAllowed;
  });

  const duration = performance.now() - startTime;
  debugLogger.log(
    "filtering",
    `Skill filtering complete`,
    {
      excluded: exercises.length - filtered.length,
      remaining: filtered.length,
    },
    exercises.length - filtered.length,
  );
  debugLogger.logPerformance(debugLogger.getLogs().length, duration);

  return filtered;
}

/**
 * Enhanced filter by joint restrictions with exclusion tracking
 */
export function filterByAvoidJointsEnhanced(
  exercises: ScoredExercise[],
  avoidJoints: string[],
): ScoredExercise[] {
  if (avoidJoints.length === 0) {
    return exercises;
  }

  const startTime = performance.now();

  debugLogger.log("filtering", `Filtering by joint restrictions`, {
    avoidJoints,
    inputCount: exercises.length,
  });

  const filtered = exercises.filter((exercise) => {
    const hasRestrictedJoint =
      exercise.loadedJoints?.some((joint) => avoidJoints.includes(joint)) ??
      false;

    if (hasRestrictedJoint) {
      const restrictedJoints =
        exercise.loadedJoints?.filter((joint) => avoidJoints.includes(joint)) ??
        [];
      exclusionTracker.addExclusion(
        exercise,
        `joint_restriction:${restrictedJoints.join(",")}`,
      );
    }

    return !hasRestrictedJoint;
  });

  const duration = performance.now() - startTime;
  debugLogger.log(
    "filtering",
    `Joint restriction filtering complete`,
    {
      excluded: exercises.length - filtered.length,
      remaining: filtered.length,
    },
    exercises.length - filtered.length,
  );
  debugLogger.logPerformance(debugLogger.getLogs().length, duration);

  return filtered;
}

/**
 * Enhanced filter by exclude list with exclusion tracking
 */
export function filterByExcludeEnhanced(
  exercises: ScoredExercise[],
  excludeNames: string[],
): ScoredExercise[] {
  if (excludeNames.length === 0) {
    return exercises;
  }

  const startTime = performance.now();

  debugLogger.log("filtering", `Filtering by exclude list`, {
    excludeNames,
    inputCount: exercises.length,
  });

  const filtered = exercises.filter((exercise) => {
    const shouldExclude = excludeNames.includes(exercise.name);
    if (shouldExclude) {
      exclusionTracker.addExclusion(exercise, "user_excluded");
    }
    return !shouldExclude;
  });

  const duration = performance.now() - startTime;
  debugLogger.log(
    "filtering",
    `Exclude filtering complete`,
    {
      excluded: exercises.length - filtered.length,
      remaining: filtered.length,
    },
    exercises.length - filtered.length,
  );
  debugLogger.logPerformance(debugLogger.getLogs().length, duration);

  return filtered;
}

/**
 * Enhanced apply all filters with full debug tracking
 */
export function applyAllFiltersEnhanced(
  exercises: ScoredExercise[],
  filters: FilterCriteria,
  enableDebug = false,
): ScoredExercise[] {
  if (enableDebug) {
    debugLogger.enable();
    debugLogger.log("filtering", "Starting enhanced filtering", {
      totalExercises: exercises.length,
      filters,
    });
  }

  // Step 1: Handle include filters first
  let includedExercises: ScoredExercise[] = [];
  let remainingExercises = exercises;

  if (filters.include && filters.include.length > 0) {
    debugLogger.log("filtering", "Processing include list", {
      includeList: filters.include,
    });

    includedExercises = exercises.filter(
      (exercise) => filters.include?.includes(exercise.name) ?? false,
    );

    remainingExercises = exercises.filter(
      (exercise) => !(filters.include?.includes(exercise.name) ?? false),
    );

    debugLogger.log("filtering", "Include list processed", {
      includedCount: includedExercises.length,
      remainingCount: remainingExercises.length,
    });
  }

  // Step 2: Apply standard filters to remaining exercises
  let standardFiltered = remainingExercises;
  standardFiltered = filterByStrengthEnhanced(
    standardFiltered,
    filters.strength,
  );
  standardFiltered = filterBySkillEnhanced(standardFiltered, filters.skill);

  // Apply joint filtering to both included and remaining exercises
  if (filters.avoidJoints && filters.avoidJoints.length > 0) {
    includedExercises = filterByAvoidJointsEnhanced(
      includedExercises,
      filters.avoidJoints,
    );
    standardFiltered = filterByAvoidJointsEnhanced(
      standardFiltered,
      filters.avoidJoints,
    );
  }

  // Step 3: Combine included exercises with standard filtered exercises
  let combined = [...includedExercises, ...standardFiltered];

  debugLogger.log("filtering", "Combined included and filtered exercises", {
    combinedCount: combined.length,
  });

  // Step 4: Apply exclude filters last
  if (filters.avoid && filters.avoid.length > 0) {
    combined = filterByExcludeEnhanced(combined, filters.avoid);
  }

  if (enableDebug) {
    debugLogger.log("filtering", "Filtering complete", {
      finalCount: combined.length,
      totalExcluded: exercises.length - combined.length,
      exclusionsSummary: Object.keys(exclusionTracker.getExclusions()).length,
    });
  }

  return combined;
}
