import { processCheckIn, getUserByPhone } from "../../checkInService";
import { saveMessage } from "../../messageService";
import { createLogger } from "../../../utils/logger";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { SMSResponse } from "../types";

const logger = createLogger("CheckInHandler");

export class CheckInHandler {
  async handle(
    phoneNumber: string, 
    messageContent: string,
    messageSid: string,
    intent: any
  ): Promise<SMSResponse> {
    try {
      // Process the check-in
      const checkInResult = await processCheckIn(phoneNumber);
      
      logger.info("Check-in processed", {
        success: checkInResult.success,
        userId: checkInResult.userId,
        sessionId: checkInResult.sessionId,
        shouldStartPreferences: checkInResult.shouldStartPreferences,
      });

      // Build response message
      let responseMessage = checkInResult.message;
      
      // Add preference prompt if needed
      if (checkInResult.success && checkInResult.shouldStartPreferences) {
        responseMessage = `${responseMessage}\n\n${WorkoutPreferenceService.PREFERENCE_PROMPT}`;
        
        logger.info("Added preference prompt to check-in response", {
          userId: checkInResult.userId,
          sessionId: checkInResult.sessionId
        });
      }

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        responseMessage,
        messageSid,
        intent,
        checkInResult
      );

      return {
        success: true,
        message: responseMessage,
        metadata: {
          userId: checkInResult.userId,
          businessId: checkInResult.businessId,
          sessionId: checkInResult.sessionId,
          checkInSuccess: checkInResult.success
        }
      };
    } catch (error) {
      logger.error("Check-in handler error", error);
      throw error;
    }
  }

  private async saveMessages(
    phoneNumber: string,
    inboundContent: string,
    outboundContent: string,
    messageSid: string,
    intent: any,
    checkInResult: any
  ): Promise<void> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      
      if (!userInfo) {
        logger.warn("User not found for message saving", { phoneNumber });
        return;
      }

      // Save inbound message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'inbound',
        content: inboundContent,
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
        content: outboundContent,
        phoneNumber,
        metadata: {
          checkInResult: checkInResult.success 
            ? { success: true, sessionId: checkInResult.sessionId } 
            : { success: false },
        },
        status: 'sent',
      });
    } catch (error) {
      logger.error("Failed to save messages", error);
      // Don't throw - message saving shouldn't break the flow
    }
  }
}