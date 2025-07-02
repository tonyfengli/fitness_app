import type { WorkoutRoutineStateType } from "../types";
import { validateOpenAIConfig } from "../utils/llm";

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
export async function llmPreferenceNode(state: WorkoutRoutineStateType) {
  try {
    // Extract data from state
    const { 
      filteredExercises, 
      userInput,
      clientContext,
      routineTemplate 
    } = state;
    
    if (!filteredExercises || filteredExercises.length === 0) {
      throw new LLMPreferenceError('No filtered exercises available for LLM preference scoring');
    }
    
    console.log(
      `🤖 LLM preference node: Processing ${filteredExercises.length} rules-filtered exercises`,
      {
        clientName: clientContext?.name || 'Unknown',
        userInput: userInput || 'No user input',
        filteringType: 'LLM-based (preference scoring)',
        exerciseCount: filteredExercises.length,
        clientGoal: clientContext?.primary_goal || 'Not specified',
        routineGoal: routineTemplate?.routine_goal || 'Not specified',
        routineMuscleTargets: routineTemplate?.muscle_target?.length || 0
      }
    );
    
    // Check if OpenAI is configured for future LLM processing
    try {
      validateOpenAIConfig();
      console.log('✅ OpenAI configuration valid - ready for LLM scoring');
    } catch (_error) {
      console.log('⚠️  OpenAI not configured - using pass-through mode');
    }
    
    // TODO: Add LLM-based scoring logic here when OpenAI is available
    // if (openAIAvailable) {
    //   const scoredExercises = await scoreExercisesWithLLM(filteredExercises, clientContext, userInput);
    //   return { filteredExercises: scoredExercises };
    // }
    
    // For now, pass through the exercises unchanged
    // This will be replaced with actual LLM scoring logic
    console.log('📤 LLM preference node: Passing through exercises (no scoring applied yet)');
    
    return {
      ...state, // Preserve all existing state
      filteredExercises: filteredExercises, // Keep the filtered exercises (no scoring applied yet)
    };
  } catch (error) {
    // Re-throw known errors without wrapping
    if (error instanceof LLMPreferenceError) {
      throw error;
    }
    
    // Wrap unknown errors with context
    throw new LLMPreferenceError(
      'Unexpected error during LLM preference processing',
      error
    );
  }
}