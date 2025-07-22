import type { GroupContext } from "../types/groupContext";
import type { GroupWorkoutBlueprint } from "../types/groupBlueprint";
import type { ScoredExercise } from "../core/scoring/types";
import type { Exercise } from "../types/exercise";
import { filterExercises } from "../core/filtering/filterExercises";
import { scoreExercises } from "../core/scoring/scoreExercises";
import { performGroupMergeScoring } from "../core/group-scoring/mergeScores";
import { GroupWorkoutTemplateHandler } from "../core/templates/GroupWorkoutTemplateHandler";
import { getExercises } from "../data/exercises";

/**
 * Generates a group workout blueprint by running Phases 1-4
 * This is the main entry point for group workout generation
 */
export async function generateGroupWorkoutBlueprint(
  groupContext: GroupContext,
  exercises?: Exercise[]
): Promise<GroupWorkoutBlueprint> {
  // Get exercises if not provided
  const exercisePool = exercises || await getExercises();
  
  // Phase 1 & 2: Filter and score for each client
  const clientScoredExercises = new Map<string, ScoredExercise[]>();
  const clientExercisesByBlock = new Map<string, { [blockId: string]: ScoredExercise[] }>();
  
  for (const client of groupContext.clients) {
    // Phase 1: Filter exercises for this client
    const filtered = await filterExercises(exercisePool, client);
    
    // Phase 2: Score exercises for this client
    const scored = await scoreExercises(filtered, {
      intensity: client.intensity,
      muscle_target: client.muscle_target,
      muscle_lessen: client.muscle_lessen,
      exercise_requests: client.exercise_requests
    });
    
    clientScoredExercises.set(client.user_id, scored);
  }
  
  // Get template configuration
  const template = {
    id: groupContext.templateType || 'workout',
    name: groupContext.templateType || 'Standard Workout'
  };
  
  // Create template handler to get block configs
  const tempHandler = new GroupWorkoutTemplateHandler(groupContext, template);
  const blockConfigs = (tempHandler as any).blockConfigs; // Access private property for now
  
  // Organize exercises by block for Phase 2.5
  for (const [clientId, exercises] of clientScoredExercises) {
    const byBlock: { [blockId: string]: ScoredExercise[] } = {};
    
    for (const block of blockConfigs) {
      // Filter exercises by block function tags
      byBlock[block.id] = exercises.filter(ex => 
        block.functionTags.some(tag => ex.function_tags?.includes(tag))
      );
    }
    
    clientExercisesByBlock.set(clientId, byBlock);
  }
  
  // Phase 2.5: Group merge scoring
  const updatedContext = performGroupMergeScoring(
    groupContext,
    blockConfigs,
    clientExercisesByBlock
  );
  
  // Phase 4: Create blueprint
  const handler = new GroupWorkoutTemplateHandler(updatedContext, template);
  const blueprint = handler.createBlueprint(clientScoredExercises);
  
  return blueprint;
}