import type { WorkoutStateType } from "../types";
import { openAILLM, validateOpenAIConfig } from "../utils/llm";

export class LLMPreferenceError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'LLMPreferenceError';
  }
}

/**
 * LangGraph node that applies LLM-based preference scoring to exercises
 * Uses AI to score and soft-filter exercises based on user preferences and context
 * @param state - Current workflow state containing filtered exercises from rulesBasedFilterNode
 * @returns Updated state with LLM-scored and preference-filtered exercises
 * @throws {LLMPreferenceError} If LLM processing fails
 */
export async function llmPreferenceNode(state: WorkoutStateType) {
  try {
    // Validate OpenAI configuration
    validateOpenAIConfig();
    
    // Extract data from state
    const { 
      filteredExercises, 
      userInput,
      clientContext 
    } = state;
    
    if (!filteredExercises || filteredExercises.length === 0) {
      throw new LLMPreferenceError('No filtered exercises available for LLM preference scoring');
    }
    
    console.log(
      `LLM preference node: Processing ${filteredExercises.length} rules-filtered exercises`,
      {
        clientName: clientContext?.name || 'Unknown',
        userInput: userInput || 'No user input',
        filteringType: 'LLM-based (preference scoring)',
        exerciseCount: filteredExercises.length
      }
    );
    
    // TODO: Add LLM-based scoring logic here
    // const scoredExercises = await scoreExercisesWithLLM(filteredExercises, clientContext, userInput);
    
    // For now, pass through the exercises unchanged
    // This will be replaced with actual LLM scoring logic
    return {
      filteredExercises: filteredExercises,
    };
  } catch (error) {
    if (error instanceof LLMPreferenceError) {
      throw error;
    }
    throw new LLMPreferenceError(
      'Unexpected error during LLM preference processing',
      error
    );
  }
}