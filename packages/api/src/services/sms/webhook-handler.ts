import { createLogger } from "../../utils/logger";
import { MessagePipeline } from "../messaging/message-pipeline";
import { SMSAdapter } from "../messaging/adapters/sms-adapter";
import { TwilioWebhookValidator } from "./webhook-validator";
import { TwilioSMSPayload } from "./types";

const logger = createLogger("SMSWebhookHandler");

export class SMSWebhookHandler {
  private validator: TwilioWebhookValidator;
  private pipeline: MessagePipeline;

  constructor() {
    this.validator = new TwilioWebhookValidator();
    this.pipeline = new MessagePipeline();
  }

  async handleWebhook(request: Request): Promise<Response> {
    try {
      // Step 1: Validate webhook
      const signature = request.headers.get("X-Twilio-Signature");
      const validation = await this.validator.validateWebhook(request, signature);
      
      if (!validation.valid) {
        logger.warn("Webhook validation failed", { 
          error: validation.error,
          skipValidation: process.env.SKIP_TWILIO_VALIDATION,
          nodeEnv: process.env.NODE_ENV
        });
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

      // Step 2: Convert to unified message and process
      const unifiedMessage = await SMSAdapter.fromTwilioWebhook(payload);
      
      if (!unifiedMessage) {
        logger.error("Failed to convert SMS to unified message - user not found");
        return new Response("User not found", { status: 404 });
      }
      
      const processed = await this.pipeline.process(unifiedMessage);

      // Note: The pipeline handles all logging and sending responses via Twilio
      // We just need to return 200 to acknowledge receipt to Twilio
      return new Response("", { status: 200 });
    } catch (error) {
      logger.error("SMS webhook handler error", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

}