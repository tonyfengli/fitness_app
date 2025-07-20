import { ConversationStateService } from "../../conversationStateService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { saveMessage } from "../../messageService";
import { getUserByPhone } from "../../checkInService";
import { createLogger } from "../../../utils/logger";
import { SMSResponse } from "../types";

const logger = createLogger("DisambiguationHandler");

export class DisambiguationHandler {
  /**
   * Check if a message is a disambiguation response (numbers only)
   */
  static isDisambiguationResponse(message: string): { isValid: boolean; selections?: number[] } {
    // Match patterns like "1", "1,3", "1, 2, 4", "1 3 5", "1 and 2", "1, 2 and 3"
    const cleaned = message.trim().toLowerCase();
    
    // Check if message contains only numbers, commas, spaces, and connecting words
    const validPattern = /^[\d\s,]+(\s+(and|&)\s+[\d\s,]+)*$/;
    
    if (!validPattern.test(cleaned)) {
      return { isValid: false };
    }

    // Extract all numbers from the message
    const numbers = cleaned
      .match(/\d+/g)  // Find all number sequences
      ?.map(n => parseInt(n))
      .filter(n => !isNaN(n) && n > 0) || [];

    return {
      isValid: numbers.length > 0,
      selections: numbers
    };
  }

  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string
  ): Promise<SMSResponse> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      if (!userInfo) {
        return {
          success: false,
          message: "Account not found. Please contact your trainer.",
          metadata: { reason: "no_user" }
        };
      }

      // Parse the number selections
      const { selections } = DisambiguationHandler.isDisambiguationResponse(messageContent);
      if (!selections || selections.length === 0) {
        return {
          success: false,
          message: "Please reply with numbers only (e.g., '1' or '1,3')",
          metadata: { reason: "invalid_format" }
        };
      }

      // Get pending disambiguation
      const pending = await ConversationStateService.getPendingDisambiguation(
        userInfo.userId,
        userInfo.trainingSessionId!
      );

      if (!pending) {
        return {
          success: false,
          message: "No pending exercise selection found. Please send your workout preferences again.",
          metadata: { reason: "no_pending_disambiguation" }
        };
      }

      // Validate selections are within range
      const maxOption = pending.options.length;
      const invalidSelections = selections.filter(n => n > maxOption);
      if (invalidSelections.length > 0) {
        return {
          success: false,
          message: `Invalid selection(s): ${invalidSelections.join(', ')}. Please choose from 1-${maxOption}.`,
          metadata: { reason: "out_of_range" }
        };
      }

      // Process the selection
      const selectedExercises = await ConversationStateService.processSelection(
        pending.id,
        selections
      );

      // Save the selected exercises to preferences
      await WorkoutPreferenceService.savePreferences(
        userInfo.userId,
        userInfo.trainingSessionId!,
        userInfo.businessId,
        {
          includeExercises: selectedExercises.map(ex => ex.name)
        },
        "complete"
      );

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        messageSid,
        userInfo,
        pending,
        selectedExercises
      );

      const exerciseNames = selectedExercises.map(ex => ex.name).join(", ");
      const response = selectedExercises.length === 1
        ? `Perfect! I'll make sure to include ${exerciseNames} in your workout.`
        : `Perfect! I'll make sure to include these exercises in your workout: ${exerciseNames}`;

      logger.info("Disambiguation completed", {
        userId: userInfo.userId,
        selectedCount: selectedExercises.length,
        exercises: exerciseNames
      });

      return {
        success: true,
        message: response,
        metadata: {
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          selectedExercises: exerciseNames
        }
      };
    } catch (error) {
      logger.error("Disambiguation handler error", error);
      return {
        success: false,
        message: "Sorry, something went wrong. Please try again.",
        metadata: { error: error instanceof Error ? error.message : "unknown" }
      };
    }
  }

  private async saveMessages(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: { userId: string; businessId: string },
    pending: { userInput: string; options: any[] },
    selectedExercises: any[]
  ): Promise<void> {
    try {
      // Save inbound selection message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'inbound',
        content: messageContent,
        phoneNumber,
        metadata: {
          type: 'disambiguation_response',
          twilioMessageSid: messageSid,
          pendingContext: {
            originalInput: pending.userInput,
            optionsShown: pending.options.length
          }
        },
        status: 'delivered',
      });

      // Save outbound confirmation
      const exerciseNames = selectedExercises.map(ex => ex.name).join(", ");
      const response = selectedExercises.length === 1
        ? `Perfect! I'll make sure to include ${exerciseNames} in your workout.`
        : `Perfect! I'll make sure to include these exercises in your workout: ${exerciseNames}`;

      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'outbound',
        content: response,
        phoneNumber,
        metadata: {
          type: 'disambiguation_confirmation',
          selectedExercises: exerciseNames,
          selectionCount: selectedExercises.length
        },
        status: 'sent',
      });
    } catch (error) {
      logger.error("Failed to save disambiguation messages", error);
    }
  }
}