export interface WorkoutSection {
  name: string;
  description?: string;
  exerciseCount: { min: number; max: number };
  setGuidance?: string;
}

export interface WorkoutStructure {
  sections: WorkoutSection[];
  totalExerciseLimit?: number;
}

export interface PromptConfig {
  includeExamples?: boolean;
  emphasizeRequestedExercises?: boolean;
  strictExerciseLimit?: boolean;
  workoutStructure?: WorkoutStructure;
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