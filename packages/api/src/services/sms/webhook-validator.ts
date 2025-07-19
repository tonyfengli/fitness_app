import { validateRequest } from "twilio";
import { createLogger } from "../../utils/logger";

const logger = createLogger("WebhookValidator");

export interface ValidationResult {
  valid: boolean;
  payload?: Record<string, string>;
  error?: string;
}

export class TwilioWebhookValidator {
  private authToken: string;
  private skipValidation: boolean;

  constructor() {
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.skipValidation = 
      process.env.SKIP_TWILIO_VALIDATION === "true" || 
      process.env.NODE_ENV === "development";
  }

  async validateWebhook(
    request: Request,
    signature: string | null
  ): Promise<ValidationResult> {
    try {
      // Check signature header
      if (!signature) {
        logger.warn("Missing Twilio signature");
        return { valid: false, error: "Missing X-Twilio-Signature header" };
      }

      // Parse form data
      const formData = await request.formData();
      const params: Record<string, string> = {};
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });

      // Validate required fields
      if (!params.From || !params.Body) {
        return { 
          valid: false, 
          error: "Missing required fields: From or Body" 
        };
      }

      // Skip validation in development if configured
      if (this.skipValidation) {
        logger.debug("Skipping Twilio signature validation (development mode)");
        return { valid: true, payload: params };
      }

      // Validate auth token is configured
      if (!this.authToken) {
        logger.error("Missing Twilio auth token");
        return { 
          valid: false, 
          error: "Service misconfigured: Missing auth token" 
        };
      }

      // Get webhook URL
      const url = new URL(request.url);
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL || url.toString();

      logger.debug("Validating Twilio signature", {
        webhookUrl,
        signature: signature.substring(0, 10) + "...",
        paramsCount: Object.keys(params).length
      });

      // Validate signature
      const isValid = validateRequest(
        this.authToken,
        signature,
        webhookUrl,
        params
      );

      if (!isValid) {
        logger.warn("Invalid Twilio signature", { 
          signature: signature.substring(0, 10) + "...",
          url: webhookUrl
        });
        return { valid: false, error: "Invalid webhook signature" };
      }

      return { valid: true, payload: params };
    } catch (error) {
      logger.error("Webhook validation error", error);
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : "Validation failed" 
      };
    }
  }

  extractPayload(params: Record<string, string>) {
    // Ensure required fields are present
    if (!params.MessageSid || !params.From || !params.To || !params.Body) {
      throw new Error("Missing required SMS fields");
    }

    return {
      MessageSid: params.MessageSid,
      SmsSid: params.SmsSid || params.MessageSid, // Fallback to MessageSid
      AccountSid: params.AccountSid || "",
      MessagingServiceSid: params.MessagingServiceSid,
      From: params.From,
      To: params.To,
      Body: params.Body,
      NumMedia: params.NumMedia,
    };
  }
}