import { saveMessage } from "../../messageService";
import { getUserByPhone } from "../../checkInService";
import { createLogger } from "../../../utils/logger";
import { SMSResponse } from "../types";

const logger = createLogger("DefaultHandler");

export class DefaultHandler {
  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    intent: any
  ): Promise<SMSResponse> {
    const responseMessage = "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive.";
    
    logger.info("Non-check-in message received", { 
      intent: intent?.type,
      phoneNumber 
    });

    // Try to save the message if we can find the user
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      
      if (userInfo) {
        // Save inbound message
        await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'inbound',
          content: messageContent,
          phoneNumber,
          metadata: {
            intent,
            twilioMessageSid: messageSid,
          },
          status: 'delivered',
        });

        // Save outbound response
        await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'outbound',
          content: responseMessage,
          phoneNumber,
          metadata: {
            type: 'generic_response'
          },
          status: 'sent',
        });
      }
    } catch (error) {
      logger.error("Failed to save messages", error);
      // Don't throw - continue with response
    }

    return {
      success: true,
      message: responseMessage,
      metadata: {
        intentType: intent?.type || 'unknown'
      }
    };
  }
}