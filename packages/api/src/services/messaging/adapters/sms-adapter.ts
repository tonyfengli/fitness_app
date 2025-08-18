import { v4 as uuidv4 } from "uuid";

import type { MessageChannel, UnifiedMessage } from "../../../types/messaging";
import { getUserByPhone } from "../../checkInService";

export class SMSAdapter {
  /**
   * Convert Twilio webhook payload to UnifiedMessage
   */
  static async fromTwilioWebhook(payload: any): Promise<UnifiedMessage | null> {
    try {
      const phoneNumber = payload.From;
      const content = payload.Body;
      const twilioMessageSid = payload.MessageSid;

      // Look up user by phone
      const userInfo = await getUserByPhone(phoneNumber);

      if (!userInfo) {
        console.error(
          `[${new Date().toISOString()}] No user found for phone:`,
          phoneNumber,
        );
        return null;
      }

      const message: UnifiedMessage = {
        id: uuidv4(),
        userId: userInfo.userId,
        businessId: userInfo.businessId || "",
        trainingSessionId: userInfo.trainingSessionId,
        content: content,
        channel: "sms" as MessageChannel,
        metadata: {
          phoneNumber,
          twilioMessageSid,
        },
        timestamp: new Date(),
        userPhone: phoneNumber,
      };

      return message;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error converting Twilio webhook:`,
        error,
      );
      return null;
    }
  }
}
