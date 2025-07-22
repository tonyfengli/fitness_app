import type { ScoredExercise } from "../../types/scoredExercise";
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
  console.log('📊 Starting Phase 2.5: Group Merge Scoring');
  console.log(`  Processing ${blockConfigs.length} blocks for ${context.clients.length} clients`);
  
  const groupExercisePools: { [blockId: string]: GroupScoredExercise[] } = {};
  const clientIds = context.clients.map(c => c.user_id);
  
  // Get test data logger if available
  let testDataLogger: any;
  try {
    // Dynamic import to avoid circular dependencies
    const loggerModule = require('../../../../api/src/utils/groupWorkoutTestDataLogger');
    testDataLogger = loggerModule.groupWorkoutTestDataLogger;
  } catch (error) {
    console.debug('Test data logger not available in this context');
  }
  
  for (const block of blockConfigs) {
    console.log(`\n  🔄 Processing Block ${block.id} (${block.name}):`);
    
    // Collect exercises from each client for this block
    const blockExercisesByClient = new Map<string, ScoredExercise[]>();
    let totalExercisesInBlock = 0;
    
    for (const [clientId, clientBlocks] of clientScoredExercises) {
      const exercises = clientBlocks[block.id] || [];
      blockExercisesByClient.set(clientId, exercises);
      totalExercisesInBlock += exercises.length;
      console.log(`    Client ${clientId}: ${exercises.length} exercises available`);
    }
    
    if (totalExercisesInBlock === 0) {
      console.warn(`    ⚠️ Block ${block.id}: No exercises available from any client!`);
      groupExercisePools[block.id] = [];
      continue;
    }
    
    // Collect top exercises from each client
    console.log(`    Collecting top ${Math.ceil(block.maxExercises * 1.5)} exercises per client...`);
    const collectedExercises = collectExercisesForGroupPool(block, blockExercisesByClient);
    
    // Log collection results
    let totalCollected = 0;
    for (const [clientId, exercises] of collectedExercises) {
      totalCollected += exercises.length;
      console.log(`      Client ${clientId}: ${exercises.length} exercises collected`);
    }
    
    // Merge into group pool with cohesion scoring
    console.log(`    Merging ${totalCollected} exercises into group pool...`);
    const groupPool = mergeClientScoresIntoGroupPool(collectedExercises, clientIds);
    
    // Analyze overlap
    const sharedByAll = groupPool.filter(ex => ex.clientsSharing.length === clientIds.length);
    const sharedBy2Plus = groupPool.filter(ex => ex.clientsSharing.length >= 2);
    const uniqueToOne = groupPool.filter(ex => ex.clientsSharing.length === 1);
    
    console.log(`    ✅ Block ${block.id} merge complete:`);
    console.log(`       Total exercises in pool: ${groupPool.length}`);
    console.log(`       Shared by all clients: ${sharedByAll.length}`);
    console.log(`       Shared by 2+ clients: ${sharedBy2Plus.length}`);
    console.log(`       Unique to one client: ${uniqueToOne.length}`);
    
    // Log top exercises by group score
    if (groupPool.length > 0) {
      console.log(`       Top 3 exercises by group score:`);
      groupPool.slice(0, 3).forEach((ex, i) => {
        console.log(`         ${i + 1}. ${ex.name} (score: ${ex.groupScore.toFixed(2)}, shared by: ${ex.clientsSharing.length})`);
      });
    }
    
    // Log block scoring data for test data
    if (testDataLogger && context.sessionId) {
      const blockScoringData = {
        blockId: block.id,
        blockName: block.name,
        totalUniqueExercises: groupPool.length,
        exercisesPerClient: Array.from(blockExercisesByClient.entries()).map(([clientId, exercises]) => ({
          clientId,
          count: exercises.length
        })),
        overlapAnalysis: {
          sharedByAllClients: sharedByAll.map(ex => ex.id),
          sharedBy2Plus: sharedBy2Plus.map(ex => ex.id),
          uniqueToOneClient: uniqueToOne.map(ex => ex.id)
        },
        cohesionBonuses: sharedBy2Plus.map(ex => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          clientsSharing: ex.clientsSharing,
          averageScore: ex.groupScore - ex.cohesionBonus,
          cohesionBonus: ex.cohesionBonus,
          finalGroupScore: ex.groupScore
        })),
        qualityMetrics: {
          highQualityShared: sharedBy2Plus.filter(ex => ex.groupScore > 7).length,
          mediumQualityShared: sharedBy2Plus.filter(ex => ex.groupScore >= 5 && ex.groupScore <= 7).length,
          lowQualityShared: sharedBy2Plus.filter(ex => ex.groupScore < 5).length
        }
      };
      
      testDataLogger.logBlockScoring(
        context.sessionId,
        block.id,
        block.name,
        blockScoringData
      );
    }
    
    groupExercisePools[block.id] = groupPool;
  }
  
  console.log('\n✅ Phase 2.5 complete: Group exercise pools created for all blocks');
  
  // Return updated context with group pools
  return {
    ...context,
    groupExercisePools
  };
}