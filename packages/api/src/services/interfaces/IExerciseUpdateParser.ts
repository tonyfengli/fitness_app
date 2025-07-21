export interface ExerciseUpdateIntent {
  action: 'add' | 'remove' | 'unknown';
  exercises: string[];
  rawInput: string;
}

export interface IExerciseUpdateParser {
  parseExerciseUpdate(message: string): Promise<ExerciseUpdateIntent>;
}