import { Annotation } from "@langchain/langgraph";
import type { Exercise } from "./exercise";
import type { ClientContext } from "./clientContext";
import type { RoutineTemplate } from "./routineTemplate";


// Define state using the annotation API
export const WorkoutRoutineState = Annotation.Root({
  userInput: Annotation<string>,
  programmedRoutine: Annotation<string>,
  exercises: Annotation<Exercise[]>,
  clientContext: Annotation<ClientContext>,
  filteredExercises: Annotation<Exercise[]>,
  routineTemplate: Annotation<RoutineTemplate>
});

export type WorkoutRoutineStateType = typeof WorkoutRoutineState.State;