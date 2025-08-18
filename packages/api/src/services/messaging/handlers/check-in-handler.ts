import { getWorkoutTemplate } from "@acme/ai";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession, user, UserTrainingSession } from "@acme/db/schema";

import type {
  MessageIntent,
  MessageResponse,
  UnifiedMessage,
} from "../../../types/messaging";
import { createDefaultPreferencesIfNeeded } from "../../autoPreferenceService";
import { ExerciseSelectionService } from "../../sms/template-services/exercise-selection-service";
import { TemplateSMSService } from "../../sms/template-sms-service";
import { unifiedLogger } from "../unified-logger";
import { BaseMessageHandler } from "./base-handler";

// SSE broadcast function removed - will be replaced with Supabase Realtime

export class CheckInHandler extends BaseMessageHandler {
  async handle(
    message: UnifiedMessage,
    intent: MessageIntent,
  ): Promise<MessageResponse> {
    try {
      console.log(
        `[${new Date().toISOString()}] Processing check-in for user:`,
        {
          userId: message.userId,
          userName: message.userName,
          channel: message.channel,
        },
      );

      // Find open session for user's business
      const now = new Date();
      const [openSession] = await db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.businessId, message.businessId),
            eq(TrainingSession.status, "open"),
          ),
        )
        .limit(1);

      if (!openSession) {
        return {
          success: false,
          message: `Hello ${this.formatClientName(message.userName)}! There's no open session at your gym right now. Please check with your trainer.`,
          metadata: {
            userId: message.userId,
            businessId: message.businessId,
          },
        };
      }

      console.log(
        `[${new Date().toISOString()}] Found open session:`,
        openSession.id,
      );

      // Check if already checked in
      const [existingCheckIn] = await db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, message.userId),
            eq(UserTrainingSession.trainingSessionId, openSession.id),
          ),
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
        console.log(
          `[${new Date().toISOString()}] Updated registration to checked in`,
        );

        // SSE broadcast removed - will be replaced with Supabase Realtime
        console.log(
          `[${new Date().toISOString()}] Check-in completed (real-time updates temporarily disabled)`,
        );

        if (message.channel === "web") {
          // For web messages, we'll need to handle this differently with Supabase
          console.log(
            `[${new Date().toISOString()}] Web channel check-in noted`,
          );
          try {
            // Placeholder for future implementation
            // Removed HTTP broadcast - will be handled by Supabase Realtime
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] Web channel check-in error:`,
              error,
            );
          }
        }
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

        // SSE broadcast removed - will be replaced with Supabase Realtime
        console.log(
          `[${new Date().toISOString()}] Check-in completed (real-time updates temporarily disabled)`,
        );

        if (message.channel === "web") {
          // For web messages, we'll need to handle this differently with Supabase
          console.log(
            `[${new Date().toISOString()}] Web channel check-in noted`,
          );
          try {
            // Placeholder for future implementation
            // Removed HTTP broadcast - will be handled by Supabase Realtime
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] Web channel check-in error:`,
              error,
            );
          }
        }
      }

      // Auto-create preferences for standard templates
      const autoPrefsCreated = await createDefaultPreferencesIfNeeded({
        userId: message.userId,
        sessionId: openSession.id,
        businessId: message.businessId || openSession.businessId,
      });

      console.log(
        `[${new Date().toISOString()}] Auto preference creation result:`,
        {
          userId: message.userId,
          sessionId: openSession.id,
          autoPrefsCreated,
        },
      );

      // Build simple check-in response
      const responseMessage = `Welcome, ${this.formatClientName(message.userName)}! You're checked in. We'll get started once everyone joins.`;

      return {
        success: true,
        message: responseMessage,
        metadata: {
          userId: message.userId,
          businessId: message.businessId,
          sessionId: openSession.id,
          checkInId,
          checkInSuccess: true,
        },
      };
    } catch (error) {
      unifiedLogger.logError("Check-in handler error", error, message);
      throw error;
    }
  }
}
