/**
 * Main entry point for group workout generation with LLM
 * This takes the blueprint from Phase B and generates the final workout
 */

import type { GroupWorkoutBlueprint } from "../types/groupBlueprint";
import type { GroupContext } from "../types/groupContext";
import type { GroupWorkout } from "../workout-generation/group/types/groupWorkout";
import { HybridLLMStrategy } from "../workout-generation/group/hybridLLMStrategy";

/**
 * Generate a complete group workout from the blueprint using LLM
 */
export async function generateGroupWorkout(
  blueprint: GroupWorkoutBlueprint,
  groupContext: GroupContext
): Promise<GroupWorkout> {
  console.log('🎯 generateGroupWorkout called');
  console.log(`   Session: ${groupContext.sessionId}`);
  console.log(`   Clients: ${groupContext.clients.length}`);
  console.log(`   Blocks: ${blueprint.blocks.length}`);
  
  try {
    // Initialize the hybrid LLM strategy
    const strategy = new HybridLLMStrategy();
    
    // Generate the group workout
    const groupWorkout = await strategy.generateGroupWorkout(
      blueprint.blocks,
      groupContext.clients,
      undefined, // No cohesion settings for now
      groupContext.sessionId
    );
    
    // Log success metrics
    console.log('✅ Group workout generated successfully');
    console.log(`   Shared exercises: ${groupWorkout.sharedSelections.selections.reduce((sum, s) => sum + s.exercises.length, 0)}`);
    console.log(`   Average cohesion: ${groupWorkout.metadata.averageCohesion.toFixed(1)}%`);
    console.log(`   Total time: ${groupWorkout.metadata.llmCallDuration.total}ms`);
    
    return groupWorkout;
    
  } catch (error) {
    console.error('❌ Error generating group workout:', error);
    throw error;
  }
}