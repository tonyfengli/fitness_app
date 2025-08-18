import { createLogger } from "../../../utils/logger";
import { getUserByPhone } from "../../checkInService";
import { ConversationStateService } from "../../conversationStateService";
import { saveMessage } from "../../messageService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { SMSResponse } from "../types";

const logger = createLogger("DisambiguationHandler");

export class DisambiguationHandler {
  /**
   * Generate a clarification message based on the error type
   */
  static generateClarificationMessage(
    errorType: "mixed_content" | "no_numbers" | "invalid_format",
    maxOption: number,
  ): string {
    switch (errorType) {
      case "mixed_content":
        return maxOption === 1
          ? "I just need the number '1' to confirm your choice."
          : `I just need the numbers (1-${maxOption}). For example: "1" or "1,3"`;

      case "no_numbers":
        return maxOption === 1
          ? "Please reply with '1' to select that exercise."
          : `Please reply with just the numbers of your choices (1-${maxOption}). For example: "2" or "1,3"`;

      case "invalid_format":
        return `Please use only numbers separated by commas. For example: "1" or "2,4" (choose from 1-${maxOption})`;

      default:
        return `Please reply with numbers only (1-${maxOption})`;
    }
  }
  /**
   * Check if a message is a disambiguation response (numbers only)
   * Returns detailed error information for clarification responses
   */
  static isDisambiguationResponse(message: string): {
    isValid: boolean;
    selections?: number[];
    errorType?: "mixed_content" | "no_numbers" | "invalid_format";
    errorDetail?: string;
  } {
    const cleaned = message.trim().toLowerCase();

    // Check for common mixed content patterns
    if (
      /\b(yes|no|maybe|ok|sure|thanks|please|want|need|like|don't|dont)\b/i.test(
        message,
      )
    ) {
      return {
        isValid: false,
        errorType: "mixed_content",
        errorDetail: "Message contains words instead of just numbers",
      };
    }

    // Check if message contains only numbers, commas, spaces, and connecting words
    const validPattern = /^[\d\s,]+(\s+(and|&)\s+[\d\s,]+)*$/;

    if (!validPattern.test(cleaned)) {
      // Check if there are any numbers at all
      const hasNumbers = /\d/.test(cleaned);
      return {
        isValid: false,
        errorType: hasNumbers ? "invalid_format" : "no_numbers",
        errorDetail: hasNumbers
          ? "Message contains numbers but also other text"
          : "Message contains no numbers",
      };
    }

    // Extract all numbers from the message
    const numbers =
      cleaned
        .match(/\d+/g) // Find all number sequences
        ?.map((n) => parseInt(n))
        .filter((n) => !isNaN(n) && n > 0) || [];

    if (numbers.length === 0) {
      return {
        isValid: false,
        errorType: "no_numbers",
        errorDetail: "No valid numbers found",
      };
    }

    return {
      isValid: true,
      selections: numbers,
    };
  }

  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
  ): Promise<SMSResponse> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      if (!userInfo) {
        return {
          success: false,
          message: "Account not found. Please contact your trainer.",
          metadata: { reason: "no_user" },
        };
      }

      // Get pending disambiguation first to check clarification attempts
      const pending = await ConversationStateService.getPendingDisambiguation(
        userInfo.userId,
        userInfo.trainingSessionId!,
      );

      if (!pending) {
        return {
          success: false,
          message:
            "No pending exercise selection found. Please send your workout preferences again.",
          metadata: { reason: "no_pending_disambiguation" },
        };
      }

      // Parse the number selections with error details
      const parseResult =
        DisambiguationHandler.isDisambiguationResponse(messageContent);

      if (!parseResult.isValid) {
        // Check if we've already attempted clarification
        const clarificationAttempts = (pending.state?.metadata
          ?.clarificationAttempts || 0) as number;

        if (clarificationAttempts >= 1) {
          // Skip to follow-up after one failed clarification
          logger.info("Skipping to follow-up after clarification failure", {
            userId: userInfo.userId,
            attempts: clarificationAttempts + 1,
          });

          // Update preference state to skip disambiguation
          await WorkoutPreferenceService.savePreferences(
            userInfo.userId,
            userInfo.trainingSessionId!,
            userInfo.businessId,
            {},
            "disambiguation_clarifying",
          );

          // Generate targeted follow-up
          const { TargetedFollowupService } = await import(
            "../../targetedFollowupService"
          );
          const currentPrefs = await WorkoutPreferenceService.getPreferences(
            userInfo.trainingSessionId!,
          );

          const followupResult = await TargetedFollowupService.generateFollowup(
            "disambiguation_clarifying",
            currentPrefs || {},
          );

          // Update to followup_sent state
          await WorkoutPreferenceService.savePreferences(
            userInfo.userId,
            userInfo.trainingSessionId!,
            userInfo.businessId,
            {},
            "followup_sent",
          );

          return {
            success: true,
            message: `I'll note that for your workout. ${followupResult.followupQuestion}`,
            metadata: {
              skippedDisambiguation: true,
              clarificationAttempts: clarificationAttempts + 1,
              nextStep: "followup_sent",
            },
          };
        }

        // First clarification attempt - update attempts count
        await ConversationStateService.updateDisambiguationAttempts(
          pending.id,
          clarificationAttempts + 1,
        );

        // Generate clarification message based on error type
        const clarificationMessage =
          DisambiguationHandler.generateClarificationMessage(
            parseResult.errorType!,
            pending.options.length,
          );

        return {
          success: false,
          message: clarificationMessage,
          metadata: {
            reason: "clarification_needed",
            errorType: parseResult.errorType,
            clarificationAttempt: clarificationAttempts + 1,
          },
        };
      }

      const selections = parseResult.selections!;

      // Validate selections are within range
      const maxOption = pending.options.length;
      const invalidSelections = selections.filter((n) => n > maxOption);
      if (invalidSelections.length > 0) {
        return {
          success: false,
          message: `Invalid selection(s): ${invalidSelections.join(", ")}. Please choose from 1-${maxOption}.`,
          metadata: { reason: "out_of_range" },
        };
      }

      // Process the selection
      const selectedExercises = await ConversationStateService.processSelection(
        pending.id,
        selections,
      );

      // Get existing preferences to merge with
      const existingPrefs = await WorkoutPreferenceService.getPreferences(
        userInfo.trainingSessionId!,
      );

      // Merge selected exercises with existing preferences
      const mergedIncludeExercises = [
        ...(existingPrefs?.includeExercises || []),
        ...selectedExercises.map((ex) => ex.name),
      ];

      // Save the merged preferences
      await WorkoutPreferenceService.savePreferences(
        userInfo.userId,
        userInfo.trainingSessionId!,
        userInfo.businessId,
        {
          ...existingPrefs,
          includeExercises: mergedIncludeExercises,
        },
        "disambiguation_resolved",
      );

      // Generate targeted follow-up question with merged preferences
      const { TargetedFollowupService } = await import(
        "../../targetedFollowupService"
      );
      const followupResult = await TargetedFollowupService.generateFollowup(
        "disambiguation_resolved",
        {
          ...existingPrefs,
          includeExercises: mergedIncludeExercises,
        },
      );

      // Update state to followup_sent
      await WorkoutPreferenceService.savePreferences(
        userInfo.userId,
        userInfo.trainingSessionId!,
        userInfo.businessId,
        {},
        "followup_sent",
      );

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        messageSid,
        userInfo,
        pending,
        selectedExercises,
      );

      const exerciseNames = selectedExercises.map((ex) => ex.name).join(", ");
      const confirmationPrefix =
        selectedExercises.length === 1
          ? `Perfect! I'll include ${exerciseNames}. `
          : `Perfect! I'll include ${exerciseNames}. `;

      const response = confirmationPrefix + followupResult.followupQuestion;

      logger.info("Disambiguation completed with follow-up", {
        userId: userInfo.userId,
        selectedCount: selectedExercises.length,
        exercises: exerciseNames,
        followupFieldsAsked: followupResult.fieldsAsked,
      });

      return {
        success: true,
        message: response,
        metadata: {
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          selectedExercises: exerciseNames,
          nextStep: "followup_sent",
        },
      };
    } catch (error) {
      logger.error("Disambiguation handler error", error);
      return {
        success: false,
        message: "Sorry, something went wrong. Please try again.",
        metadata: { error: error instanceof Error ? error.message : "unknown" },
      };
    }
  }

  private async saveMessages(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: { userId: string; businessId: string },
    pending: { userInput: string; options: any[] },
    selectedExercises: any[],
  ): Promise<void> {
    try {
      // Save inbound selection message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "inbound",
        content: messageContent,
        phoneNumber,
        metadata: {
          type: "disambiguation_response",
          twilioMessageSid: messageSid,
          pendingContext: {
            originalInput: pending.userInput,
            optionsShown: pending.options.length,
          },
        },
        status: "delivered",
      });

      // Save outbound confirmation
      const exerciseNames = selectedExercises.map((ex) => ex.name).join(", ");
      const response =
        selectedExercises.length === 1
          ? `Perfect! I'll make sure to include ${exerciseNames} in your workout.`
          : `Perfect! I'll make sure to include these exercises in your workout: ${exerciseNames}`;

      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "outbound",
        content: response,
        phoneNumber,
        metadata: {
          type: "disambiguation_confirmation",
          selectedExercises: exerciseNames,
          selectionCount: selectedExercises.length,
        },
        status: "sent",
      });
    } catch (error) {
      logger.error("Failed to save disambiguation messages", error);
    }
  }
}
