import { Annotation } from "@langchain/langgraph";
import type { Exercise } from "./exercise";

// Filter criteria interface
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
  filterCriteria: Annotation<FilterCriteria>,
  filteredExercises: Annotation<Exercise[]>
});

export type WorkoutStateType = typeof WorkoutState.State;