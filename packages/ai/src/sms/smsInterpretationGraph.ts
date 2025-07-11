import { StateGraph, START, END } from "@langchain/langgraph";
import type { SMSStateType } from "./types/smsTypes";
import { SMSState } from "./types/smsTypes";
import { parseIntentNode, extractContextNode, buildQueryNode } from "./nodes";

/**
 * Creates the SMS interpretation graph
 * Processes raw SMS text into structured queries
 */
export function createSMSInterpretationGraph() {
  // Build the graph using the annotation API
  const workflow = new StateGraph(SMSState);

  // Add nodes
  workflow.addNode("parseIntent", parseIntentNode);
  workflow.addNode("extractContext", extractContextNode);
  workflow.addNode("buildQuery", buildQueryNode);

  // Define workflow edges
  workflow.addEdge(START, "parseIntent" as any);

  // Conditional edge from parseIntent
  workflow.addConditionalEdges(
    "parseIntent" as any,
    (state: SMSStateType) => {
      if (state.error) {
        return "end";
      }
      return "extractContext";
    },
    {
      extractContext: "extractContext" as any,
      end: END,
    }
  );

  // Conditional edge from extractContext
  workflow.addConditionalEdges(
    "extractContext" as any,
    (state: SMSStateType) => {
      if (state.error) {
        return "end";
      }
      return "buildQuery";
    },
    {
      buildQuery: "buildQuery" as any,
      end: END,
    }
  );

  // Final edge
  workflow.addEdge("buildQuery" as any, END);

  return workflow.compile();
}

// Export compiled graph
export const smsInterpretationGraph = createSMSInterpretationGraph();

/**
 * Helper function to interpret SMS messages
 */
export async function interpretSMS(rawMessage: string) {
  const result = await smsInterpretationGraph.invoke({
    rawMessage,
    messages: [],
  });
  
  return result;
}