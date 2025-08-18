/**
 * Bucketing logic for Full Body workout types (With/Without Finisher)
 */

import type { ClientContext } from "../../types/clientContext";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { PreAssignedExercise } from "../../types/standardBlueprint";
import { exerciseMatchesMusclePreference } from "../../constants/muscleMapping";
import { BUCKET_CONFIGS, WorkoutType } from "../../types/clientTypes";
import {
  analyzeConstraints,
  getRemainingNeeds,
} from "../utils/constraintAnalyzer";

export interface BucketingResult {
  exercises: ScoredExercise[];
  bucketAssignments: {
    [exerciseId: string]: {
      bucketType: "movement_pattern" | "functional" | "flex";
      constraint: string;
      tiedCount?: number; // Track ties for UI display
    };
  };
}

/**
 * Select exercise with tie-breaking for movement pattern
 */
function selectWithTieBreaking(
  candidates: ScoredExercise[],
  pattern: string,
): { exercise: ScoredExercise; tiedCount?: number } | null {
  if (candidates.length === 0) return null;

  // Find highest score
  const highestScore = Math.max(...candidates.map((ex) => ex.score));

  // Get all exercises with highest score
  const tied = candidates.filter((ex) => ex.score === highestScore);

  if (tied.length === 0) return null;

  // Randomly select from tied exercises
  const randomIndex = Math.floor(Math.random() * tied.length);
  const selected = tied[randomIndex];

  if (!selected) return null;

  return {
    exercise: selected,
    tiedCount: tied.length > 1 ? tied.length : undefined,
  };
}

/**
 * Apply bucketing logic for Full Body workout types (With/Without Finisher)
 * Fills remaining exercise slots after pre-assignments
 */
export function applyFullBodyBucketing(
  availableExercises: ScoredExercise[],
  preAssigned: PreAssignedExercise[],
  client: ClientContext,
  workoutType: WorkoutType,
  favoriteIds: string[] = [],
): BucketingResult {
  // Only process Full Body workout types
  if (
    workoutType !== WorkoutType.FULL_BODY_WITH_FINISHER &&
    workoutType !== WorkoutType.FULL_BODY_WITHOUT_FINISHER
  ) {
    return {
      exercises: [],
      bucketAssignments: {},
    };
  }

  const selected: ScoredExercise[] = [];
  const bucketAssignments: BucketingResult["bucketAssignments"] = {};
  const usedIds = new Set<string>();

  // Get pre-assigned exercises
  const preAssignedExercises = preAssigned.map((p) => p.exercise);

  // Analyze what constraints are already fulfilled
  const analysis = analyzeConstraints(
    preAssignedExercises,
    client,
    workoutType,
  );
  const remainingNeeds = getRemainingNeeds(analysis);

  // Bucketing for client

  // Phase 1: Fill remaining movement patterns (excluding favorites)
  for (const pattern of remainingNeeds.movementPatterns) {
    // Get non-favorite candidates for this pattern
    const candidates = availableExercises.filter(
      (ex) =>
        !usedIds.has(ex.id) &&
        !favoriteIds.includes(ex.id) && // Exclude favorites
        ex.movementPattern?.toLowerCase() === pattern.toLowerCase(),
    );

    const result = selectWithTieBreaking(candidates, pattern);

    if (result) {
      selected.push(result.exercise);
      usedIds.add(result.exercise.id);
      bucketAssignments[result.exercise.id] = {
        bucketType: "movement_pattern",
        constraint: pattern,
        tiedCount: result.tiedCount,
      };
    } else {
      // No non-favorite exercise found for movement pattern
    }
  }

  // Selected exercises for movement patterns

  // Phase 2: Fill muscle_target constraint
  // First, check how many muscle_target exercises we already have from pre-assigned and movement patterns
  const updatedAnalysis = analyzeConstraints(
    [...preAssignedExercises, ...selected],
    client,
    workoutType,
  );
  const currentMuscleTargetCount =
    updatedAnalysis.functionalRequirements.muscle_target?.current || 0;
  const requiredMuscleTargetCount =
    updatedAnalysis.functionalRequirements.muscle_target?.required || 0;
  const muscleTargetNeeded = Math.max(
    0,
    requiredMuscleTargetCount - currentMuscleTargetCount,
  );

  // Debug: Show which exercises already count towards muscle_target
  const existingMuscleTargets = [...preAssignedExercises, ...selected].filter(
    (ex) => {
      const targets = client.muscle_target || [];
      return targets.some((muscle) =>
        exerciseMatchesMusclePreference(ex.primaryMuscle, muscle as any),
      );
    },
  );

  // Muscle target status check

  if (
    muscleTargetNeeded > 0 &&
    client.muscle_target &&
    client.muscle_target.length > 0
  ) {
    const targetMuscles = client.muscle_target;

    // Count how many of each target muscle we already have
    const muscleCountMap = new Map<string, number>();
    for (const muscle of targetMuscles) {
      const count = existingMuscleTargets.filter((ex) =>
        exerciseMatchesMusclePreference(ex.primaryMuscle, muscle as any),
      ).length;
      muscleCountMap.set(muscle.toLowerCase(), count);
    }

    // Current muscle counts calculated

    // Determine how many more we need for each muscle to reach equal distribution
    // For muscle_target constraint of 4: if 1 muscle selected = 4 exercises, if 2 muscles = 2 each
    const totalMuscleTargetRequired = 4; // Total muscle_target constraint
    const targetPerMuscle = Math.floor(
      totalMuscleTargetRequired / targetMuscles.length,
    );
    // Muscle target calculation done
    let distribution: { muscle: string; count: number }[] = [];

    for (const muscle of targetMuscles) {
      const currentCount = muscleCountMap.get(muscle.toLowerCase()) || 0;
      const needed = Math.max(0, targetPerMuscle - currentCount);
      if (needed > 0) {
        distribution.push({ muscle, count: needed });
      }
    }

    // Muscle target distribution calculated

    // Select exercises for each target muscle
    for (const { muscle, count } of distribution) {
      // Get candidates for this specific muscle (including favorites)
      const muscleCandidates = availableExercises.filter(
        (ex) =>
          !usedIds.has(ex.id) &&
          exerciseMatchesMusclePreference(ex.primaryMuscle, muscle as any),
      );

      // Finding exercises for muscle target

      // Select with tie-breaking
      let selectedForMuscle = 0;
      while (
        selectedForMuscle < count &&
        muscleCandidates.some((ex) => !usedIds.has(ex.id))
      ) {
        const remainingCandidates = muscleCandidates.filter(
          (ex) => !usedIds.has(ex.id),
        );
        const result = selectWithTieBreaking(remainingCandidates, muscle);

        if (result) {
          selected.push(result.exercise);
          usedIds.add(result.exercise.id);
          bucketAssignments[result.exercise.id] = {
            bucketType: "functional",
            constraint: "muscle_target",
            tiedCount: result.tiedCount,
          };
          selectedForMuscle++;
        } else {
          // Could not find enough exercises for muscle target
          break;
        }
      }
    }
  }

  console.log(`  ✓ Total selected: ${selected.length} exercises`);

  // Phase 3: Fill capacity constraint
  const updatedAnalysis2 = analyzeConstraints(
    [...preAssignedExercises, ...selected],
    client,
    workoutType,
  );
  const currentCapacityCount =
    updatedAnalysis2.functionalRequirements.capacity?.current || 0;
  const requiredCapacityCount =
    updatedAnalysis2.functionalRequirements.capacity?.required || 0;
  const capacityNeeded = Math.max(
    0,
    requiredCapacityCount - currentCapacityCount,
  );

  console.log(
    `  Capacity status: ${currentCapacityCount}/${requiredCapacityCount} (need ${capacityNeeded} more)`,
  );

  if (capacityNeeded > 0) {
    // Get capacity exercises (excluding favorites)
    const capacityCandidates = availableExercises.filter(
      (ex) =>
        !usedIds.has(ex.id) &&
        !favoriteIds.includes(ex.id) && // Exclude favorites
        ex.functionTags?.includes("capacity"),
    );

    // Finding capacity exercises

    // Select with tie-breaking
    const result = selectWithTieBreaking(capacityCandidates, "capacity");

    if (result) {
      selected.push(result.exercise);
      usedIds.add(result.exercise.id);
      bucketAssignments[result.exercise.id] = {
        bucketType: "functional",
        constraint: "capacity",
        tiedCount: result.tiedCount,
      };
      // Selected capacity exercise
    } else {
      // Could not find capacity exercise
    }
  }

  // Phase 4: Fill remaining slots with favorites to reach 13 total bucketed exercises
  const targetBucketedExercises = 13; // We want exactly 13 bucketed exercises
  const remainingSlots = targetBucketedExercises - selected.length;

  // Flex slots calculation

  if (remainingSlots > 0) {
    // Get favorite exercises that haven't been used yet
    const unusedFavorites = availableExercises.filter(
      (ex) =>
        !usedIds.has(ex.id) &&
        favoriteIds.includes(ex.id) &&
        !preAssignedExercises.some((pre) => pre.id === ex.id), // Not already pre-assigned
    );

    // Finding favorite exercises for flex slots

    // Sort by score and select with tie-breaking
    unusedFavorites.sort((a, b) => b.score - a.score);

    let selectedFlex = 0;
    while (
      selectedFlex < remainingSlots &&
      unusedFavorites.some((ex) => !usedIds.has(ex.id))
    ) {
      const remainingCandidates = unusedFavorites.filter(
        (ex) => !usedIds.has(ex.id),
      );
      const result = selectWithTieBreaking(remainingCandidates, "flex");

      if (result) {
        selected.push(result.exercise);
        usedIds.add(result.exercise.id);
        bucketAssignments[result.exercise.id] = {
          bucketType: "flex",
          constraint: "flex (favorite)",
          tiedCount: result.tiedCount,
        };
        selectedFlex++;
        // Selected favorite for flex
      } else {
        break;
      }
    }

    // If we still need more exercises and no favorites left, fill with highest scoring non-favorites
    if (selectedFlex < remainingSlots) {
      const remainingNeeded = remainingSlots - selectedFlex;
      // Still need more exercises, selecting from non-favorites

      const nonFavorites = availableExercises.filter(
        (ex) => !usedIds.has(ex.id) && !favoriteIds.includes(ex.id),
      );

      nonFavorites.sort((a, b) => b.score - a.score);

      let selectedNonFav = 0;
      while (
        selectedNonFav < remainingNeeded &&
        nonFavorites.some((ex) => !usedIds.has(ex.id))
      ) {
        const remainingCandidates = nonFavorites.filter(
          (ex) => !usedIds.has(ex.id),
        );
        const result = selectWithTieBreaking(remainingCandidates, "flex");

        if (result) {
          selected.push(result.exercise);
          usedIds.add(result.exercise.id);
          bucketAssignments[result.exercise.id] = {
            bucketType: "flex",
            constraint: "flex",
            tiedCount: result.tiedCount,
          };
          selectedNonFav++;
          // Selected non-favorite for flex
        } else {
          break;
        }
      }
    }
  }

  // Bucketing complete

  // Final constraint check
  const finalAnalysis = analyzeConstraints(
    [...preAssignedExercises, ...selected],
    client,
    workoutType,
  );
  // Final constraint check completed

  return {
    exercises: selected,
    bucketAssignments,
  };
}
