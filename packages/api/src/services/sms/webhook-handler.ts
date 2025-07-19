import { WorkoutPreferenceService } from "../workoutPreferenceService";
import { createLogger } from "../../utils/logger";
import { TwilioWebhookValidator } from "./webhook-validator";
import { SMSIntentRouter } from "./intent-router";
import { CheckInHandler } from "./handlers/check-in-handler";
import { PreferenceHandler } from "./handlers/preference-handler";
import { DefaultHandler } from "./handlers/default-handler";
import { SMSResponseSender } from "./response-sender";
import { TwilioSMSPayload, SMSResponse } from "./types";

const logger = createLogger("SMSWebhookHandler");

export class SMSWebhookHandler {
  private validator: TwilioWebhookValidator;
  private intentRouter: SMSIntentRouter;
  private checkInHandler: CheckInHandler;
  private preferenceHandler: PreferenceHandler;
  private defaultHandler: DefaultHandler;
  private responseSender: SMSResponseSender;

  constructor() {
    this.validator = new TwilioWebhookValidator();
    this.intentRouter = new SMSIntentRouter();
    this.checkInHandler = new CheckInHandler();
    this.preferenceHandler = new PreferenceHandler();
    this.defaultHandler = new DefaultHandler();
    this.responseSender = new SMSResponseSender();
  }

  async handleWebhook(request: Request): Promise<Response> {
    try {
      // Step 1: Validate webhook
      const signature = request.headers.get("X-Twilio-Signature");
      const validation = await this.validator.validateWebhook(request, signature);
      
      if (!validation.valid) {
        logger.warn("Webhook validation failed", { error: validation.error });
        return new Response(validation.error || "Unauthorized", { status: 401 });
      }

      // Extract payload
      let payload: TwilioSMSPayload;
      try {
        payload = this.validator.extractPayload(validation.payload!);
      } catch (error) {
        logger.error("Failed to extract SMS payload", error);
        return new Response("Bad Request: Invalid SMS payload", { status: 400 });
      }
      
      logger.info("Incoming SMS", { 
        from: payload.From, 
        body: payload.Body,
        messageSid: payload.MessageSid 
      });

      // Step 2: Route and handle the message
      const response = await this.routeAndHandle(payload);

      // Step 3: Send SMS response asynchronously
      this.responseSender.sendResponseAsync(payload.From, response.message);

      // Return success immediately to Twilio
      return new Response("", { status: 200 });
    } catch (error) {
      logger.error("SMS webhook handler error", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  private async routeAndHandle(payload: TwilioSMSPayload): Promise<SMSResponse> {
    try {
      // Check if user is awaiting preference collection
      const preferenceCheck = await WorkoutPreferenceService.isAwaitingPreferences(
        payload.From
      );
      
      if (preferenceCheck.waiting) {
        return await this.preferenceHandler.handle(
          payload.From,
          payload.Body,
          payload.MessageSid,
          preferenceCheck
        );
      }

      // Otherwise, interpret the message intent
      const interpretation = await this.intentRouter.interpretMessage(payload.Body);
      
      // Route based on intent
      switch (interpretation.intent.type) {
        case "check_in":
          return await this.checkInHandler.handle(
            payload.From,
            payload.Body,
            payload.MessageSid,
            interpretation.intent
          );
          
        default:
          return await this.defaultHandler.handle(
            payload.From,
            payload.Body,
            payload.MessageSid,
            interpretation.intent
          );
      }
    } catch (error) {
      logger.error("Message routing error", error);
      
      // Return a safe error message
      return {
        success: false,
        message: "Sorry, we're having trouble processing your message. Please try again later."
      };
    }
  }
}