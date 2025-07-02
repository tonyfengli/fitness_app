import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutState } from "./types";
import { generateWorkoutNode, rulesBasedFilterNode, llmPreferenceNode } from "./nodes";

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
  workflow.addNode("rulesBasedFilter", rulesBasedFilterNode);
  workflow.addNode("llmPreference", llmPreferenceNode);
  
  // Set flow using modern API
  // @ts-expect-error - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "generateWorkout");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("generateWorkout", "rulesBasedFilter");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("rulesBasedFilter", "llmPreference");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("llmPreference", END);

  return workflow.compile();
}

/**
 * Creates a graph specifically for exercise filtering only
 * Used when user wants to filter existing exercises without generating a workout
 * @returns Compiled LangGraph workflow for filtering exercises
 */
export function createFilterGraph() {
  const workflow = new StateGraph(WorkoutState);

  // Add both filter nodes for complete filtering pipeline
  workflow.addNode("rulesBasedFilter", rulesBasedFilterNode);
  workflow.addNode("llmPreference", llmPreferenceNode);
  
  // Flow: START -> rules filter -> LLM preference -> END
  // @ts-expect-error - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "rulesBasedFilter");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("rulesBasedFilter", "llmPreference");
  // @ts-expect-error - LangGraph v0.3 types are still being refined  
  workflow.addEdge("llmPreference", END);

  return workflow.compile();
}