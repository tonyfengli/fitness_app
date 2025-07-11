import { Annotation } from "@langchain/langgraph";
import type { Exercise } from "./exercise";
import type { ScoredExercise } from "./scoredExercise";
import type { ClientContext } from "./clientContext";
import type { WorkoutTemplate } from "./workoutTemplate";


// Define state using the annotation API
export const WorkoutSessionState = Annotation.Root({
  userInput: Annotation<string>,
  programmedRoutine: Annotation<string>,
  exercises: Annotation<Exercise[]>,
  clientContext: Annotation<ClientContext>,
  filteredExercises: Annotation<ScoredExercise[]>,
  workoutTemplate: Annotation<WorkoutTemplate>
});

export type WorkoutSessionStateType = typeof WorkoutSessionState.State;