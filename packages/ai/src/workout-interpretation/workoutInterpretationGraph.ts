import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutInterpretationState, WorkoutInterpretationStateType } from "./types";
import { interpretExercisesNode } from "./interpretExercisesNode";

/**
 * Creates the workout interpretation graph
 * Single-node graph that processes TOP exercises through LLM
 */
export function createWorkoutInterpretationGraph() {
  // Build the graph
  const workflow = new StateGraph(WorkoutInterpretationState);

  // Add the single interpretation node
  workflow.addNode("interpretExercises", interpretExercisesNode);

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
    }
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
  exercises: Record<string, any[]>,
  clientContext?: Record<string, any>
) {
  try {
    const result = await workoutInterpretationGraph.invoke({
      exercises,
      clientContext: clientContext || {},
    });
    
    return result as WorkoutInterpretationStateType;
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