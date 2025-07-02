import { Annotation } from "@langchain/langgraph";
import type { Exercise } from "./exercise";
import type { ClientContext } from "./clientContext";

// Legacy filter criteria interface (for backward compatibility)
export interface FilterCriteria {
  strength?: string;
  skill?: string;
  intensity?: string;
}

// Define state using the annotation API
export const WorkoutState = Annotation.Root({
  userInput: Annotation<string>,
  workoutPlan: Annotation<string>,
  exercises: Annotation<Exercise[]>,
  clientContext: Annotation<ClientContext>,
  filteredExercises: Annotation<Exercise[]>
});

export type WorkoutStateType = typeof WorkoutState.State;