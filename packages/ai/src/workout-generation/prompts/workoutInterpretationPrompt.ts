import { WorkoutPromptBuilder } from './promptBuilder';

// Default system prompt using the builder
export const WORKOUT_INTERPRETATION_SYSTEM_PROMPT = WorkoutPromptBuilder.buildDefault();

// Export the builder for custom configurations
export { WorkoutPromptBuilder } from './promptBuilder';
export type { PromptConfig } from './types';