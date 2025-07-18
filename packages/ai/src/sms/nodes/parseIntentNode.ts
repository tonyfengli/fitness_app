import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { SMSStateType } from "../types/smsTypes";

const INTENT_PROMPT = `You are an AI assistant that interprets SMS messages from fitness clients.
Your task is to identify if the message is a check-in for their fitness session.

Possible intents:
- "check_in": Client is checking in for a session (e.g., "here", "I'm in", "ready", "checking in", "arrived", "present")
- "other": Any other type of message

Analyze the message and respond with JSON containing:
{
  "type": "check_in" | "other",
  "confidence": 0.0-1.0
}`;

// Keyword patterns for fallback intent detection
const CHECK_IN_KEYWORDS = [
  "here", "im here", "i'm here", "i am here",
  "ready", "im ready", "i'm ready", "i am ready",
  "checking in", "check in", "checkin",
  "arrived", "im in", "i'm in", "i am in",
  "present", "at the gym", "at gym"
];

function detectIntentByKeywords(message: string) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for check-in keywords
  if (CHECK_IN_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
    return { type: "check_in" as const, confidence: 0.8 };
  }
  
  return null;
}

export async function parseIntentNode(state: SMSStateType) {
  // First try keyword detection for faster response
  const keywordIntent = detectIntentByKeywords(state.rawMessage);
  if (keywordIntent) {
    return {
      intent: keywordIntent,
      messages: state.messages,
    };
  }

  // Fall back to LLM if no keywords match
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
    console.error("Error parsing intent with LLM, using keyword fallback:", error);
    
    // Final fallback - check keywords again in case of LLM failure
    const fallbackIntent = detectIntentByKeywords(state.rawMessage);
    if (fallbackIntent) {
      return {
        intent: fallbackIntent,
        messages: state.messages,
      };
    }
    
    // Default to "other" if all else fails
    return {
      intent: { type: "other" as const, confidence: 0.5 },
      messages: state.messages,
    };
  }
}