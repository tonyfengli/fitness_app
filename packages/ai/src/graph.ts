import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutRoutineState } from "./types";
import { generateWorkoutNode } from "./nodes";
import { getGraphCompileOptions } from "./utils/graphConfig";

// Node constants for LLM-based operations
const NODES = {
  GENERATE_WORKOUT: "generateWorkout",
} as const;

/**
 * Creates and compiles the workout planning graph
 * Now only handles LLM-based workout generation
 * Exercise filtering/scoring should be done before calling this graph
 * @returns Compiled LangGraph workflow for workout generation
 */
export function createWorkoutGraph() {
  // Build the graph using the annotation API
  const workflow = new StateGraph(WorkoutRoutineState);

  // Add only the LLM-based workout generation node
  workflow.addNode(NODES.GENERATE_WORKOUT, generateWorkoutNode);
  
  // Simple workflow: START -> generate workout -> END
  workflow
    .addEdge(START, NODES.GENERATE_WORKOUT as any)
    .addEdge(NODES.GENERATE_WORKOUT as any, END);

  return workflow.compile(getGraphCompileOptions());
}

// Note: createFilterGraph has been removed as filtering/scoring are now direct function calls
// See filterAndScoreExercises() in filtering/filterAndScoreExercises.ts