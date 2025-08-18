import type { LinearFlow, LinearFlowStep } from "@acme/ai";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { UserTrainingSession, WorkoutPreferences } from "@acme/db/schema";

import type { SMSResponse } from "../../types";
import { createLogger } from "../../../../utils/logger";
import { getUserByPhone } from "../../../checkInService";
import { saveMessage } from "../../../messageService";

const logger = createLogger("LinearFlowHandler");

interface LinearFlowState {
  currentStepIndex: number;
  collectedData: Record<string, any>;
  startedAt: Date;
}

export class LinearFlowHandler {
  /**
   * Handle incoming message for linear flow
   */
  static async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    sessionId: string,
    linearFlow: LinearFlow,
  ): Promise<SMSResponse> {
    try {
      // Get current flow state
      const flowState = await this.getFlowState(phoneNumber, sessionId);

      if (!flowState) {
        // Start new flow
        return await this.startFlow(
          phoneNumber,
          messageSid,
          sessionId,
          linearFlow,
        );
      }

      // Process current step
      const currentStep = linearFlow.steps[flowState.currentStepIndex];
      if (!currentStep) {
        // Flow complete
        return await this.completeFlow(
          phoneNumber,
          messageSid,
          sessionId,
          linearFlow,
          flowState,
        );
      }

      // Validate and store response
      const validation = this.validateResponse(messageContent, currentStep);
      if (!validation.valid) {
        return {
          success: true,
          message:
            validation.errorMessage || "Please provide a valid response.",
          metadata: { flowType: "linear", stepId: currentStep.id },
        };
      }

      // Store collected data
      flowState.collectedData[currentStep.fieldToCollect] = validation.value;

      // Move to next step
      flowState.currentStepIndex++;
      await this.saveFlowState(phoneNumber, sessionId, flowState);

      // Get next step or complete
      const nextStep = linearFlow.steps[flowState.currentStepIndex];
      if (!nextStep) {
        return await this.completeFlow(
          phoneNumber,
          messageSid,
          sessionId,
          linearFlow,
          flowState,
        );
      }

      // Send next question
      return {
        success: true,
        message: nextStep.question,
        metadata: {
          flowType: "linear",
          stepId: nextStep.id,
          stepIndex: flowState.currentStepIndex,
          totalSteps: linearFlow.steps.length,
        },
      };
    } catch (error) {
      logger.error("Linear flow handler error", error);
      return {
        success: false,
        message: "Sorry, something went wrong. Please try again.",
      };
    }
  }

  /**
   * Start a new linear flow
   */
  private static async startFlow(
    phoneNumber: string,
    messageSid: string,
    sessionId: string,
    linearFlow: LinearFlow,
  ): Promise<SMSResponse> {
    const firstStep = linearFlow.steps[0];
    if (!firstStep) {
      return {
        success: true,
        message: linearFlow.confirmationMessage,
        metadata: { flowType: "linear", complete: true },
      };
    }

    // Initialize flow state
    const flowState: LinearFlowState = {
      currentStepIndex: 0,
      collectedData: {},
      startedAt: new Date(),
    };

    await this.saveFlowState(phoneNumber, sessionId, flowState);

    return {
      success: true,
      message: firstStep.question,
      metadata: {
        flowType: "linear",
        stepId: firstStep.id,
        stepIndex: 0,
        totalSteps: linearFlow.steps.length,
      },
    };
  }

  /**
   * Complete the linear flow
   */
  private static async completeFlow(
    phoneNumber: string,
    messageSid: string,
    sessionId: string,
    linearFlow: LinearFlow,
    flowState: LinearFlowState,
  ): Promise<SMSResponse> {
    try {
      // Map collected data to workout preferences
      const preferences = this.mapToPreferences(flowState.collectedData);

      // Save preferences
      const userInfo = await getUserByPhone(phoneNumber);
      if (userInfo) {
        await db.transaction(async (tx) => {
          // Save preferences
          await tx
            .insert(WorkoutPreferences)
            .values({
              userId: userInfo.userId,
              trainingSessionId: sessionId,
              businessId: userInfo.businessId,
              ...preferences,
              collectionMethod: "sms",
            })
            .onConflictDoUpdate({
              target: [
                WorkoutPreferences.userId,
                WorkoutPreferences.trainingSessionId,
              ],
              set: {
                ...preferences,
                collectedAt: new Date(),
              },
            });

          // Update user training session status
          await tx
            .update(UserTrainingSession)
            .set({
              preferenceCollectionStep: "preferences_active",
            })
            .where(
              and(
                eq(UserTrainingSession.userId, userInfo.userId),
                eq(UserTrainingSession.trainingSessionId, sessionId),
              ),
            );
        });
      }

      // Clear flow state
      await this.clearFlowState(phoneNumber, sessionId);

      return {
        success: true,
        message: linearFlow.confirmationMessage,
        metadata: {
          flowType: "linear",
          complete: true,
          collectedData: flowState.collectedData,
        },
      };
    } catch (error) {
      logger.error("Error completing flow", error);
      return {
        success: false,
        message: "Sorry, couldn't save your preferences. Please try again.",
      };
    }
  }

  /**
   * Validate response based on step configuration
   */
  private static validateResponse(
    response: string,
    step: LinearFlowStep,
  ): { valid: boolean; value?: any; errorMessage?: string } {
    const trimmedResponse = response.trim();

    // If not required and empty, skip
    if (!step.required && !trimmedResponse) {
      return { valid: true, value: null };
    }

    // If required and empty
    if (step.required && !trimmedResponse) {
      return {
        valid: false,
        errorMessage: "This field is required. Please provide an answer.",
      };
    }

    // Validate based on type
    switch (step.validation) {
      case "choice":
        if (!step.options) {
          return { valid: true, value: trimmedResponse };
        }

        // Check if response matches an option (case insensitive)
        const normalizedResponse = trimmedResponse.toLowerCase();
        const matchedOption = step.options.find(
          (opt) => opt.toLowerCase() === normalizedResponse,
        );

        if (matchedOption) {
          return { valid: true, value: matchedOption };
        }

        // Check if it's a number selection (1, 2, 3, etc)
        const numberMatch = trimmedResponse.match(/^(\d+)$/);
        if (numberMatch) {
          const index = parseInt(numberMatch[1]!) - 1;
          if (index >= 0 && index < step.options.length) {
            return { valid: true, value: step.options[index] };
          }
        }

        return {
          valid: false,
          errorMessage: `Please choose from: ${step.options.join(", ")}`,
        };

      case "number":
        const num = parseInt(trimmedResponse);
        if (isNaN(num)) {
          return {
            valid: false,
            errorMessage: "Please provide a number.",
          };
        }
        return { valid: true, value: num };

      default:
        // Text validation - just ensure it's not too long
        if (trimmedResponse.length > 200) {
          return {
            valid: false,
            errorMessage: "Response is too long. Please keep it brief.",
          };
        }
        return { valid: true, value: trimmedResponse };
    }
  }

  /**
   * Map collected data to workout preferences
   */
  private static mapToPreferences(
    collectedData: Record<string, any>,
  ): Record<string, any> {
    const preferences: any = {};

    // Map common fields
    if (collectedData.intensity) {
      preferences.intensity = collectedData.intensity.toLowerCase();
    }
    if (collectedData.sessionGoal) {
      preferences.sessionGoal = collectedData.sessionGoal;
    }
    if (collectedData.muscleTargets) {
      preferences.muscleTargets = Array.isArray(collectedData.muscleTargets)
        ? collectedData.muscleTargets
        : [collectedData.muscleTargets];
    }
    if (collectedData.avoidExercises) {
      preferences.avoidExercises = Array.isArray(collectedData.avoidExercises)
        ? collectedData.avoidExercises
        : collectedData.avoidExercises.split(",").map((e: string) => e.trim());
    }
    if (collectedData.avoidJoints) {
      preferences.avoidJoints = Array.isArray(collectedData.avoidJoints)
        ? collectedData.avoidJoints
        : [collectedData.avoidJoints];
    }

    // Handle custom fields
    // Templates can define their own field mappings

    return preferences;
  }

  /**
   * Flow state management (using conversation state table for now)
   */
  private static async getFlowState(
    phoneNumber: string,
    sessionId: string,
  ): Promise<LinearFlowState | null> {
    // For MVP, store in conversation state
    // In future, could have dedicated flow state table
    const userInfo = await getUserByPhone(phoneNumber);
    if (!userInfo) return null;

    // Check if we have flow state in conversation state
    // This is a simplified approach - in production might want dedicated storage
    return null; // For now, always start fresh
  }

  private static async saveFlowState(
    phoneNumber: string,
    sessionId: string,
    state: LinearFlowState,
  ): Promise<void> {
    // For MVP, we'll keep state in memory or conversation state
    // In production, would persist this properly
    logger.info("Flow state would be saved", { phoneNumber, sessionId, state });
  }

  private static async clearFlowState(
    phoneNumber: string,
    sessionId: string,
  ): Promise<void> {
    logger.info("Flow state cleared", { phoneNumber, sessionId });
  }
}
