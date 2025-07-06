import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { SMSStateType } from "../types/smsTypes";

const INTENT_PROMPT = `You are an AI assistant that interprets SMS messages from fitness clients.
Your task is to identify the primary intent of the message.

Possible intents:
- "schedule": Client wants to book a new session
- "cancel": Client wants to cancel an existing session
- "reschedule": Client wants to change an existing session
- "inquiry": Client is asking a question (about availability, pricing, etc.)
- "other": Message doesn't fit the above categories

Analyze the message and respond with JSON containing:
{
  "type": "schedule" | "cancel" | "reschedule" | "inquiry" | "other",
  "confidence": 0.0-1.0
}`;

export async function parseIntentNode(state: SMSStateType) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    });

    const messages = [
      new SystemMessage(INTENT_PROMPT),
      new HumanMessage(state.rawMessage),
    ];

    const response = await model.invoke(messages);
    const content = response.content.toString();
    
    // Parse JSON response
    const intent = JSON.parse(content);
    
    return {
      intent,
      messages: [...state.messages, ...messages, response],
    };
  } catch (error) {
    console.error("Error parsing intent:", error);
    return {
      error: `Failed to parse intent: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}