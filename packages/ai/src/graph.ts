import { StateGraph, START, END } from "@langchain/langgraph";
import { WorkoutRoutineState } from "./types";
import { generateWorkoutNode, rulesBasedFilterNode, llmPreferenceNode } from "./nodes";
import { getGraphCompileOptions } from "./utils/graphConfig";

// Modern node constants for better maintainability
const NODES = {
  GENERATE_WORKOUT: "generateWorkout",
  RULES_BASED_FILTER: "rulesBasedFilter",
  LLM_PREFERENCE: "llmPreference",
} as const;

/**
 * Creates and compiles the workout planning graph
 * Supports both workout generation and exercise filtering
 * @returns Compiled LangGraph workflow for workout operations
 */
export function createWorkoutGraph() {
  // Build the graph using the annotation API
  const workflow = new StateGraph(WorkoutRoutineState);

  // Add nodes with modern constants
  workflow.addNode(NODES.GENERATE_WORKOUT, generateWorkoutNode);
  workflow.addNode(NODES.RULES_BASED_FILTER, rulesBasedFilterNode);
  workflow.addNode(NODES.LLM_PREFERENCE, llmPreferenceNode);
  
  // Define workflow edges with method chaining
  // @ts-ignore - LangGraph TypeScript issues
  workflow
    .addEdge(START, NODES.GENERATE_WORKOUT)
    .addEdge(NODES.GENERATE_WORKOUT, NODES.RULES_BASED_FILTER)
    .addEdge(NODES.RULES_BASED_FILTER, NODES.LLM_PREFERENCE)
    .addEdge(NODES.LLM_PREFERENCE, END);

  return workflow.compile(getGraphCompileOptions());
}

/**
 * Creates a graph specifically for exercise filtering only
 * Used when user wants to filter existing exercises without generating a workout
 * @returns Compiled LangGraph workflow for filtering exercises
 */
export function createFilterGraph() {
  const workflow = new StateGraph(WorkoutRoutineState);

  // Add both filter nodes for complete filtering pipeline
  workflow.addNode(NODES.RULES_BASED_FILTER, rulesBasedFilterNode);
  workflow.addNode(NODES.LLM_PREFERENCE, llmPreferenceNode);
  
  // Define filtering pipeline: START -> rules filter -> LLM preference -> END
  // @ts-ignore - LangGraph TypeScript issues
  workflow
    .addEdge(START, NODES.RULES_BASED_FILTER)
    .addEdge(NODES.RULES_BASED_FILTER, NODES.LLM_PREFERENCE)
    .addEdge(NODES.LLM_PREFERENCE, END);

  return workflow.compile(getGraphCompileOptions());
}