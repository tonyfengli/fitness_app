import { BaseMessageHandler } from './base-handler';
import { UnifiedMessage, MessageResponse, MessageIntent } from '../../../types/messaging';
import { unifiedLogger } from '../unified-logger';
import { db } from "@acme/db/client";
import { eq, and } from "@acme/db";
import { user, TrainingSession, UserTrainingSession } from "@acme/db/schema";
import { getWorkoutTemplate } from "@acme/ai";
import { TemplateSMSService } from '../../sms/template-sms-service';
import { BlueprintGenerationService } from '../../blueprint-generation-service';
import { ExerciseSelectionService } from '../../sms/template-services/exercise-selection-service';

export class CheckInHandler extends BaseMessageHandler {
  async handle(message: UnifiedMessage, intent: MessageIntent): Promise<MessageResponse> {
    try {
      console.log(`[${new Date().toISOString()}] Processing check-in for user:`, {
        userId: message.userId,
        userName: message.userName,
        channel: message.channel
      });

      // Find open session for user's business
      const now = new Date();
      const [openSession] = await db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.businessId, message.businessId),
            eq(TrainingSession.status, "open")
          )
        )
        .limit(1);
      
      if (!openSession) {
        return {
          success: false,
          message: `Hello ${this.formatClientName(message.userName)}! There's no open session at your gym right now. Please check with your trainer.`,
          metadata: {
            userId: message.userId,
            businessId: message.businessId
          }
        };
      }

      console.log(`[${new Date().toISOString()}] Found open session:`, openSession.id);
      
      // Check if already checked in
      const [existingCheckIn] = await db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, message.userId),
            eq(UserTrainingSession.trainingSessionId, openSession.id)
          )
        )
        .limit(1);
      
      let checkInId: string;
      let isNewCheckIn = false;
      
      if (existingCheckIn && existingCheckIn.status === "checked_in") {
        // Already checked in
        checkInId = existingCheckIn.id;
        console.log(`[${new Date().toISOString()}] User already checked in`);
      } else if (existingCheckIn) {
        // Update existing registration
        await db
          .update(UserTrainingSession)
          .set({
            status: "checked_in",
            checkedInAt: now,
          })
          .where(eq(UserTrainingSession.id, existingCheckIn.id));
        
        checkInId = existingCheckIn.id;
        isNewCheckIn = true;
        console.log(`[${new Date().toISOString()}] Updated registration to checked in`);
      } else {
        // Create new check-in
        const [newCheckIn] = await db
          .insert(UserTrainingSession)
          .values({
            userId: message.userId,
            trainingSessionId: openSession.id,
            status: "checked_in",
            checkedInAt: now,
          })
          .returning();
        
        if (!newCheckIn) {
          throw new Error("Failed to create check-in record");
        }
        
        checkInId = newCheckIn.id;
        isNewCheckIn = true;
        console.log(`[${new Date().toISOString()}] Created new check-in`);
      }

      // Build response based on template
      let responseMessage = `Hello ${this.formatClientName(message.userName)}! You're ${isNewCheckIn ? 'checked in for' : 'already checked in for'} the session. Welcome!`;
      
      // Check for BMF template deterministic selections
      if (openSession.templateType) {
        const template = getWorkoutTemplate(openSession.templateType);
        
        console.log(`[${new Date().toISOString()}] Checking for template selections:`, {
          templateType: openSession.templateType,
          hasSmsConfig: !!template?.smsConfig,
          showDeterministicSelections: template?.smsConfig?.showDeterministicSelections
        });
        
        if (template?.smsConfig?.showDeterministicSelections) {
          try {
            // Try to get blueprint selections
            const blueprintExists = await BlueprintGenerationService.ensureBlueprintExists(openSession.id);
            
            let selections: any[] = [];
            
            if (blueprintExists) {
              selections = await ExerciseSelectionService.getDeterministicSelections(openSession.id);
              console.log(`[${new Date().toISOString()}] Got ${selections.length} selections from blueprint`);
            } else {
              // Use preview
              console.log(`[${new Date().toISOString()}] Blueprint not available, using preview`);
              selections = await ExerciseSelectionService.getDeterministicPreview(openSession.templateType);
            }
            
            if (selections.length > 0) {
              const clientName = ExerciseSelectionService.formatClientName(message.userName);
              responseMessage = ExerciseSelectionService.formatSelectionsForSMS(selections, clientName);
              console.log(`[${new Date().toISOString()}] Using deterministic selections in response`);
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error getting deterministic selections:`, error);
            // Fall back to standard response
          }
        }
      }
      
      // Add preference prompt if needed
      const shouldStartPreferences = isNewCheckIn || 
        (existingCheckIn && existingCheckIn.preferenceCollectionStep === "not_started");
      
      if (shouldStartPreferences) {
        const smsConfig = openSession.id 
          ? await TemplateSMSService.getSMSConfigForSession(openSession.id)
          : null;
        
        const preferencePrompt = TemplateSMSService.getPreferencePrompt(
          smsConfig, 
          message.userName
        );
        
        responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
      }

      return {
        success: true,
        message: responseMessage,
        metadata: {
          userId: message.userId,
          businessId: message.businessId,
          sessionId: openSession.id,
          checkInId,
          checkInSuccess: true,
          shouldStartPreferences
        }
      };

    } catch (error) {
      unifiedLogger.logError('Check-in handler error', error, message);
      throw error;
    }
  }
}