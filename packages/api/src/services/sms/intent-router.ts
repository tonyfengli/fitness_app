import { interpretSMS } from "@acme/ai";

import { createLogger } from "../../utils/logger";

const logger = createLogger("IntentRouter");

export interface Intent {
  type: "check_in" | "schedule" | "cancel" | "reschedule" | "inquiry" | "other";
  confidence: number;
}

export interface InterpretationResult {
  intent: Intent;
  source: "keywords" | "ai";
}

export class SMSIntentRouter {
  private checkInKeywords = [
    "here",
    "im here",
    "i'm here",
    "i am here",
    "ready",
    "im ready",
    "i'm ready",
    "i am ready",
    "checking in",
    "check in",
    "checkin",
    "arrived",
    "im in",
    "i'm in",
    "i am in",
    "present",
    "at the gym",
    "at gym",
  ];

  async interpretMessage(body: string): Promise<InterpretationResult> {
    // First try keyword detection for performance
    const lowerBody = body.toLowerCase().trim();

    if (this.containsCheckInKeyword(lowerBody)) {
      logger.info("Check-in detected by keywords", {
        message: body,
        detected: true,
      });

      return {
        intent: { type: "check_in", confidence: 0.9 },
        source: "keywords",
      };
    }

    // Fall back to AI interpretation
    try {
      const interpretation = await interpretSMS(body);
      logger.info("SMS interpretation via AI", {
        intent: interpretation.intent,
        rawMessage: body,
      });

      return {
        intent: interpretation.intent || { type: "other", confidence: 0.5 },
        source: "ai",
      };
    } catch (error) {
      logger.error("AI interpretation failed, checking keywords again", error);

      // Try keywords one more time as fallback
      if (this.containsCheckInKeyword(lowerBody)) {
        return {
          intent: { type: "check_in", confidence: 0.7 },
          source: "keywords",
        };
      }

      // Default to "other"
      return {
        intent: { type: "other", confidence: 0.3 },
        source: "keywords",
      };
    }
  }

  private containsCheckInKeyword(text: string): boolean {
    return this.checkInKeywords.some((keyword) => text.includes(keyword));
  }
}
