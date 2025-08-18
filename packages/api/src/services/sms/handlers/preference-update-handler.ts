import type { ParsedPreferences } from "@acme/ai";

import { createLogger } from "../../../utils/logger";
import { sessionTestDataLogger } from "../../../utils/sessionTestDataLogger";
import { getUserByPhone } from "../../checkInService";
import { ExerciseDisambiguationService } from "../../exerciseDisambiguationService";
import { saveMessage } from "../../messageService";
import { PreferenceUpdateParser } from "../../preferenceUpdateParser";
import { TargetedFollowupService } from "../../targetedFollowupService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { SMSResponse } from "../types";

const logger = createLogger("PreferenceUpdateHandler");

export class PreferenceUpdateHandler {
  /**
   * Handle preference updates in active mode
   */
  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
  ): Promise<SMSResponse> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      if (!userInfo || !userInfo.trainingSessionId) {
        return {
          success: false,
          message: "No active session found. Please check in first.",
          metadata: { reason: "no_session" },
        };
      }

      // Get current preferences
      const currentPreferences = await WorkoutPreferenceService.getPreferences(
        userInfo.trainingSessionId,
      );

      if (!currentPreferences) {
        return {
          success: false,
          message:
            "No preferences found for this session. Please send your initial preferences first.",
          metadata: { reason: "no_preferences" },
        };
      }

      // Parse the update request
      const updateResult = await PreferenceUpdateParser.parseUpdate(
        messageContent,
        { ...currentPreferences, needsFollowUp: false },
        userInfo.businessId,
      );

      if (!updateResult.hasUpdates) {
        // Check if this might be a general query or non-update message
        if (this.isGeneralQuery(messageContent)) {
          return {
            success: true,
            message:
              "Your current preferences are set. If you need to change anything, just let me know!",
            metadata: {
              type: "general_query",
              currentState: "preferences_active",
            },
          };
        }

        // Couldn't parse any updates
        return {
          success: true,
          message:
            "I didn't catch what you'd like to change. You can update things like intensity (easy/hard), exercises to add/skip, or areas to focus on.",
          metadata: {
            type: "parse_failed",
            currentState: "preferences_active",
          },
        };
      }

      // Check if disambiguation is needed
      if (updateResult.exerciseValidation?.needsDisambiguation) {
        // Get the validation result that needs disambiguation
        const validation =
          updateResult.exerciseValidation.includeValidation ||
          updateResult.exerciseValidation.avoidValidation;

        // Use the already-validated matches instead of re-processing
        const disambiguationResult = {
          needsDisambiguation: true,
          disambiguationMessage: ExerciseDisambiguationService.formatMessage(
            validation.matches.filter(
              (m: any) => m.matchedExercises.length > 1,
            ),
            {
              type: "preference_update",
              sessionId: userInfo.trainingSessionId,
              userId: userInfo.userId,
              businessId: userInfo.businessId,
            },
          ),
          ambiguousMatches: validation.matches.filter(
            (m: any) => m.matchedExercises.length > 1,
          ),
          allOptions: ExerciseDisambiguationService.collectAllOptions(
            validation.matches.filter(
              (m: any) => m.matchedExercises.length > 1,
            ),
          ),
        };

        if (disambiguationResult.needsDisambiguation) {
          // Save disambiguation state
          await ExerciseDisambiguationService.saveDisambiguationState(
            {
              ambiguousMatches: disambiguationResult.ambiguousMatches!,
              allOptions: disambiguationResult.allOptions!,
              originalIntent:
                updateResult.updateType === "remove" ? "avoid" : "include",
            },
            {
              type: "preference_update",
              sessionId: userInfo.trainingSessionId,
              userId: userInfo.userId,
              businessId: userInfo.businessId,
            },
          );

          // Log disambiguation if session logging is enabled
          if (sessionTestDataLogger.isEnabled() && userInfo.trainingSessionId) {
            sessionTestDataLogger.initSession(
              userInfo.trainingSessionId,
              phoneNumber,
            );

            // Log inbound message
            sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
              direction: "inbound",
              content: messageContent,
              metadata: {
                messageSid,
                currentStep: "preferences_active",
                updateType: "preference_update",
                requiresDisambiguation: true,
              },
            });

            // Log outbound disambiguation message
            sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
              direction: "outbound",
              content: disambiguationResult.disambiguationMessage!,
              metadata: {
                type: "disambiguation_request",
                ambiguousMatches: disambiguationResult.ambiguousMatches,
                options: disambiguationResult.allOptions,
                currentState: "preferences_active",
              },
            });

            await sessionTestDataLogger.saveSessionData(
              userInfo.trainingSessionId,
            );
          }

          // Save messages
          await saveMessage({
            userId: userInfo.userId,
            businessId: userInfo.businessId,
            direction: "inbound",
            content: messageContent,
            phoneNumber,
            metadata: {
              type: "preference_update",
              requiresDisambiguation: true,
              twilioMessageSid: messageSid,
            },
            status: "delivered",
          });

          await saveMessage({
            userId: userInfo.userId,
            businessId: userInfo.businessId,
            direction: "outbound",
            content: disambiguationResult.disambiguationMessage!,
            phoneNumber,
            metadata: {
              type: "disambiguation_request",
              updateContext: "preference_update",
              optionCount: disambiguationResult.allOptions?.length,
            },
            status: "sent",
          });

          return {
            success: true,
            message: disambiguationResult.disambiguationMessage!,
            metadata: {
              userId: userInfo.userId,
              businessId: userInfo.businessId,
              requiresDisambiguation: true,
              currentState: "preferences_active",
            },
          };
        }
      }

      // Apply the updates (no disambiguation needed)
      const updatedPreferences = this.mergePreferences(
        { ...currentPreferences, needsFollowUp: false },
        updateResult.updates,
      ) as ParsedPreferences;

      // Save the updated preferences
      await WorkoutPreferenceService.savePreferences(
        userInfo.userId,
        userInfo.trainingSessionId,
        userInfo.businessId,
        updatedPreferences,
        "preferences_active",
      );

      // Generate confirmation message
      const confirmationMessage =
        TargetedFollowupService.generateUpdateResponse(
          updateResult.fieldsUpdated,
        );

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        messageSid,
        userInfo,
        updateResult,
        confirmationMessage,
      );

      // Log to session test data if enabled
      if (sessionTestDataLogger.isEnabled() && userInfo.trainingSessionId) {
        sessionTestDataLogger.initSession(
          userInfo.trainingSessionId,
          phoneNumber,
        );

        // Log inbound message
        sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
          direction: "inbound",
          content: messageContent,
          metadata: {
            messageSid,
            currentStep: "preferences_active",
            updateType: "preference_update",
          },
        });

        // Log outbound response
        sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
          direction: "outbound",
          content: confirmationMessage,
          metadata: {
            updatedPreferences,
            fieldsUpdated: updateResult.fieldsUpdated,
            updateType: updateResult.updateType,
          },
        });

        // Save session data
        await sessionTestDataLogger.saveSessionData(userInfo.trainingSessionId);
      }

      logger.info("Preference update processed", {
        userId: userInfo.userId,
        sessionId: userInfo.trainingSessionId,
        fieldsUpdated: updateResult.fieldsUpdated,
        updateType: updateResult.updateType,
      });

      return {
        success: true,
        message: confirmationMessage,
        metadata: {
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          fieldsUpdated: updateResult.fieldsUpdated,
          updateType: updateResult.updateType,
          currentState: "preferences_active",
        },
      };
    } catch (error) {
      logger.error("Preference update handler error", error);
      return {
        success: false,
        message: "Sorry, I couldn't update your preferences. Please try again.",
        metadata: { error: error instanceof Error ? error.message : "unknown" },
      };
    }
  }

  /**
   * Check if message is a general query rather than an update
   */
  private isGeneralQuery(message: string): boolean {
    const queryPatterns = [
      /\b(what|how|when|where|why|who)\b.*\?/i,
      /\b(am i|are we|is it|should i)\b/i,
      /\b(okay|ok|good|great|thanks|thank you|sounds good|perfect)\b/i,
      /^(yes|no|maybe|sure)$/i,
    ];

    return queryPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Merge current preferences with updates
   */
  private mergePreferences(
    current: ParsedPreferences & {
      intensitySource?: "explicit" | "default" | "inherited";
      sessionGoalSource?: "explicit" | "default" | "inherited";
    },
    updates: Partial<ParsedPreferences>,
  ): ParsedPreferences & {
    intensitySource?: "explicit" | "default" | "inherited";
    sessionGoalSource?: "explicit" | "default" | "inherited";
  } {
    const merged: ParsedPreferences & {
      intensitySource?: "explicit" | "default" | "inherited";
      sessionGoalSource?: "explicit" | "default" | "inherited";
    } = {
      ...current,
      needsFollowUp: false,
    };

    // Handle simple overwrites with source tracking
    if (updates.intensity) {
      merged.intensity = updates.intensity;
      merged.intensitySource = "explicit"; // User explicitly updated
    }
    if (updates.sessionGoal !== undefined) {
      merged.sessionGoal = updates.sessionGoal;
      merged.sessionGoalSource = "explicit"; // User explicitly updated
    }

    // Handle array merges
    // For includeExercises and avoidExercises, use the updates directly
    // as they've already been processed by PreferenceUpdateParser
    if (updates.includeExercises !== undefined) {
      merged.includeExercises = updates.includeExercises;
    }

    if (updates.avoidExercises !== undefined) {
      merged.avoidExercises = updates.avoidExercises;
    }

    // For muscle and joint arrays, append to existing (avoiding duplicates)
    if (updates.muscleTargets) {
      merged.muscleTargets = Array.from(
        new Set([...(current.muscleTargets || []), ...updates.muscleTargets]),
      );
    }

    if (updates.muscleLessens) {
      merged.muscleLessens = Array.from(
        new Set([...(current.muscleLessens || []), ...updates.muscleLessens]),
      );
    }

    if (updates.avoidJoints) {
      merged.avoidJoints = Array.from(
        new Set([...(current.avoidJoints || []), ...updates.avoidJoints]),
      );
    }

    return merged;
  }

  /**
   * Save inbound and outbound messages
   */
  private async saveMessages(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    userInfo: { userId: string; businessId: string },
    updateResult: any,
    confirmationMessage: string,
  ): Promise<void> {
    try {
      // Save inbound update message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "inbound",
        content: messageContent,
        phoneNumber,
        metadata: {
          type: "preference_update",
          twilioMessageSid: messageSid,
          updateResult: {
            fieldsUpdated: updateResult.fieldsUpdated,
            updateType: updateResult.updateType,
          },
        },
        status: "delivered",
      });

      // Save outbound confirmation
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "outbound",
        content: confirmationMessage,
        phoneNumber,
        metadata: {
          type: "preference_update_confirmation",
          fieldsUpdated: updateResult.fieldsUpdated,
        },
        status: "sent",
      });
    } catch (error) {
      logger.error("Failed to save preference update messages", error);
    }
  }
}
