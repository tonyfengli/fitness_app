#!/usr/bin/env ts-node

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Utility functions to query group workout data efficiently
 * 
 * Usage examples:
 * 
 * 1. Get all exercises for a specific client in a specific block:
 *    const exercises = await getClientBlockExercises('latest-group-workout.json', 'Curtis Yu', 'A');
 * 
 * 2. Get just exercise names and scores:
 *    const simplified = await getClientBlockExercisesSimplified('latest-group-workout.json', 'Curtis Yu', 'A');
 * 
 * 3. Compare exercises across clients in a block:
 *    const comparison = await compareClientsInBlock('latest-group-workout.json', 'A');
 */

interface GroupWorkoutData {
  phaseB: {
    blocks: Array<{
      blockId: string;
      blockName: string;
      slotAllocation: any;
      sharedExercises: any[];
      individualExercises: {
        [clientId: string]: {
          clientName: string;
          exercises: Array<{
            exerciseId: string;
            exerciseName: string;
            individualScore: number;
            scoreBreakdown?: any;
            isSelected: boolean;
            rank: number;
          }>;
          totalCount: number;
        };
      };
    }>;
  };
}

/**
 * Load group workout data from file
 */
async function loadGroupWorkoutData(filename: string): Promise<GroupWorkoutData> {
  const filepath = path.join(process.cwd(), 'session-test-data', 'group-workouts', filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get all exercises for a specific client in a specific block
 */
export async function getClientBlockExercises(
  filename: string,
  clientName: string,
  blockId: string
) {
  const data = await loadGroupWorkoutData(filename);
  
  const block = data.phaseB.blocks.find(b => b.blockId === blockId);
  if (!block) {
    throw new Error(`Block ${blockId} not found`);
  }
  
  for (const [clientId, clientData] of Object.entries(block.individualExercises)) {
    if (clientData.clientName === clientName) {
      return {
        clientName,
        blockId,
        totalCount: clientData.totalCount,
        exercises: clientData.exercises
      };
    }
  }
  
  throw new Error(`Client ${clientName} not found in block ${blockId}`);
}

/**
 * Get simplified exercise list (just names and scores)
 */
export async function getClientBlockExercisesSimplified(
  filename: string,
  clientName: string,
  blockId: string
) {
  const result = await getClientBlockExercises(filename, clientName, blockId);
  
  return {
    clientName,
    blockId,
    totalCount: result.totalCount,
    exercises: result.exercises.map(ex => ({
      rank: ex.rank,
      name: ex.exerciseName,
      score: ex.individualScore,
      selected: ex.isSelected
    }))
  };
}

/**
 * Compare all clients' exercises in a specific block
 */
export async function compareClientsInBlock(filename: string, blockId: string) {
  const data = await loadGroupWorkoutData(filename);
  
  const block = data.phaseB.blocks.find(b => b.blockId === blockId);
  if (!block) {
    throw new Error(`Block ${blockId} not found`);
  }
  
  const comparison: any = {
    blockId,
    blockName: block.blockName,
    slotAllocation: block.slotAllocation,
    sharedExercises: block.sharedExercises.map(ex => ({
      name: ex.exerciseName,
      groupScore: ex.groupScore,
      sharedBy: ex.clientsSharing.length
    })),
    clientExercises: {}
  };
  
  for (const [clientId, clientData] of Object.entries(block.individualExercises)) {
    comparison.clientExercises[clientData.clientName] = {
      totalCount: clientData.totalCount,
      exercises: clientData.exercises.map(ex => ({
        rank: ex.rank,
        name: ex.exerciseName,
        score: ex.individualScore,
        selected: ex.isSelected
      }))
    };
  }
  
  return comparison;
}

/**
 * Get all blocks summary for a client
 */
export async function getClientAllBlocks(filename: string, clientName: string) {
  const data = await loadGroupWorkoutData(filename);
  
  const clientBlocks: any[] = [];
  
  for (const block of data.phaseB.blocks) {
    for (const [clientId, clientData] of Object.entries(block.individualExercises)) {
      if (clientData.clientName === clientName) {
        clientBlocks.push({
          blockId: block.blockId,
          blockName: block.blockName,
          exerciseCount: clientData.totalCount,
          selectedCount: clientData.exercises.filter(ex => ex.isSelected).length,
          scoreRange: {
            min: Math.min(...clientData.exercises.map(ex => ex.individualScore)),
            max: Math.max(...clientData.exercises.map(ex => ex.individualScore))
          }
        });
        break;
      }
    }
  }
  
  return {
    clientName,
    blocks: clientBlocks
  };
}

// Example usage (uncomment to test)
// async function main() {
//   try {
//     // Get Curtis Yu's Block A exercises
//     const curtisBlockA = await getClientBlockExercisesSimplified('latest-group-workout.json', 'Curtis Yu', 'A');
//     console.log('Curtis Yu - Block A:');
//     console.log(JSON.stringify(curtisBlockA, null, 2));
//     
//     // Compare all clients in Block A
//     const blockAComparison = await compareClientsInBlock('latest-group-workout.json', 'A');
//     console.log('\nBlock A Comparison:');
//     console.log(JSON.stringify(blockAComparison, null, 2));
//     
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }
// 
// main();