import { processCheckIn, getUserByPhone } from "../../checkInService";
import { saveMessage } from "../../messageService";
import { createLogger } from "../../../utils/logger";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { TemplateSMSService } from "../template-sms-service";
import { BlueprintGenerationService } from "../../blueprint-generation-service";
import { ExerciseSelectionService } from "../template-services/exercise-selection-service";
import { SMSResponse } from "../types";
import { db } from "@acme/db/client";
import { user, TrainingSession } from "@acme/db/schema";
import { eq } from "@acme/db";
import { getWorkoutTemplate } from "@acme/ai";

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
        // Get user info to include their name
        const userInfo = await getUserByPhone(phoneNumber);
        const userName = userInfo ? await this.getUserName(userInfo.userId) : undefined;
        
        // Get template-based SMS config
        const smsConfig = checkInResult.sessionId 
          ? await TemplateSMSService.getSMSConfigForSession(checkInResult.sessionId)
          : null;
        
        // Check if this is a BMF template that needs deterministic selections
        if (checkInResult.sessionId) {
          const [session] = await db
            .select({ templateType: TrainingSession.templateType })
            .from(TrainingSession)
            .where(eq(TrainingSession.id, checkInResult.sessionId))
            .limit(1);
          
          const template = session?.templateType ? getWorkoutTemplate(session.templateType) : null;
          
          logger.info("Checking for BMF template in standard handler", {
            sessionId: checkInResult.sessionId,
            templateType: session?.templateType,
            templateFound: !!template,
            smsConfig: template?.smsConfig,
            showDeterministicSelections: template?.smsConfig?.showDeterministicSelections,
            isBMF: session?.templateType === 'full_body_bmf'
          });
          
          // Generate blueprint and get deterministic selections for BMF
          if (session?.templateType === 'full_body_bmf' || template?.smsConfig?.showDeterministicSelections) {
            try {
              logger.info("Attempting to generate blueprint and get selections", {
                sessionId: checkInResult.sessionId,
                templateType: session?.templateType
              });
              
              // Try to generate blueprint first
              const blueprintExists = await BlueprintGenerationService.ensureBlueprintExists(checkInResult.sessionId);
              
              let selections: any[] = [];
              
              if (blueprintExists) {
                // Get selections from existing blueprint
                selections = await ExerciseSelectionService.getDeterministicSelections(checkInResult.sessionId);
                logger.info("Got selections from blueprint", {
                  sessionId: checkInResult.sessionId,
                  selectionCount: selections.length
                });
              } else {
                // Use preview for check-in message
                logger.info("Blueprint not available, using preview", {
                  sessionId: checkInResult.sessionId,
                  templateType: session?.templateType
                });
                selections = await ExerciseSelectionService.getDeterministicPreview(session.templateType);
              }
              
              if (selections.length > 0) {
                const clientName = ExerciseSelectionService.formatClientName(userName);
                responseMessage = ExerciseSelectionService.formatSelectionsForSMS(selections, clientName);
                
                logger.info("Using deterministic selections in check-in", {
                  sessionId: checkInResult.sessionId,
                  selectionCount: selections.length,
                  usedPreview: !blueprintExists
                });
              } else {
                // Fall back to template response
                logger.info("No deterministic selections found, using template response");
                responseMessage = TemplateSMSService.getCheckInResponse(smsConfig, userName);
                const preferencePrompt = TemplateSMSService.getPreferencePrompt(smsConfig, userName);
                responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
              }
            } catch (bmfError) {
              logger.error("Error handling BMF template in check-in", {
                error: bmfError,
                sessionId: checkInResult.sessionId,
                templateType: session?.templateType
              });
              // Fall back to standard template response
              responseMessage = TemplateSMSService.getCheckInResponse(smsConfig, userName);
              const preferencePrompt = TemplateSMSService.getPreferencePrompt(smsConfig, userName);
              responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
            }
          } else {
            // Use standard template response
            responseMessage = TemplateSMSService.getCheckInResponse(smsConfig, userName);
            const preferencePrompt = TemplateSMSService.getPreferencePrompt(smsConfig, userName);
            responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
          }
        } else {
          // No session ID, use standard response
          responseMessage = TemplateSMSService.getCheckInResponse(smsConfig, userName);
          const preferencePrompt = TemplateSMSService.getPreferencePrompt(smsConfig, userName);
          responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
        }
        
        logger.info("Added template-based preference prompt to check-in response", {
          userId: checkInResult.userId,
          sessionId: checkInResult.sessionId,
          userName,
          hasTemplate: !!smsConfig
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

  private async getUserName(userId: string): Promise<string | undefined> {
    try {
      const userRecord = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      
      return userRecord[0]?.name || undefined;
    } catch (error) {
      logger.error("Failed to get user name", { userId, error });
      return undefined;
    }
  }
}