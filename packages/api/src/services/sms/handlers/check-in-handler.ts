import { getWorkoutTemplate } from "@acme/ai";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession, user, UserTrainingSession } from "@acme/db/schema";

import { createLogger } from "../../../utils/logger";
import { getUserByPhone, processCheckIn } from "../../checkInService";
import { saveMessage } from "../../messageService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { ExerciseSelectionService } from "../template-services/exercise-selection-service";
import { TemplateSMSService } from "../template-sms-service";
import { SMSResponse } from "../types";

const logger = createLogger("CheckInHandler");

export class CheckInHandler {
  async handle(payload: any): Promise<SMSResponse> {
    try {
      const phoneNumber = payload.From;
      const messageContent = payload.Body;
      const messageSid = payload.MessageSid;
      const userId = payload.UserId;
      const channel = payload.Channel;

      logger.info("Check-in handler called", {
        phoneNumber,
        messageContent,
        userId,
        channel,
        hasUserId: !!userId,
        isInApp: channel === "in_app",
      });

      // Process the check-in - use userId if available (web app), otherwise use phone
      const checkInResult =
        userId && channel === "in_app"
          ? await this.processCheckInByUserId(userId)
          : await processCheckIn(phoneNumber);

      logger.info("Check-in processed", {
        success: checkInResult.success,
        userId: checkInResult.userId,
        message: checkInResult.message,
        sessionId: checkInResult.sessionId,
        shouldStartPreferences: checkInResult.shouldStartPreferences,
      });

      // Build response message
      let responseMessage = checkInResult.message;

      logger.info("[CIRCUIT CHECK-IN DEBUG] Initial check-in result", {
        success: checkInResult.success,
        sessionId: checkInResult.sessionId,
        shouldStartPreferences: checkInResult.shouldStartPreferences,
        hasSessionId: !!checkInResult.sessionId,
        initialMessage: responseMessage
      });

      // Add preference prompt if needed
      if (checkInResult.success && checkInResult.shouldStartPreferences) {
        // Get user info to include their name
        const userInfo = await getUserByPhone(phoneNumber);
        const userName = userInfo
          ? await this.getUserName(userInfo.userId)
          : undefined;

        // Get template-based SMS config
        const smsConfig = checkInResult.sessionId
          ? await TemplateSMSService.getSMSConfigForSession(
              checkInResult.sessionId,
            )
          : null;

        // Check if this is a BMF template that needs deterministic selections
        if (checkInResult.sessionId) {
          logger.info("[CIRCUIT DEBUG] Fetching session template type", {
            sessionId: checkInResult.sessionId
          });

          const [session] = await db
            .select({ templateType: TrainingSession.templateType })
            .from(TrainingSession)
            .where(eq(TrainingSession.id, checkInResult.sessionId))
            .limit(1);

          logger.info("[CIRCUIT DEBUG] Session query result", {
            sessionId: checkInResult.sessionId,
            sessionFound: !!session,
            templateType: session?.templateType
          });

          const template = session?.templateType
            ? getWorkoutTemplate(session.templateType)
            : null;

          logger.info("Checking for BMF template in standard handler", {
            sessionId: checkInResult.sessionId,
            templateType: session?.templateType,
            templateFound: !!template,
            smsConfig: template?.smsConfig,
            showDeterministicSelections:
              template?.smsConfig?.showDeterministicSelections,
            isBMF: session?.templateType === "full_body_bmf",
          });

          // Handle circuit template
          logger.info("[CIRCUIT CHECK-IN DEBUG] Checking if circuit template", {
            sessionId: checkInResult.sessionId,
            templateType: session?.templateType,
            isCircuit: session?.templateType === "circuit",
            sessionExists: !!session
          });

          if (session?.templateType === "circuit") {
            // Generate circuit config link for all users
            const baseUrl = process.env.SMS_BASE_URL || process.env.NEXTAUTH_URL || "http://192.168.68.133:3000";
            const circuitConfigLink = `${baseUrl}/sessions/${checkInResult.sessionId}/circuit-config`;
            
            logger.info("[CIRCUIT CHECK-IN DEBUG] Generating circuit response", {
              sessionId: checkInResult.sessionId,
              baseUrl,
              circuitConfigLink,
              userName,
              previousMessage: responseMessage
            });
            
            responseMessage = `Hello${userName ? ` ${userName}` : ""}! You're checked in for the circuit training session.\n\nConfigure the workout: ${circuitConfigLink}`;
            
            logger.info("[CIRCUIT CHECK-IN DEBUG] Circuit response set", {
              responseMessage,
              messageLength: responseMessage.length
            });
          }
          // Show deterministic exercise preview for BMF templates
          else if (
            session?.templateType === "full_body_bmf" ||
            template?.smsConfig?.showDeterministicSelections
          ) {
            try {
              logger.info("Getting exercise preview for BMF template", {
                sessionId: checkInResult.sessionId,
                templateType: session?.templateType,
              });

              // Always use preview selections for check-in message
              const selections =
                await ExerciseSelectionService.getDeterministicPreview(
                  session!.templateType || "standard",
                );

              if (selections.length > 0) {
                const clientName = ExerciseSelectionService.formatClientName(
                  userName || null,
                );
                responseMessage =
                  ExerciseSelectionService.formatSelectionsForSMS(
                    selections,
                    clientName,
                  );

                logger.info("Using exercise preview in check-in", {
                  sessionId: checkInResult.sessionId,
                  selectionCount: selections.length,
                });
              } else {
                // Fall back to template response
                logger.info(
                  "No preview selections found, using template response",
                );
                responseMessage = TemplateSMSService.getCheckInResponse(
                  smsConfig,
                  userName,
                );
                const preferencePrompt = TemplateSMSService.getPreferencePrompt(
                  smsConfig,
                  userName,
                );
                responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
              }
            } catch (previewError) {
              logger.error("Error getting exercise preview", {
                error: previewError,
                sessionId: checkInResult.sessionId,
                templateType: session?.templateType,
              });
              // Fall back to standard template response
              responseMessage = TemplateSMSService.getCheckInResponse(
                smsConfig,
                userName,
              );
              const preferencePrompt = TemplateSMSService.getPreferencePrompt(
                smsConfig,
                userName,
              );
              responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
            }
          } else {
            // Use standard template response
            responseMessage = TemplateSMSService.getCheckInResponse(
              smsConfig,
              userName,
            );
            const preferencePrompt = TemplateSMSService.getPreferencePrompt(
              smsConfig,
              userName,
            );
            responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
          }
        } else {
          // No session ID, use standard response
          responseMessage = TemplateSMSService.getCheckInResponse(
            smsConfig,
            userName,
          );
          const preferencePrompt = TemplateSMSService.getPreferencePrompt(
            smsConfig,
            userName,
          );
          responseMessage = `${responseMessage}\n\n${preferencePrompt}`;
        }

        logger.info(
          "Added template-based preference prompt to check-in response",
          {
            userId: checkInResult.userId,
            sessionId: checkInResult.sessionId,
            userName,
            hasTemplate: !!smsConfig,
          },
        );
      }

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        responseMessage,
        messageSid,
        payload, // Pass the full payload to access intent
        checkInResult,
      );

      logger.info("[CIRCUIT CHECK-IN DEBUG] Final response message", {
        responseMessage,
        sessionId: checkInResult.sessionId,
        messageLength: responseMessage.length,
        includesConfigLink: responseMessage.includes("Configure the workout:")
      });

      return {
        success: true,
        message: responseMessage,
        metadata: {
          userId: checkInResult.userId,
          businessId: checkInResult.businessId,
          sessionId: checkInResult.sessionId,
          checkInSuccess: checkInResult.success,
        },
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
    payload: any,
    checkInResult: any,
  ): Promise<void> {
    try {
      // For web app messages, we already have the user info from check-in result
      let userInfo;

      if (payload.Channel === "in_app" && checkInResult.userId) {
        userInfo = {
          userId: checkInResult.userId,
          businessId: checkInResult.businessId,
        };
      } else {
        userInfo = await getUserByPhone(phoneNumber);
      }

      if (!userInfo) {
        logger.warn("User not found for message saving", { phoneNumber });
        return;
      }

      // Save inbound message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "inbound",
        content: inboundContent,
        phoneNumber,
        metadata: {
          intent: payload.intent || { type: "check_in" },
          twilioMessageSid: messageSid,
          channel: payload.Channel,
        },
        status: "delivered",
      });

      // Save outbound response
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: "outbound",
        content: outboundContent,
        phoneNumber,
        metadata: {
          checkInResult: checkInResult.success
            ? { success: true, sessionId: checkInResult.sessionId }
            : { success: false },
        },
        status: "sent",
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


  private async processCheckInByUserId(userId: string): Promise<any> {
    try {
      logger.info("Processing check-in by userId", { userId });

      // Get user details
      const [userRecord] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!userRecord) {
        logger.warn("No user found for userId", { userId });
        return {
          success: false,
          message: "We couldn't find your account.",
        };
      }

      logger.info("User found", {
        userId: userRecord.id,
        businessId: userRecord.businessId,
        name: userRecord.name,
      });

      // Find in-progress session for user's business
      const now = new Date();
      const [activeSession] = await db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.businessId, userRecord.businessId),
            eq(TrainingSession.status, "in_progress"),
          ),
        )
        .limit(1);

      if (!activeSession) {
        logger.warn("No in-progress session found", {
          businessId: userRecord.businessId,
        });
        return {
          success: false,
          message: `Hello ${userRecord.name}! There's no active session at your gym right now. Please check with your trainer.`,
        };
      }

      logger.info("In-progress session found", { sessionId: activeSession.id });

      // Check if already checked in
      const [existingCheckIn] = await db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, userRecord.id),
            eq(UserTrainingSession.trainingSessionId, activeSession.id),
          ),
        )
        .limit(1);

      if (existingCheckIn && existingCheckIn.status === "checked_in") {
        logger.info("User already checked in", {
          userId: userRecord.id,
          sessionId: activeSession.id,
        });
        return {
          success: true,
          message: `Hello ${userRecord.name}! You're already checked in for this session!`,
          userId: userRecord.id,
          businessId: userRecord.businessId,
          sessionId: activeSession.id,
          checkInId: existingCheckIn.id,
          phoneNumber: userRecord.phone,
          shouldStartPreferences:
            existingCheckIn.preferenceCollectionStep === "not_started",
        };
      }

      // Create or update check-in record
      if (existingCheckIn) {
        // Update existing registration to checked_in
        await db
          .update(UserTrainingSession)
          .set({
            status: "checked_in",
            checkedInAt: now,
          })
          .where(eq(UserTrainingSession.id, existingCheckIn.id));

        logger.info("Updated check-in status", {
          userId: userRecord.id,
          sessionId: activeSession.id,
          checkInId: existingCheckIn.id,
        });

        return {
          success: true,
          message: `Hello ${userRecord.name}! You're checked in for the session. Welcome!`,
          userId: userRecord.id,
          businessId: userRecord.businessId,
          sessionId: activeSession.id,
          checkInId: existingCheckIn.id,
          phoneNumber: userRecord.phone,
          shouldStartPreferences: true,
        };
      } else {
        // Create new check-in record
        const [newCheckIn] = await db
          .insert(UserTrainingSession)
          .values({
            userId: userRecord.id,
            trainingSessionId: activeSession.id,
            status: "checked_in",
            checkedInAt: now,
          })
          .returning();

        if (!newCheckIn) {
          throw new Error("Failed to create check-in record");
        }

        logger.info("Created new check-in", {
          userId: userRecord.id,
          sessionId: activeSession.id,
          checkInId: newCheckIn.id,
        });

        return {
          success: true,
          message: `Hello ${userRecord.name}! You're checked in for the session. Welcome!`,
          userId: userRecord.id,
          businessId: userRecord.businessId,
          sessionId: activeSession.id,
          checkInId: newCheckIn.id,
          phoneNumber: userRecord.phone,
          shouldStartPreferences: true,
        };
      }
    } catch (error) {
      logger.error("Check-in by userId failed", { userId, error });
      return {
        success: false,
        message:
          "Sorry, something went wrong. Please try again or contact your trainer.",
      };
    }
  }
}
