import type { Stage1Input } from '../../../core/templates/types';

/**
 * Stage 1: Exercise Selection Prompt Generator
 * This stage selects exercises for each client based on their preferences
 */
export function generateExerciseSelectionPrompt(input: Stage1Input): string {
  // Placeholder prompt for now
  return `This is the exercise selection prompt for Stage 1.
  
Clients: ${input.clients.map(c => c.name).join(', ')}
Include Finisher: ${input.includeFinisher}

TODO: Implement actual prompt generation logic.`;
}

/**
 * Parse the LLM response from Stage 1
 */
export function parseExerciseSelectionResponse(response: string): any {
  // Placeholder parser
  return {
    selections: {},
    reasoning: "Placeholder parsing"
  };
}