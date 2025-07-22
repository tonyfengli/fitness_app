import type { GroupScoredExercise, GroupContext } from "../../types/groupContext";

/**
 * Analyzes group exercise pools to provide insights about overlap and cohesion
 */
export interface CohesionAnalysis {
  blockId: string;
  totalExercises: number;
  exercisesWithFullGroup: number;      // All clients have it
  exercisesWithMajority: number;       // >50% of clients have it
  exercisesWithMinority: number;       // <=50% of clients have it
  averageClientsPerExercise: number;
  cohesionScore: number;               // 0-1 score indicating group overlap
}

/**
 * Analyzes cohesion metrics for a block's group exercise pool
 */
export function analyzeBlockCohesion(
  exercises: GroupScoredExercise[],
  totalClients: number
): CohesionAnalysis {
  if (exercises.length === 0) {
    return {
      blockId: '',
      totalExercises: 0,
      exercisesWithFullGroup: 0,
      exercisesWithMajority: 0,
      exercisesWithMinority: 0,
      averageClientsPerExercise: 0,
      cohesionScore: 0
    };
  }
  
  let exercisesWithFullGroup = 0;
  let exercisesWithMajority = 0;
  let exercisesWithMinority = 0;
  let totalClientCoverage = 0;
  
  const majorityThreshold = Math.ceil(totalClients / 2);
  
  for (const exercise of exercises) {
    const numClients = exercise.clientsSharing.length;
    totalClientCoverage += numClients;
    
    if (numClients === totalClients) {
      exercisesWithFullGroup++;
    } else if (numClients >= majorityThreshold) {
      exercisesWithMajority++;
    } else {
      exercisesWithMinority++;
    }
  }
  
  const averageClientsPerExercise = totalClientCoverage / exercises.length;
  const cohesionScore = averageClientsPerExercise / totalClients;
  
  return {
    blockId: '',
    totalExercises: exercises.length,
    exercisesWithFullGroup,
    exercisesWithMajority,
    exercisesWithMinority,
    averageClientsPerExercise,
    cohesionScore
  };
}

/**
 * Finds exercises that meet a minimum client overlap threshold
 */
export function findSharedExerciseCandidates(
  exercises: GroupScoredExercise[],
  minClientsRequired: number
): GroupScoredExercise[] {
  return exercises.filter(ex => ex.clientsSharing.length >= minClientsRequired);
}

/**
 * Calculates how many shared exercises each client would need
 * based on their cohesion ratio preference
 */
export function calculateClientSharedExerciseTargets(
  context: GroupContext,
  totalExercisesPerWorkout: number
): Map<string, number> {
  const targets = new Map<string, number>();
  
  for (const client of context.clients) {
    const cohesionRatio = context.clientGroupSettings[client.user_id]?.cohesionRatio || 0.5;
    const targetSharedExercises = Math.round(totalExercisesPerWorkout * cohesionRatio);
    targets.set(client.user_id, targetSharedExercises);
  }
  
  return targets;
}

/**
 * Validates if group cohesion settings can be satisfied
 * Returns warnings if certain blocks have insufficient overlap
 */
export function validateGroupCohesion(
  context: GroupContext,
  blockAnalyses: Map<string, CohesionAnalysis>
): string[] {
  const warnings: string[] = [];
  
  for (const [blockId, settings] of Object.entries(context.groupCohesionSettings.blockSettings)) {
    const analysis = blockAnalyses.get(blockId);
    
    if (!analysis) continue;
    
    // Check if we have enough shared exercises for the target ratio
    const minSharedNeeded = Math.ceil(settings.sharedRatio * context.clients.length);
    const availableShared = analysis.exercisesWithMajority + analysis.exercisesWithFullGroup;
    
    if (settings.enforceShared && availableShared === 0) {
      warnings.push(
        `Block ${blockId}: No shared exercises available but enforceShared is true`
      );
    }
    
    if (availableShared < minSharedNeeded) {
      warnings.push(
        `Block ${blockId}: Needs ${minSharedNeeded} shared exercises but only ${availableShared} available`
      );
    }
  }
  
  return warnings;
}