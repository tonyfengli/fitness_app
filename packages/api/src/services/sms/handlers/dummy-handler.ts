import { createLogger } from "../../../utils/logger";
import { SMSResponse } from "../types";

const logger = createLogger("DummyHandler");

/**
 * Dummy handler for sessions without templates
 * Provides minimal, generic responses
 */
export class DummyHandler {
  static handle(messageContent: string): SMSResponse {
    logger.info("Handling message with dummy handler", {
      messageContent,
      reason: "No template configured for session",
    });

    // Simple keyword-based responses
    const lowerContent = messageContent.toLowerCase();

    if (lowerContent.includes("check") || lowerContent.includes("here")) {
      return {
        success: true,
        message:
          "Thanks for checking in! Your session doesn't have a workout template configured. Please contact your trainer.",
        metadata: {
          handlerType: "dummy",
          reason: "no_template",
        },
      };
    }

    if (lowerContent.includes("help") || lowerContent.includes("?")) {
      return {
        success: true,
        message:
          "This session doesn't have preferences enabled. Just show up and your trainer will guide you!",
        metadata: {
          handlerType: "dummy",
          reason: "no_template",
        },
      };
    }

    // Default response
    return {
      success: true,
      message:
        "Message received. This session uses manual workout planning - see your trainer for details.",
      metadata: {
        handlerType: "dummy",
        reason: "no_template",
      },
    };
  }

  /**
   * Check if a session should use the dummy handler
   */
  static shouldUseDummyHandler(templateType: string | null): boolean {
    // Use dummy handler if no template or unknown template
    const knownTemplates = ["full_body_bmf"];

    if (!templateType) {
      logger.info("No template type - using dummy handler");
      return true;
    }

    if (!knownTemplates.includes(templateType)) {
      logger.info("Unknown template type - using dummy handler", {
        templateType,
      });
      return true;
    }

    return false;
  }
}
