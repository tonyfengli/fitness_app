import { END, START, StateGraph } from "@langchain/langgraph";

import type { ExercisesByBlock, WorkoutInterpretationStateType } from "./types";
import { generateWorkoutFromExercises } from "./generateWorkoutFromExercises";
import { WorkoutInterpretationState } from "./types";

/**
 * Creates the workout interpretation graph
 * Single-node graph that processes TOP exercises through LLM
 */
export function createWorkoutInterpretationGraph() {
  // Build the graph
  const workflow = new StateGraph(WorkoutInterpretationState);

  // Add the single interpretation node
  workflow.addNode("interpretExercises", generateWorkoutFromExercises);

  // Define workflow edges
  workflow.addEdge(START, "interpretExercises" as any);

  // Conditional edge to handle errors
  workflow.addConditionalEdges(
    "interpretExercises" as any,
    (state: WorkoutInterpretationStateType) => {
      // If there's an error, go to end
      if (state.error) {
        return "end";
      }
      // Otherwise, also go to end (single node graph)
      return "end";
    },
    {
      end: END,
    },
  );

  return workflow.compile();
}

// Export compiled graph
export const workoutInterpretationGraph = createWorkoutInterpretationGraph();

/**
 * Helper function to interpret workout from TOP exercises
 * This is what the frontend will call
 */
export async function interpretWorkout(
  exercises: ExercisesByBlock,
  clientContext?: Record<string, any>,
) {
  try {
    const result = await workoutInterpretationGraph.invoke({
      exercises,
      clientContext: clientContext || {},
    });

    return result;
  } catch (error) {
    console.error("Error interpreting workout:", error);
    return {
      exercises,
      clientContext: clientContext || {},
      interpretation: "",
      structuredOutput: {},
      error: error instanceof Error ? error.message : "Unknown error occurred",
    } as WorkoutInterpretationStateType;
  }
}
