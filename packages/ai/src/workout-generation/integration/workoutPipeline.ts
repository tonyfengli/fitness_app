import type { ClientContext } from "../../types/clientContext";
import type { Exercise } from "@acme/db/schema";
import { generateWorkoutFromExercises } from "../generateWorkoutFromExercises";
import { transformLLMOutputToDB, validateExerciseLookup } from "../transformers/workoutTransformer";
import type { LLMWorkoutOutput, WorkoutDBFormat } from "../transformers/workoutTransformer";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { WorkoutInterpretationStateType } from "../types";

/**
 * Complete workout generation pipeline
 * Takes client context and exercises, generates workout, and prepares for database storage
 */
export interface WorkoutPipelineInput {
  clientContext: ClientContext;
  exercises: {
    blockA?: ScoredExercise[];
    blockB?: ScoredExercise[];
    blockC?: ScoredExercise[];
    blockD?: ScoredExercise[];
  };
  exerciseLookup: Map<string, Exercise>;
  workoutName?: string;
  workoutDescription?: string;
}

export interface WorkoutPipelineOutput {
  success: boolean;
  llmOutput?: LLMWorkoutOutput;
  dbFormat?: WorkoutDBFormat;
  validation?: {
    valid: boolean;
    missingExercises: string[];
    warnings: string[];
  };
  error?: string;
  timing?: Record<string, number>;
}

/**
 * Run the complete workout generation pipeline
 */
export async function runWorkoutPipeline(
  input: WorkoutPipelineInput
): Promise<WorkoutPipelineOutput> {
  try {
    const startTime = performance.now();
    
    // Step 1: Generate workout using LLM
    const state: WorkoutInterpretationStateType = {
      exercises: input.exercises,
      clientContext: input.clientContext
    };
    
    console.log('🚀 Starting workout pipeline for:', input.clientContext.name);
    console.log('📋 Template type:', input.clientContext.templateType || 'standard');
    
    const llmResult = await generateWorkoutFromExercises(state);
    
    if (llmResult.error) {
      return {
        success: false,
        error: llmResult.error
      };
    }
    
    if (!llmResult.structuredOutput) {
      return {
        success: false,
        error: 'No structured output from LLM'
      };
    }
    
    // Check if the structured output is an error
    if (llmResult.structuredOutput.error) {
      return {
        success: false,
        error: llmResult.structuredOutput.error
      };
    }
    
    const llmOutput = llmResult.structuredOutput as LLMWorkoutOutput;
    
    // Step 2: Validate exercises exist in database
    const validation = validateExerciseLookup(llmOutput, input.exerciseLookup);
    
    if (!validation.valid) {
      console.warn('⚠️ Some exercises not found in database:', validation.missingExercises);
    }
    
    // Step 3: Transform to database format
    const dbFormat = await transformLLMOutputToDB(
      llmOutput,
      input.exerciseLookup,
      input.clientContext.templateType || 'standard',
      input.workoutName,
      input.workoutDescription
    );
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log('✅ Workout pipeline completed successfully');
    console.log(`⏱️ Total pipeline time: ${totalTime.toFixed(2)}ms`);
    
    return {
      success: true,
      llmOutput,
      dbFormat,
      validation,
      timing: {
        ...llmResult.timing,
        totalPipeline: totalTime
      }
    };
  } catch (error) {
    console.error('❌ Workout pipeline error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in workout pipeline'
    };
  }
}

/**
 * Helper function to prepare the data for the saveWorkout API endpoint
 */
export function prepareWorkoutForAPI(
  pipelineOutput: WorkoutPipelineOutput,
  trainingSessionId: string,
  userId: string
) {
  if (!pipelineOutput.success || !pipelineOutput.dbFormat) {
    throw new Error('Pipeline output is not valid for API submission');
  }
  
  return {
    trainingSessionId,
    userId,
    llmOutput: pipelineOutput.llmOutput,
    workoutType: pipelineOutput.dbFormat.workout.workoutType,
    workoutName: pipelineOutput.dbFormat.workout.name,
    workoutDescription: pipelineOutput.dbFormat.workout.description
  };
}