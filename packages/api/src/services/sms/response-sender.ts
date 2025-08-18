import { twilioClient } from "../../services/twilio";
import { createLogger } from "../../utils/logger";

const logger = createLogger("SMSResponseSender");

export class SMSResponseSender {
  private twilioPhoneNumber: string;

  constructor() {
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || "";

    if (!this.twilioPhoneNumber) {
      logger.error("Twilio phone number not configured");
    }
  }

  async sendResponse(to: string, message: string): Promise<void> {
    try {
      if (!twilioClient) {
        throw new Error("Twilio client not configured");
      }

      if (!this.twilioPhoneNumber) {
        throw new Error("Twilio phone number not configured");
      }

      // Normalize recipient number
      const toNumber = this.normalizeRecipientNumber(to);

      // Send asynchronously
      await twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to: toNumber,
      });

      logger.info("SMS response sent", {
        to: toNumber,
        messageLength: message.length,
      });
    } catch (error) {
      logger.error("Failed to send SMS response", {
        error,
        to,
        messageLength: message.length,
      });
      // Don't throw - SMS sending failure shouldn't break the webhook
    }
  }

  async sendResponseAsync(to: string, message: string): Promise<void> {
    // Fire and forget version
    this.sendResponse(to, message).catch((error) => {
      logger.error("Async SMS send failed", error);
    });
  }

  private normalizeRecipientNumber(phoneNumber: string): string {
    // Handle cases where number might be missing country code
    if (phoneNumber.startsWith("+") && phoneNumber.length === 11) {
      return "+1" + phoneNumber.substring(1);
    }
    return phoneNumber;
  }
}
