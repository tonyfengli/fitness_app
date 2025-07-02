import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutState } from "./types";
import { generateWorkoutNode } from "./nodes";

/**
 * Creates and compiles the workout planning graph
 * @returns Compiled LangGraph workflow for generating workouts
 */
export function createWorkoutGraph() {
  // Build the graph using the annotation API
  const workflow = new StateGraph(WorkoutState);

  // Add nodes
  workflow.addNode("workout", generateWorkoutNode);
  
  // Set flow using modern API
  // @ts-expect-error - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "workout");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("workout", END);

  return workflow.compile();
}