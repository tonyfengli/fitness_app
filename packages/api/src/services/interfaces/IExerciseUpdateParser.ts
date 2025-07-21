export interface ExerciseUpdateIntent {
  action: 'add' | 'remove' | 'unknown';
  exercises: string[];
  rawInput: string;
  validationResult?: any; // Original validation result to avoid re-validation
}

export interface IExerciseUpdateParser {
  parseExerciseUpdate(message: string): Promise<ExerciseUpdateIntent>;
}