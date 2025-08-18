import { Annotation } from "@langchain/langgraph";

// Define the structure for exercises coming from frontend
export interface TopExercise {
  id: string;
  name: string;
  score: number;
  tags: string[];
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  equipment?: string[];
  difficulty?: string;
  instructions?: string[];
  benefits?: string[];
}

export interface ExercisesByBlock {
  blockA: TopExercise[];
  blockB: TopExercise[];
  blockC: TopExercise[];
  blockD: TopExercise[];
}

// Define the state for the workout interpretation graph
export const WorkoutInterpretationState = Annotation.Root({
  // Input from frontend
  exercises: Annotation<ExercisesByBlock>,
  clientContext: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // LLM interpretation result
  interpretation: Annotation<string>({
    default: () => "",
    reducer: (x, y) => y || x,
  }),

  // Structured output (format TBD based on your needs)
  structuredOutput: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // Timing information
  timing: Annotation<Record<string, number>>({
    default: () => ({}),
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // Error handling
  error: Annotation<string | null>({
    default: () => null,
    reducer: (x, y) => y || x,
  }),
});

export type WorkoutInterpretationStateType =
  typeof WorkoutInterpretationState.State;
