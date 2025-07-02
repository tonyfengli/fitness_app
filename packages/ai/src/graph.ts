import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutState } from "./types";
import { generateWorkoutNode, filterExercisesNode } from "./nodes";

/**
 * Creates and compiles the workout planning graph
 * Supports both workout generation and exercise filtering
 * @returns Compiled LangGraph workflow for workout operations
 */
export function createWorkoutGraph() {
  // Build the graph using the annotation API
  const workflow = new StateGraph(WorkoutState);

  // Add nodes
  workflow.addNode("generateWorkout", generateWorkoutNode);
  workflow.addNode("filterExercises", filterExercisesNode);
  
  // Set flow using modern API
  // @ts-expect-error - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "generateWorkout");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("generateWorkout", "filterExercises");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("filterExercises", END);

  return workflow.compile();
}

/**
 * Creates a graph specifically for exercise filtering only
 * Used when user wants to filter existing exercises without generating a workout
 * @returns Compiled LangGraph workflow for filtering exercises
 */
export function createFilterGraph() {
  const workflow = new StateGraph(WorkoutState);

  // Add only the filter node
  workflow.addNode("filterExercises", filterExercisesNode);
  
  // Simple flow: START -> filter -> END
  // @ts-expect-error - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "filterExercises");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("filterExercises", END);

  return workflow.compile();
}