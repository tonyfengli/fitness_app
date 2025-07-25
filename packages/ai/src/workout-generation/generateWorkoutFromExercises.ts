import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { WorkoutInterpretationStateType, ExercisesByBlock, TopExercise } from "./types";
import { WorkoutPromptBuilder } from "./prompts/promptBuilder";
import type { LLMProvider } from "../config/llm";
import { createLLM } from "../config/llm";
import { logBlock, logBlockTransformation } from "../utils/blockDebugger";
import { getWorkoutStructure } from "./templates/workoutTemplates";
import type { WorkoutTemplateType } from "./templates/workoutTemplates";
import { extractJSON } from "./group/utils/jsonExtraction";

// Global LLM instance that can be overridden for testing
let globalLLM: LLMProvider | undefined;

export function setInterpretationLLM(llm: LLMProvider): void {
  globalLLM = llm;
}

export function resetInterpretationLLM(): void {
  globalLLM = undefined;
}

/**
 * Generates a complete workout from the selected exercises using LLM
 * Takes organized exercises and client context, returns structured workout plan
 */
export async function generateWorkoutFromExercises(
  state: WorkoutInterpretationStateType
): Promise<Partial<WorkoutInterpretationStateType>> {
  const llm = globalLLM || createLLM();
  
  logBlock('generateWorkoutFromExercises - Start', {
    hasExercises: !!state.exercises,
    exerciseBlocks: state.exercises ? Object.keys(state.exercises) : [],
    clientContext: state.clientContext,
    templateType: state.clientContext?.templateType || 'standard'
  });
  
  try {
    const startTime = performance.now();
    const timing: any = {};
    
    const { exercises, clientContext } = state;
    
    // Validate input
    if (!exercises || Object.keys(exercises).length === 0) {
      logBlock('generateWorkoutFromExercises - No Exercises', {
        error: 'No exercises provided for workout generation'
      });
      return {
        error: "No exercises provided for interpretation",
      };
    }
    
    logBlock('generateWorkoutFromExercises - Input Exercises', {
      blockA: exercises.blockA?.length || 0,
      blockB: exercises.blockB?.length || 0,
      blockC: exercises.blockC?.length || 0,
      blockD: exercises.blockD?.length || 0,
      totalExercises: 
        (exercises.blockA?.length || 0) + 
        (exercises.blockB?.length || 0) + 
        (exercises.blockC?.length || 0) + 
        (exercises.blockD?.length || 0)
    });

    // Format exercises for the prompt
    const formatStartTime = performance.now();
    const formattedExercises = formatExercisesForPrompt(exercises);
    timing.exerciseFormatting = performance.now() - formatStartTime;
    
    // Use default sets from client context
    const defaultSets = clientContext?.default_sets || 20;
    
    // Build the system prompt - can be customized based on client context
    const promptBuildStartTime = performance.now();
    
    // Get the workout structure based on template type
    const templateType = clientContext?.templateType || 'standard';
    const workoutStructure = getWorkoutStructure(templateType as WorkoutTemplateType);
    
    logBlock('generateWorkoutFromExercises - Template Selection', {
      templateType,
      sections: workoutStructure.sections.map(s => ({
        name: s.name,
        exerciseCount: s.exerciseCount
      })),
      totalExerciseLimit: workoutStructure.totalExerciseLimit
    });
    
    const promptBuilder = new WorkoutPromptBuilder({
      // Use the workout structure from the template
      workoutStructure,
      // Enable strict exercise limit if client has specific requirements
      strictExerciseLimit: clientContext?.strictExerciseCount === true,
      // Emphasize requested exercises if they're provided
      emphasizeRequestedExercises: clientContext?.includeExercises?.length > 0,
      // Don't include examples by default (keeps prompt shorter)
      includeExamples: false
    });
    
    const systemPrompt = promptBuilder.build();

    // Build the user message
    const userMessage = `Here are the TOP exercises selected for each block:

${formattedExercises}

${clientContext && Object.keys(clientContext).length > 0 
  ? `\nClient Context:\n${JSON.stringify(clientContext, null, 2)}` 
  : ''}

Total Sets Target: ${defaultSets} sets

Please interpret these exercises according to the system instructions.`;
    timing.promptBuilding = performance.now() - promptBuildStartTime;

    // Call the LLM
    console.log('🤖 Calling LLM for workout interpretation...');
    
    logBlock('LLM Call - Request', {
      systemPromptLength: systemPrompt.length,
      userMessageLength: userMessage.length,
      totalSets: defaultSets
    });
    
    const llmStartTime = performance.now();
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);
    timing.llmApiCall = performance.now() - llmStartTime;

    const interpretation = response.content.toString();
    
    logBlock('LLM Call - Response', {
      responseLength: interpretation.length,
      responseTime: timing.llmApiCall,
      hasJSON: interpretation.includes('{') && interpretation.includes('}')
    });

    // Parse JSON response
    const parseStartTime = performance.now();
    const structuredOutput = extractJSON(interpretation) || { 
      error: "Failed to parse response as JSON", 
      raw: interpretation 
    };
    timing.responseParsing = performance.now() - parseStartTime;
    
    timing.total = performance.now() - startTime;
    
    // Log detailed timing breakdown
    console.log('⏱️ LLM Interpretation Timing Breakdown:');
    console.log(`   - Exercise formatting: ${timing.exerciseFormatting.toFixed(2)}ms`);
    console.log(`   - Prompt building: ${timing.promptBuilding.toFixed(2)}ms`);
    console.log(`   - LLM API call: ${timing.llmApiCall.toFixed(2)}ms (${(timing.llmApiCall/1000).toFixed(2)}s)`);
    console.log(`   - Response parsing: ${timing.responseParsing.toFixed(2)}ms`);
    console.log(`   - TOTAL: ${timing.total.toFixed(2)}ms (${(timing.total/1000).toFixed(2)}s)`);

    logBlockTransformation('generateWorkoutFromExercises - Complete',
      {
        inputExercises: {
          blockA: exercises.blockA?.length || 0,
          blockB: exercises.blockB?.length || 0,
          blockC: exercises.blockC?.length || 0,
          blockD: exercises.blockD?.length || 0
        }
      },
      {
        outputStructure: structuredOutput ? Object.keys(structuredOutput) : [],
        hasError: structuredOutput && 'error' in structuredOutput,
        timing: timing
      }
    );

    return {
      interpretation,
      structuredOutput,
      timing, // Include timing in the response
    };
  } catch (error) {
    console.error("Error in generateWorkoutFromExercises:", error);
    
    logBlock('generateWorkoutFromExercises - Error', {
      error: error instanceof Error ? error.message : "Unknown error occurred",
      errorType: error?.constructor?.name
    });
    
    return {
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Helper function to format exercises for the prompt
 */
function formatExercisesForPrompt(exercises: ExercisesByBlock): string {
  const blocks = ["blockA", "blockB", "blockC", "blockD"];
  let formatted = "";
  
  const blockSummary: Record<string, number> = {};

  for (const block of blocks) {
    const blockKey = block as keyof ExercisesByBlock;
    if (exercises[blockKey] && exercises[blockKey].length > 0) {
      blockSummary[block] = exercises[blockKey].length;
      formatted += `\n${block.toUpperCase()}:\n`;
      exercises[blockKey].forEach((ex: TopExercise, idx: number) => {
        formatted += `${idx + 1}. ${ex.name} (Score: ${ex.score})\n`;
        if (ex.tags && ex.tags.length > 0) {
          formatted += `   Tags: ${ex.tags.join(", ")}\n`;
        }
        if (ex.primaryMuscle) {
          formatted += `   Primary: ${ex.primaryMuscle}\n`;
        }
      });
    }
  }
  
  logBlock('formatExercisesForPrompt', {
    blockSummary,
    totalExercises: Object.values(blockSummary).reduce((sum, count) => sum + count, 0),
    formattedLength: formatted.length
  });

  return formatted.trim();
}

