import { Annotation } from "@langchain/langgraph";
import type { Exercise } from "./exercise";

// Define state using the annotation API
export const WorkoutState = Annotation.Root({
  userInput: Annotation<string>,
  workoutPlan: Annotation<string>,
  exercises: Annotation<Exercise[]>
});

export type WorkoutStateType = typeof WorkoutState.State;