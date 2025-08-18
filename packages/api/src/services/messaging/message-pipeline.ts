import { v4 as uuidv4 } from "uuid";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { user as userTable } from "@acme/db/schema";

import {
  MessageIntent,
  MessageResponse,
  ProcessedMessage,
  UnifiedMessage,
} from "../../types/messaging";
import { SMSIntentRouter } from "../sms/intent-router";
// TODO: Implement these handlers
// import { PreferenceHandler } from './handlers/preference-handler';
// import { DisambiguationHandler } from './handlers/disambiguation-handler';
// import { PreferenceUpdateHandler } from './handlers/preference-update-handler';
// import { DefaultHandler } from './handlers/default-handler';
import { ResponseDispatcher } from "./adapters/response-dispatcher";
import { CheckInHandler } from "./handlers/check-in-handler";
import { unifiedLogger } from "./unified-logger";

export class MessagePipeline {
  private intentRouter: SMSIntentRouter;
  private handlers: Map<string, any>;
  private dispatcher: ResponseDispatcher;

  constructor() {
    this.intentRouter = new SMSIntentRouter();
    this.dispatcher = new ResponseDispatcher();

    // Initialize handlers - for now just check-in
    this.handlers = new Map([
      ["check_in", new CheckInHandler()],
      // TODO: Add other handlers
      // ['preference_collection', new PreferenceHandler()],
      // ['disambiguation', new DisambiguationHandler()],
      // ['preference_update', new PreferenceUpdateHandler()],
      // ['default', new DefaultHandler()]
    ]);
  }

  /**
   * Main message processing pipeline
   */
  async process(message: UnifiedMessage): Promise<ProcessedMessage> {
    const startTime = Date.now();

    try {
      // 1. Ensure message has an ID
      if (!message.id) {
        message.id = uuidv4();
      }

      // 2. Populate user info if needed
      await this.populateUserInfo(message);

      // 3. Log incoming message
      await unifiedLogger.logInbound(message);

      // 4. Initialize session tracking if needed
      if (message.trainingSessionId) {
        unifiedLogger.initSession(
          message.trainingSessionId,
          message.userId,
          message.userPhone,
        );
      }

      // 5. Detect intent
      console.log(
        `[${new Date().toISOString()}] Detecting intent for: "${message.content}"`,
      );
      const intentResult = await this.intentRouter.interpretMessage(
        message.content,
      );

      // Map SMS intent types to unified message intent types
      let mappedType: MessageIntent["type"] = "default";
      if (intentResult.intent.type === "check_in") {
        mappedType = "check_in";
      }

      const intent: MessageIntent = {
        type: mappedType,
        confidence: intentResult.intent.confidence,
        data: (intentResult.intent as any).data,
      };

      console.log(`[${new Date().toISOString()}] Intent detected:`, {
        type: intent.type,
        confidence: intent.confidence,
      });

      // 6. Route to appropriate handler
      const handler = this.handlers.get(intent.type);
      if (!handler) {
        // For now, return a simple response for unhandled intents
        console.log(
          `[${new Date().toISOString()}] No handler for intent: ${intent.type}, using default response`,
        );
        const response: MessageResponse = {
          success: true,
          message:
            "I'm not sure how to help with that. Please contact your trainer for assistance.",
          metadata: {
            intent: intent.type,
            unhandled: true,
          },
        };

        await unifiedLogger.logOutbound(message, response);
        await this.dispatcher.send(message, response);

        return {
          originalMessage: message,
          intent,
          response,
          processingTime: Date.now() - startTime,
        };
      }

      console.log(
        `[${new Date().toISOString()}] Routing to ${intent.type} handler`,
      );
      const response = await handler.handle(message, intent);

      // 7. Log outbound response
      await unifiedLogger.logOutbound(message, response);

      // 8. Send response via appropriate channel
      await this.dispatcher.send(message, response);

      // 9. Create processed message
      const processed: ProcessedMessage = {
        originalMessage: message,
        intent,
        response,
        processingTime: Date.now() - startTime,
      };

      // 10. Log complete processing
      await unifiedLogger.logProcessing(processed);

      return processed;
    } catch (error) {
      unifiedLogger.logError("Message pipeline error", error, message);

      // Return error response
      const errorResponse: MessageResponse = {
        success: false,
        message:
          "Sorry, something went wrong processing your message. Please try again.",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };

      // Still try to send error response
      try {
        await this.dispatcher.send(message, errorResponse);
      } catch (dispatchError) {
        unifiedLogger.logError(
          "Failed to send error response",
          dispatchError,
          message,
        );
      }

      return {
        originalMessage: message,
        intent: { type: "default", confidence: 0 },
        response: errorResponse,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Populate user info from database if needed
   */
  private async populateUserInfo(message: UnifiedMessage): Promise<void> {
    try {
      const [user] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, message.userId))
        .limit(1);

      if (user) {
        message.userName = user.name || undefined;
        message.userPhone = user.phone || undefined;

        // Ensure businessId is set
        if (!message.businessId && user.businessId) {
          message.businessId = user.businessId;
        }
      }
    } catch (error) {
      unifiedLogger.logError("Failed to populate user info", error, message);
      // Continue processing even if user info lookup fails
    }
  }
}
