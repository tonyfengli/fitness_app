/**
 * Bucketing logic for Targeted workout types
 */

import type { ClientContext } from "../../types/clientContext";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { PreAssignedExercise } from "../../types/standardBlueprint";
import { exerciseMatchesMusclePreference, mapMuscleToConsolidated, type ConsolidatedMuscle } from "../../constants/muscleMapping";
import { WorkoutType } from "../../types/clientTypes";

export interface BucketingResult {
  exercises: ScoredExercise[];
  bucketAssignments: {
    [exerciseId: string]: {
      bucketType: "muscle_target" | "movement_diversity";
      constraint: string;
      tiedCount?: number;
      selectionRound?: number; // For round-robin tracking
    };
  };
}

/**
 * Select exercise with tie-breaking
 */
function selectWithTieBreaking(
  candidates: ScoredExercise[],
  constraint: string,
  selectionRound?: number,
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
 * Get movement pattern counts from selected exercises
 */
function getMovementPatternCounts(exercises: ScoredExercise[]): Map<string, number> {
  const counts = new Map<string, number>();
  
  exercises.forEach((ex) => {
    if (ex.movementPattern) {
      const pattern = ex.movementPattern.toLowerCase();
      counts.set(pattern, (counts.get(pattern) || 0) + 1);
    }
  });
  
  return counts;
}

/**
 * Get all possible movement patterns
 */
function getAllMovementPatterns(): string[] {
  return [
    "horizontal_push",
    "horizontal_pull", 
    "vertical_push",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
    "core",
    "shoulder_isolation",
    "arm_isolation",
    "leg_isolation",
    "bicep_isolation",
    "tricep_isolation"
  ];
}

/**
 * Apply bucketing logic for Targeted workout types
 */
export function applyTargetedBucketing(
  availableExercises: ScoredExercise[],
  preAssigned: PreAssignedExercise[],
  client: ClientContext,
  workoutType: WorkoutType,
  favoriteIds: string[] = [],
): BucketingResult {
  // Only process Targeted workout types
  if (
    workoutType !== WorkoutType.TARGETED_WITH_FINISHER &&
    workoutType !== WorkoutType.TARGETED_WITHOUT_FINISHER &&
    workoutType !== WorkoutType.TARGETED_WITHOUT_FINISHER_WITH_CORE &&
    workoutType !== WorkoutType.TARGETED_WITH_FINISHER_WITH_CORE
  ) {
    return {
      exercises: [],
      bucketAssignments: {},
    };
  }

  const selected: ScoredExercise[] = [];
  const bucketAssignments: BucketingResult["bucketAssignments"] = {};
  const usedIds = new Set<string>();
  
  // Get pre-assigned exercise IDs to exclude
  const preAssignedIds = new Set(preAssigned.map(p => p.exercise.id));

  // Get client's muscle targets
  const muscleTargets = client.muscle_target || [];
  
  if (muscleTargets.length === 0) {
    console.warn("[TargetedBucketing] No muscle targets defined for client");
    return { exercises: [], bucketAssignments: {} };
  }

  // Convert muscle targets to consolidated muscles
  const consolidatedTargets = muscleTargets.map(muscle => 
    mapMuscleToConsolidated(muscle as any)
  );

  console.log(`[TargetedBucketing] Client ${client.name}: ${consolidatedTargets.length} muscle targets`);

  // Phase 1: Round-Robin Muscle Selection (first 9-10 exercises)
  const roundRobinTarget = 10;
  let currentRound = 1;
  let muscleQueue = [...consolidatedTargets];
  
  while (selected.length < roundRobinTarget && muscleQueue.length > 0) {
    const musclesThisRound = [...muscleQueue];
    const nextMuscleQueue: ConsolidatedMuscle[] = [];
    
    for (const targetMuscle of musclesThisRound) {
      if (selected.length >= roundRobinTarget) break;
      
      // Find exercises matching this muscle that haven't been used
      const candidates = availableExercises.filter((ex) =>
        !usedIds.has(ex.id) &&
        !preAssignedIds.has(ex.id) &&
        exerciseMatchesMusclePreference(ex.primaryMuscle, targetMuscle)
      );
      
      const result = selectWithTieBreaking(candidates, targetMuscle);
      
      if (result) {
        selected.push(result.exercise);
        usedIds.add(result.exercise.id);
        bucketAssignments[result.exercise.id] = {
          bucketType: "muscle_target",
          constraint: targetMuscle.toLowerCase(),
          tiedCount: result.tiedCount,
          selectionRound: currentRound,
        };
        
        // Keep this muscle in queue if it has more exercises
        if (candidates.length > 1) {
          nextMuscleQueue.push(targetMuscle);
        }
        
        console.log(`[TargetedBucketing] Round ${currentRound}: Selected "${result.exercise.name}" for ${targetMuscle}`);
      } else {
        console.log(`[TargetedBucketing] Round ${currentRound}: No exercises left for ${targetMuscle}`);
      }
    }
    
    muscleQueue = nextMuscleQueue;
    currentRound++;
  }

  console.log(`[TargetedBucketing] Phase 1 complete: ${selected.length} exercises selected via round-robin`);

  // Phase 2: Movement Pattern Diversity (remaining slots up to 13)
  const targetTotal = 13;
  const remainingSlots = targetTotal - selected.length;
  
  if (remainingSlots > 0) {
    console.log(`[TargetedBucketing] Phase 2: Filling ${remainingSlots} slots with movement diversity`);
    
    // Count current movement patterns
    const patternCounts = getMovementPatternCounts([...preAssigned.map(p => p.exercise), ...selected]);
    const allPatterns = getAllMovementPatterns();
    
    // Find missing patterns first, then underrepresented ones
    const missingPatterns = allPatterns.filter(pattern => !patternCounts.has(pattern));
    const existingPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => a[1] - b[1]) // Sort by count ascending
      .map(([pattern]) => pattern);
    
    // Prioritize missing patterns, then underrepresented ones
    const patternsToFill = [...missingPatterns, ...existingPatterns];
    
    console.log(`[TargetedBucketing] Missing patterns: ${missingPatterns.join(", ")}`);
    console.log(`[TargetedBucketing] Pattern priority: ${patternsToFill.slice(0, remainingSlots).join(", ")}`);
    
    for (const pattern of patternsToFill) {
      if (selected.length >= targetTotal) break;
      
      // Find exercises that:
      // 1. Match this movement pattern
      // 2. Match one of the target muscles
      // 3. Haven't been used
      const candidates = availableExercises.filter((ex) =>
        !usedIds.has(ex.id) &&
        !preAssignedIds.has(ex.id) &&
        ex.movementPattern?.toLowerCase() === pattern &&
        consolidatedTargets.some(muscle => 
          exerciseMatchesMusclePreference(ex.primaryMuscle, muscle)
        )
      );
      
      const result = selectWithTieBreaking(candidates, pattern);
      
      if (result) {
        selected.push(result.exercise);
        usedIds.add(result.exercise.id);
        bucketAssignments[result.exercise.id] = {
          bucketType: "movement_diversity",
          constraint: pattern,
          tiedCount: result.tiedCount,
        };
        
        console.log(`[TargetedBucketing] Movement diversity: Selected "${result.exercise.name}" for pattern ${pattern}`);
      }
    }
  }

  console.log(`[TargetedBucketing] Final selection: ${selected.length} exercises`);

  return {
    exercises: selected,
    bucketAssignments,
  };
}