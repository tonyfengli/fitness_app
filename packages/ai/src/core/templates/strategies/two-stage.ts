/**
 * Two-stage workout generation strategy
 * Stage 1: Exercise selection
 * Stage 2: Workout programming
 */

import { generateExerciseSelectionPrompt, parseExerciseSelectionResponse } from '../../../workout-generation/prompts/stages/exercise-selection';
import { generateWorkoutProgrammingPrompt, parseWorkoutProgrammingResponse } from '../../../workout-generation/prompts/stages/workout-programming';
import type { Stage1Input, Stage1Output, Stage2Input, Stage2Output } from '../types';

export interface TwoStageInput {
  groupContext: any;
  blueprint: any;
  includeFinisher: boolean;
}

export interface TwoStageOutput {
  stage1Result: Stage1Output;
  stage2Result: Stage2Output;
  workout: any;
}

/**
 * Execute two-stage workout generation
 */
export async function executeTwoStage(
  input: TwoStageInput,
  llmCall: (prompt: string) => Promise<string>
): Promise<TwoStageOutput> {
  // Stage 1: Exercise Selection
  const stage1Input: Stage1Input = {
    clients: input.groupContext.clients,
    blueprint: input.blueprint,
    deterministicAssignments: {}, // TODO: Get from blueprint
    includeFinisher: input.includeFinisher
  };
  
  const stage1Prompt = generateExerciseSelectionPrompt(stage1Input);
  const stage1Response = await llmCall(stage1Prompt);
  const stage1Output = parseExerciseSelectionResponse(stage1Response);
  
  // Stage 2: Workout Programming
  const stage2Input: Stage2Input = {
    selections: stage1Output.selections,
    clients: input.groupContext.clients,
    blockStructure: input.blueprint.blocks,
    workoutDuration: 40 // TODO: Calculate from blocks
  };
  
  const stage2Prompt = generateWorkoutProgrammingPrompt(stage2Input);
  const stage2Response = await llmCall(stage2Prompt);
  const stage2Output = parseWorkoutProgrammingResponse(stage2Response);
  
  return {
    stage1Result: stage1Output,
    stage2Result: stage2Output,
    workout: {
      // Combine results into final workout format
      blocks: stage2Output.blocks,
      metadata: {
        stage1: stage1Output,
        stage2: stage2Output
      }
    }
  };
}