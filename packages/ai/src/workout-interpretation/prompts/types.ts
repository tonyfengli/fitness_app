export interface PromptConfig {
  includeExamples?: boolean;
  emphasizeRequestedExercises?: boolean;
  strictExerciseLimit?: boolean;
  customSections?: {
    role?: string;
    rules?: string;
    context?: string;
    constraints?: string;
    outputFormat?: string;
    examples?: string;
    instructions?: string;
  };
}