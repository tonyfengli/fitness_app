import { db } from "@acme/db/client";
import { TrainingSession, UserTrainingSession } from "@acme/db/schema";
import { eq, and } from "@acme/db";
import { getWorkoutTemplate } from "@acme/ai";
import { createLogger } from "../../../utils/logger";
import { saveMessage } from "../../messageService";
import { ExerciseSelectionService } from "../template-services/exercise-selection-service";
import { TemplateSMSService } from "../template-sms-service";
import { BlueprintGenerationService } from "../../blueprint-generation-service";
import type { SMSResponse } from "../types";

const logger = createLogger("TemplateCheckInHandler");

export class TemplateCheckInHandler {
  /**
   * Handle check-in for templates with custom flows
   */
  static async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: {
      userId: string;
      businessId: string;
      userName: string | null;
      trainingSessionId: string;
    }
  ): Promise<SMSResponse> {
    try {
      // Get session details
      const [session] = await db
        .select({
          id: TrainingSession.id,
          templateType: TrainingSession.templateType,
          templateConfig: TrainingSession.templateConfig
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, userInfo.trainingSessionId))
        .limit(1);

      if (!session) {
        return {
          success: false,
          message: "Session not found. Please contact your trainer."
        };
      }

      // Get template configuration
      const template = session.templateType ? getWorkoutTemplate(session.templateType) : null;
      
      logger.info("Template check-in handler details", {
        sessionId: session.id,
        templateType: session.templateType,
        templateFound: !!template,
        hasCustomCheckIn: template?.smsConfig?.customCheckIn,
        showDeterministicSelections: template?.smsConfig?.showDeterministicSelections,
        templateName: template?.name
      });
      
      // Check if template has custom check-in configuration
      if (template?.smsConfig?.customCheckIn) {
        return await this.handleCustomCheckIn(
          phoneNumber,
          messageContent,
          messageSid,
          userInfo,
          session,
          template
        );
      }

      // Default check-in with deterministic selections
      return await this.handleCheckInWithSelections(
        phoneNumber,
        messageContent,
        messageSid,
        userInfo,
        session,
        template
      );

    } catch (error) {
      logger.error("Template check-in error", error);
      return {
        success: false,
        message: "Sorry, there was an error checking you in. Please try again."
      };
    }
  }

  /**
   * Handle check-in with deterministic exercise selections
   */
  private static async handleCheckInWithSelections(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: {
      userId: string;
      businessId: string;
      userName: string | null;
      trainingSessionId: string;
    },
    session: any,
    template: any
  ): Promise<SMSResponse> {
    try {
      // Save check-in message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        trainingSessionId: userInfo.trainingSessionId,
        phoneNumber,
        messageContent,
        messageSid,
        direction: 'inbound' as const,
        status: 'sent'
      });

      // Update check-in status
      await db.transaction(async (tx) => {
        await tx.update(UserTrainingSession)
          .set({
            checkedInAt: new Date(),
            preferenceCollectionStep: 'awaiting_initial_response'
          })
          .where(
            and(
              eq(UserTrainingSession.userId, userInfo.userId),
              eq(UserTrainingSession.trainingSessionId, userInfo.trainingSessionId)
            )
          );
      });

      // Generate blueprint if it doesn't exist (for templates that support it)
      if (session.templateType === 'full_body_bmf' || template?.smsConfig?.showDeterministicSelections) {
        logger.info("Ensuring blueprint exists", {
          sessionId: session.id,
          templateType: session.templateType,
          showDeterministicSelections: template?.smsConfig?.showDeterministicSelections
        });
        await BlueprintGenerationService.ensureBlueprintExists(session.id);
      }

      // Get deterministic selections if available
      const selections = await ExerciseSelectionService.getDeterministicSelections(session.id);
      
      // Format client name
      const clientName = ExerciseSelectionService.formatClientName(userInfo.userName);
      
      // Generate response based on selections
      let response: string;
      
      if (selections.length > 0 && template?.smsConfig?.showDeterministicSelections !== false) {
        // Show deterministic selections
        response = ExerciseSelectionService.formatSelectionsForSMS(selections, clientName);
      } else if (template?.smsConfig?.checkInResponse) {
        // Use template-specific response
        response = template.smsConfig.checkInResponse.replace('{clientName}', clientName);
      } else {
        // Default response
        response = `You're checked in, ${clientName}! What are you hoping to work on today?`;
      }

      // Save outbound message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        trainingSessionId: userInfo.trainingSessionId,
        phoneNumber,
        messageContent: response,
        direction: 'outbound' as const,
        status: 'sent'
      });

      return {
        success: true,
        message: response,
        metadata: {
          action: 'check_in_complete',
          showedSelections: selections.length > 0,
          templateType: session.templateType
        }
      };

    } catch (error) {
      logger.error("Error handling check-in with selections", error);
      throw error;
    }
  }

  /**
   * Handle custom check-in flows defined by template
   */
  private static async handleCustomCheckIn(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: {
      userId: string;
      businessId: string;
      userName: string | null;
      trainingSessionId: string;
    },
    session: any,
    template: any
  ): Promise<SMSResponse> {
    // This would handle completely custom check-in flows
    // For now, delegate to the selection-based handler
    return this.handleCheckInWithSelections(
      phoneNumber,
      messageContent,
      messageSid,
      userInfo,
      session,
      template
    );
  }
}