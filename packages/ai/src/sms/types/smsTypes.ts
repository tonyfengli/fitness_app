import type { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

// Define state using the annotation API
export const SMSState = Annotation.Root({
  // Raw SMS text from the user
  rawMessage: Annotation<string>,

  // Parsed intent from the message
  intent: Annotation<
    | {
        type:
          | "check_in"
          | "schedule"
          | "cancel"
          | "reschedule"
          | "inquiry"
          | "other";
        confidence: number;
      }
    | undefined
  >,

  // Extracted context from the message
  context: Annotation<
    | {
        clientName?: string;
        clientId?: string;
        sessionType?: string;
        preferredTime?: string;
        preferredDate?: string;
        additionalNotes?: string;
      }
    | undefined
  >,

  // Structured query for the system
  structuredQuery: Annotation<
    | {
        action: string;
        parameters: Record<string, any>;
        requiresHumanReview: boolean;
      }
    | undefined
  >,

  // Chat history for context
  messages: Annotation<BaseMessage[]>,

  // Error handling
  error: Annotation<string | undefined>,
});

export type SMSStateType = typeof SMSState.State;

export interface ParseIntentInput {
  rawMessage: string;
  messages: BaseMessage[];
}

export interface ExtractContextInput {
  rawMessage: string;
  intent: SMSStateType["intent"];
  messages: BaseMessage[];
}

export interface BuildQueryInput {
  intent: SMSStateType["intent"];
  context: SMSStateType["context"];
  messages: BaseMessage[];
}
