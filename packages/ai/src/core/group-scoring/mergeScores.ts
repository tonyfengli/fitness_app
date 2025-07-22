import type { ScoredExercise } from "../scoring/types";
import type { GroupScoredExercise, GroupContext } from "../../types/groupContext";
import type { BlockConfig } from "../templates/types/dynamicBlockTypes";

/**
 * Calculates the cohesion bonus based on number of clients sharing an exercise
 * Formula: (numClientsSharing - 1) * 0.5
 */
export function calculateCohesionBonus(numClientsSharing: number): number {
  return Math.max(0, (numClientsSharing - 1) * 0.5);
}

/**
 * Collects top exercises from each client for the group pool
 * Takes approximately 1.5x the block's max exercises to ensure overlap potential
 */
export function collectExercisesForGroupPool(
  block: BlockConfig,
  clientExercises: Map<string, ScoredExercise[]>
): Map<string, ScoredExercise[]> {
  const poolSizePerClient = Math.ceil(block.maxExercises * 1.5);
  const collectedExercises = new Map<string, ScoredExercise[]>();
  
  for (const [clientId, exercises] of clientExercises) {
    // Take top N exercises, but not more than available
    const topExercises = exercises.slice(0, Math.min(poolSizePerClient, exercises.length));
    collectedExercises.set(clientId, topExercises);
  }
  
  return collectedExercises;
}

/**
 * Merges individual client scores into a group pool with cohesion bonuses
 */
export function mergeClientScoresIntoGroupPool(
  clientExercises: Map<string, ScoredExercise[]>,
  clientIds: string[]
): GroupScoredExercise[] {
  // Track all unique exercises across clients
  const exerciseMap = new Map<string, {
    exercise: ScoredExercise;
    clientScores: Map<string, number>;
  }>();
  
  // Collect all exercises and their scores per client
  for (const [clientId, exercises] of clientExercises) {
    for (const exercise of exercises) {
      const key = exercise.id;
      
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          exercise,
          clientScores: new Map()
        });
      }
      
      exerciseMap.get(key)!.clientScores.set(clientId, exercise.score);
    }
  }
  
  // Convert to GroupScoredExercise array
  const groupExercises: GroupScoredExercise[] = [];
  
  for (const [exerciseId, data] of exerciseMap) {
    const { exercise, clientScores } = data;
    const clientsSharing = Array.from(clientScores.keys());
    const numClientsSharing = clientsSharing.length;
    
    // Calculate average score (only for clients who have the exercise)
    const scoreSum = Array.from(clientScores.values()).reduce((sum, score) => sum + score, 0);
    const averageScore = scoreSum / numClientsSharing;
    
    // Calculate cohesion bonus
    const cohesionBonus = calculateCohesionBonus(numClientsSharing);
    
    // Calculate final group score
    const groupScore = averageScore + cohesionBonus;
    
    // Build client scores array with all clients (including those who don't have it)
    const allClientScores = clientIds.map(clientId => ({
      clientId,
      individualScore: clientScores.get(clientId) || 0,
      hasExercise: clientScores.has(clientId)
    }));
    
    groupExercises.push({
      ...exercise,
      groupScore,
      clientScores: allClientScores,
      cohesionBonus,
      clientsSharing
    });
  }
  
  // Sort by group score (descending)
  return groupExercises.sort((a, b) => b.groupScore - a.groupScore);
}

/**
 * Main function to perform Phase 2.5: Group Merge Scoring
 * Takes scored exercises from all clients and creates group pools per block
 */
export function performGroupMergeScoring(
  context: GroupContext,
  blockConfigs: BlockConfig[],
  clientScoredExercises: Map<string, { [blockId: string]: ScoredExercise[] }>
): GroupContext {
  const groupExercisePools: { [blockId: string]: GroupScoredExercise[] } = {};
  const clientIds = context.clients.map(c => c.user_id);
  
  for (const block of blockConfigs) {
    // Collect exercises from each client for this block
    const blockExercisesByClient = new Map<string, ScoredExercise[]>();
    
    for (const [clientId, clientBlocks] of clientScoredExercises) {
      const exercises = clientBlocks[block.id] || [];
      blockExercisesByClient.set(clientId, exercises);
    }
    
    // Collect top exercises from each client
    const collectedExercises = collectExercisesForGroupPool(block, blockExercisesByClient);
    
    // Merge into group pool with cohesion scoring
    const groupPool = mergeClientScoresIntoGroupPool(collectedExercises, clientIds);
    
    groupExercisePools[block.id] = groupPool;
  }
  
  // Return updated context with group pools
  return {
    ...context,
    groupExercisePools
  };
}