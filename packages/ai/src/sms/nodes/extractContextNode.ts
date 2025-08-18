import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import type { SMSStateType } from "../types/smsTypes";

const CONTEXT_PROMPT = `You are an AI assistant that extracts relevant context from fitness client SMS messages.
Based on the identified intent and the message content, extract relevant information.

Extract the following if present:
- Client name or identifier
- Session type (personal training, group class, etc.)
- Preferred time
- Preferred date
- Any additional notes or requirements

Respond with JSON containing the extracted context:
{
  "clientName": "string or null",
  "clientId": "string or null",
  "sessionType": "string or null",
  "preferredTime": "string or null",
  "preferredDate": "string or null",
  "additionalNotes": "string or null"
}`;

export async function extractContextNode(state: SMSStateType) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    });

    const messages = [
      new SystemMessage(CONTEXT_PROMPT),
      new HumanMessage(`Intent: ${JSON.stringify(state.intent)}
Message: ${state.rawMessage}`),
    ];

    const response = await model.invoke(messages);
    const content = response.content.toString();

    // Parse JSON response
    const context = JSON.parse(content);

    // Clean up null values
    Object.keys(context).forEach((key) => {
      if (context[key] === null || context[key] === "null") {
        delete context[key];
      }
    });

    return {
      context,
      messages: [...state.messages, ...messages, response],
    };
  } catch (error) {
    console.error("Error extracting context:", error);
    return {
      error: `Failed to extract context: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
