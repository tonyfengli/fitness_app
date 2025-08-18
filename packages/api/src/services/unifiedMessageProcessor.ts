import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { messages, user as userTable } from "@acme/db/schema";

import type { SMSResponse } from "./sms/types";
import { createLogger } from "../utils/logger";
// SSE broadcast will be handled by the API route
import { SMSDebugLogger } from "../utils/smsDebugLogger";
import { saveMessage } from "./messageService";
import { CheckInHandler } from "./sms/handlers/check-in-handler";
import { DefaultHandler } from "./sms/handlers/default-handler";
import { DisambiguationHandler } from "./sms/handlers/disambiguation-handler";
import { PreferenceHandler } from "./sms/handlers/preference-handler";
import { PreferenceUpdateHandler } from "./sms/handlers/preference-update-handler";
import { SMSIntentRouter } from "./sms/intent-router";
import { SMSResponseSender } from "./sms/response-sender";

const logger = createLogger("UnifiedMessageProcessor");

interface ProcessMessageParams {
  from: string; // userId for in_app, phone number for sms
  content: string;
  channel: "sms" | "in_app";
  businessId: string;
  sentBy?: string; // For in_app messages, who sent it (trainer ID)
  trainingSessionId?: string;
  metadata?: any;
}

export class UnifiedMessageProcessor {
  private intentRouter: SMSIntentRouter;
  private checkInHandler: CheckInHandler;
  private preferenceHandler: PreferenceHandler;
  private disambiguationHandler: DisambiguationHandler;
  private preferenceUpdateHandler: PreferenceUpdateHandler;
  private defaultHandler: DefaultHandler;
  private responseSender: SMSResponseSender;

  constructor() {
    this.intentRouter = new SMSIntentRouter();
    this.checkInHandler = new CheckInHandler();
    this.preferenceHandler = new PreferenceHandler();
    this.disambiguationHandler = new DisambiguationHandler();
    this.preferenceUpdateHandler = new PreferenceUpdateHandler();
    this.defaultHandler = new DefaultHandler();
    this.responseSender = new SMSResponseSender();
  }

  async processMessage(
    params: ProcessMessageParams,
  ): Promise<SMSResponse | null> {
    logger.info("Processing message", {
      from: params.from,
      content: params.content,
      channel: params.channel,
      businessId: params.businessId,
      trainingSessionId: params.trainingSessionId,
    });

    try {
      let userId: string;
      let userPhone: string | null = null;
      let userName: string | null = null;

      // Resolve user info based on channel
      if (params.channel === "in_app") {
        // For in_app, params.from is already the userId
        userId = params.from;

        // Get user details
        const [user] = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, userId))
          .limit(1);

        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        userPhone = user.phone;
        userName = user.name;
      } else {
        // For SMS, params.from is the phone number
        userPhone = params.from;

        // Look up user by phone
        const [user] = await db
          .select()
          .from(userTable)
          .where(eq(userTable.phone, userPhone))
          .limit(1);

        if (!user) {
          throw new Error(`User not found for phone: ${userPhone}`);
        }

        userId = user.id;
        userName = user.name;
        params.businessId = user.businessId || params.businessId;
      }

      // Save the inbound message
      await saveMessage({
        userId,
        businessId: params.businessId,
        direction: "inbound",
        content: params.content,
        phoneNumber: userPhone || undefined,
        metadata: {
          ...params.metadata,
          channel: params.channel,
          sentBy: params.sentBy,
        },
        status: "delivered",
      });

      // Log to debug session if training session exists
      if (params.trainingSessionId) {
        await SMSDebugLogger.logInboundMessage(
          userPhone || userId, // Use userId if no phone
          params.content,
          params.trainingSessionId,
          {
            ...params.metadata,
            channel: params.channel,
            userId: userId,
          },
        );
      }

      // Route through intent detection and handlers
      const interpretResult = await this.intentRouter.interpretMessage(
        params.content,
      );
      const intent = interpretResult.intent;

      logger.info("Message intent detected", {
        userId,
        channel: params.channel,
        intent: intent.type,
        confidence: intent.confidence,
      });

      // Create a mock SMS payload for compatibility with existing handlers
      const mockPayload = {
        From: userPhone || `web_${userId}`, // Use a special prefix for web users
        Body: params.content,
        MessageSid: `${params.channel}_${Date.now()}`,
        // Store the actual userId in a custom field for handlers to use
        UserId: userId,
        Channel: params.channel,
        intent: intent,
      };

      // Route to appropriate handler
      let response: SMSResponse;

      logger.info("Routing to handler", {
        intentType: intent.type,
        userId,
        channel: params.channel,
      });

      // Map SMS intent types to handler types
      switch (intent.type) {
        case "check_in":
          response = await this.checkInHandler.handle(mockPayload);
          break;
        case "inquiry":
          // Route inquiry to preference handler for now
          response = await this.preferenceHandler.handle(mockPayload);
          break;
        default:
          response = await this.defaultHandler.handle(
            mockPayload.From,
            mockPayload.Body,
            mockPayload.MessageSid,
            mockPayload.intent,
          );
      }

      logger.info("Handler response", {
        success: response.success,
        messageLength: response.message.length,
        messagePreview:
          response.message.substring(0, 100) +
          (response.message.length > 100 ? "..." : ""),
        channel: params.channel,
      });

      // Save the outbound response
      await saveMessage({
        userId,
        businessId: params.businessId,
        direction: "outbound",
        content: response.message,
        phoneNumber: userPhone || undefined,
        metadata: {
          ...response.metadata,
          channel: params.channel,
          respondingTo: params.content,
          intent,
        },
        status: "sent",
      });

      // Send response based on channel
      if (params.channel === "sms" && userPhone) {
        // Send SMS response
        await this.responseSender.sendResponse(userPhone, response.message);

        // Log to debug session
        if (params.trainingSessionId) {
          await SMSDebugLogger.logOutboundMessage(
            userPhone,
            response.message,
            params.trainingSessionId,
            response.metadata,
          );
        }
      } else if (params.channel === "in_app") {
        // For in_app messages, the frontend will poll or use SSE to get updates
        // The message is already saved to DB, so clients will see it on refresh
        logger.info("In-app message processed and saved", {
          userId,
          responseLength: response.message.length,
        });

        // Log to debug session for web app messages too
        if (params.trainingSessionId) {
          await SMSDebugLogger.logOutboundMessage(
            userPhone || userId, // Use userId if no phone
            response.message,
            params.trainingSessionId,
            {
              ...response.metadata,
              channel: params.channel,
            },
          );
        }
      }

      return response;
    } catch (error) {
      logger.error("Failed to process message", {
        error,
        params,
      });

      // Save error message for visibility
      if (params.channel === "in_app") {
        try {
          await saveMessage({
            userId: params.from,
            businessId: params.businessId,
            direction: "outbound",
            content:
              "Sorry, I couldn't process your message. Please try again.",
            metadata: {
              error: error instanceof Error ? error.message : "Unknown error",
              channel: params.channel,
            },
            status: "failed",
          });
        } catch (saveError) {
          logger.error("Failed to save error message", saveError);
        }
      }

      return null;
    }
  }
}
