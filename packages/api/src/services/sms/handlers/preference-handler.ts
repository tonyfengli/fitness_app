import { parseWorkoutPreferences } from "@acme/ai";
import { saveMessage } from "../../messageService";
import { getUserByPhone } from "../../checkInService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { createLogger } from "../../../utils/logger";
import { SMSResponse } from "../types";

const logger = createLogger("PreferenceHandler");

export class PreferenceHandler {
  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    preferenceCheck: any
  ): Promise<SMSResponse> {
    try {
      logger.info("Handling preference response", { 
        phoneNumber,
        userId: preferenceCheck.userId,
        sessionId: preferenceCheck.sessionId,
        currentStep: preferenceCheck.currentStep
      });

      // Parse preferences with LLM
      const startTime = Date.now();
      const parsedPreferences = await parseWorkoutPreferences(messageContent);
      const parseTime = Date.now() - startTime;
      
      logger.info("Parsed preferences", { 
        userId: preferenceCheck.userId,
        preferences: parsedPreferences,
        parseTime
      });

      // Determine next step and response
      const { nextStep, response } = this.determineNextStep(
        preferenceCheck.currentStep,
        parsedPreferences
      );

      // Save preferences
      await WorkoutPreferenceService.savePreferences(
        preferenceCheck.userId!,
        preferenceCheck.sessionId!,
        preferenceCheck.businessId!,
        parsedPreferences,
        nextStep
      );

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        response,
        messageSid,
        preferenceCheck,
        parsedPreferences,
        parseTime,
        nextStep
      );

      logger.info("Preference response complete", { 
        userId: preferenceCheck.userId,
        needsFollowUp: parsedPreferences.needsFollowUp,
        nextStep
      });

      return {
        success: true,
        message: response,
        metadata: {
          userId: preferenceCheck.userId,
          businessId: preferenceCheck.businessId,
          sessionId: preferenceCheck.sessionId,
          nextStep,
          parseTime
        }
      };
    } catch (error) {
      logger.error("Preference handler error", error);
      throw error;
    }
  }

  private determineNextStep(currentStep: string, parsedPreferences: any) {
    let nextStep: "initial_collected" | "followup_collected" | "complete";
    let response: string;
    
    if (currentStep === "not_started") {
      // First response
      if (parsedPreferences.needsFollowUp) {
        nextStep = "initial_collected";
        response = "Thanks! Can you tell me more about what specific areas you'd like to focus on or avoid today?";
      } else {
        nextStep = "complete";
        response = "Perfect! I've got your preferences and will use them to build your workout. See you in the gym!";
      }
    } else {
      // Follow-up response (from initial_collected)
      nextStep = "complete";
      response = "Great! I've got all your preferences now. Your workout will be tailored to how you're feeling today. See you in the gym!";
    }

    return { nextStep, response };
  }

  private async saveMessages(
    phoneNumber: string,
    inboundContent: string,
    outboundContent: string,
    messageSid: string,
    preferenceCheck: any,
    parsedPreferences: any,
    parseTime: number,
    nextStep: string
  ): Promise<void> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      
      if (!userInfo) {
        logger.warn("User not found for message saving", { phoneNumber });
        return;
      }

      // Save inbound preference message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'inbound',
        content: inboundContent,
        phoneNumber,
        metadata: {
          type: 'preference_collection',
          step: preferenceCheck.currentStep,
          twilioMessageSid: messageSid,
        },
        status: 'delivered',
      });

      // Save outbound response with detailed metadata
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'outbound',
        content: outboundContent,
        phoneNumber,
        metadata: {
          type: 'preference_collection_response',
          step: nextStep,
          llmParsing: {
            model: 'gpt-4o-mini',
            parseTimeMs: parseTime,
            inputLength: inboundContent.length,
            parsedData: parsedPreferences,
            systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
            extractedFields: {
              intensity: parsedPreferences.intensity || null,
              muscleTargets: parsedPreferences.muscleTargets || [],
              muscleLessens: parsedPreferences.muscleLessens || [],
              includeExercises: parsedPreferences.includeExercises || [],
              avoidExercises: parsedPreferences.avoidExercises || [],
              avoidJoints: parsedPreferences.avoidJoints || [],
              sessionGoal: parsedPreferences.sessionGoal || null,
              generalNotes: parsedPreferences.generalNotes || null,
              needsFollowUp: parsedPreferences.needsFollowUp || false,
            },
            userInput: inboundContent,
            confidenceIndicators: {
              hasIntensity: !!parsedPreferences.intensity,
              hasMuscleTargets: !!(parsedPreferences.muscleTargets?.length),
              hasRestrictions: !!(parsedPreferences.muscleLessens?.length || parsedPreferences.avoidJoints?.length),
              hasSpecificRequests: !!(parsedPreferences.includeExercises?.length || parsedPreferences.avoidExercises?.length),
              requiresFollowUp: parsedPreferences.needsFollowUp || false,
            }
          }
        },
        status: 'sent',
      });
    } catch (error) {
      logger.error("Failed to save messages", error);
      // Don't throw - message saving shouldn't break the flow
    }
  }
}