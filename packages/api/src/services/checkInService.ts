import { and, eq, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { TrainingSession, user, UserTrainingSession } from "@acme/db/schema";

import { createLogger } from "../utils/logger";
import { createDefaultPreferencesIfNeeded } from "./autoPreferenceService";
import { normalizePhoneNumber } from "./twilio";

const logger = createLogger("CheckInService");

// SSE broadcast function removed - will be replaced with Supabase Realtime

export interface CheckInResult {
  success: boolean;
  message: string;
  userId?: string;
  businessId?: string;
  sessionId?: string;
  sessionName?: string;
  checkInId?: string;
  phoneNumber?: string;
  shouldStartPreferences?: boolean;
  userName?: string;
}

export async function getUserByPhone(
  phoneNumber: string,
): Promise<{
  userId: string;
  businessId: string;
  trainingSessionId?: string;
} | null> {
  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.phone, normalizedPhone))
      .limit(1);

    if (!foundUser.length || !foundUser[0]) {
      return null;
    }

    // Check if user is checked into an active session
    const activeSession = await db
      .select({
        sessionId: UserTrainingSession.trainingSessionId,
      })
      .from(UserTrainingSession)
      .innerJoin(
        TrainingSession,
        eq(UserTrainingSession.trainingSessionId, TrainingSession.id),
      )
      .where(
        and(
          eq(UserTrainingSession.userId, foundUser[0].id),
          eq(UserTrainingSession.status, "checked_in"),
          eq(TrainingSession.status, "in_progress"),
        ),
      )
      .limit(1);

    return {
      userId: foundUser[0].id,
      businessId: foundUser[0].businessId || "",
      trainingSessionId: activeSession[0]?.sessionId,
    };
  } catch (error) {
    logger.error("Error finding user by phone", error);
    return null;
  }
}

export async function processCheckIn(
  phoneNumber: string,
): Promise<CheckInResult> {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    logger.info("Processing check-in", {
      originalPhone: phoneNumber,
      normalizedPhone: normalizedPhone,
    });

    // 1. Find user by normalized phone number only
    logger.info("Searching for user with normalized phone", {
      normalizedPhone,
    });

    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.phone, normalizedPhone))
      .limit(1);

    if (!foundUser.length || !foundUser[0]) {
      logger.warn("No user found for normalized phone", {
        normalizedPhone,
        originalPhone: phoneNumber,
      });
      return {
        success: false,
        message:
          "We couldn't find your account. Contact your trainer to get set up.",
      };
    }

    const clientUser = foundUser[0];
    logger.info("User found", {
      userId: clientUser.id,
      businessId: clientUser.businessId,
      name: clientUser.name,
    });

    // 2. Find in-progress session for user's business
    const now = new Date();
    const activeSession = await db
      .select()
      .from(TrainingSession)
      .where(
        and(
          eq(TrainingSession.businessId, clientUser.businessId),
          eq(TrainingSession.status, "in_progress"),
        ),
      )
      .limit(1);

    if (!activeSession.length || !activeSession[0]) {
      logger.warn("No in-progress session found", {
        businessId: clientUser.businessId,
      });
      return {
        success: false,
        message: `Hello ${clientUser.name}! There's no active session at your gym right now. Please check with your trainer.`,
      };
    }

    const session = activeSession[0];
    logger.info("In-progress session found", { sessionId: session.id });

    // 3. Check if already checked in
    const existingCheckIn = await db
      .select()
      .from(UserTrainingSession)
      .where(
        and(
          eq(UserTrainingSession.userId, clientUser.id),
          eq(UserTrainingSession.trainingSessionId, session.id),
        ),
      )
      .limit(1);

    if (
      existingCheckIn.length &&
      existingCheckIn[0] &&
      existingCheckIn[0].status === "checked_in"
    ) {
      logger.info("User already checked in", {
        userId: clientUser.id,
        sessionId: session.id,
      });
      return {
        success: true,
        message: `Hello ${clientUser.name}! You're already checked in for this session!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        sessionName: session.name,
        checkInId: existingCheckIn[0].id,
        phoneNumber: normalizedPhone,
        shouldStartPreferences:
          existingCheckIn[0].preferenceCollectionStep === "not_started",
        userName: clientUser.name,
      };
    }

    // 4. Create or update check-in record
    if (existingCheckIn.length && existingCheckIn[0]) {
      // Update existing registration to checked_in
      await db
        .update(UserTrainingSession)
        .set({
          status: "checked_in",
          checkedInAt: now,
        })
        .where(eq(UserTrainingSession.id, existingCheckIn[0].id));

      logger.info("Updated check-in status", {
        userId: clientUser.id,
        sessionId: session.id,
        checkInId: existingCheckIn[0].id,
      });

      // SSE broadcast removed - will be replaced with Supabase Realtime
      logger.info(
        "Check-in completed (real-time updates temporarily disabled)",
        {
          sessionId: session.id,
          userId: clientUser.id,
          name: clientUser.name,
        },
      );

      // Auto-create preferences for standard templates
      const autoPrefsCreated = await createDefaultPreferencesIfNeeded({
        userId: clientUser.id,
        sessionId: session.id,
        businessId: clientUser.businessId,
      });

      return {
        success: true,
        message: `Hello ${clientUser.name}! You're checked in for the session. Welcome!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        sessionName: session.name,
        checkInId: existingCheckIn[0].id,
        phoneNumber: normalizedPhone,
        shouldStartPreferences: true, // Always show preference prompt
        userName: clientUser.name,
      };
    } else {
      // Create new check-in record
      const newCheckInResult = await db
        .insert(UserTrainingSession)
        .values({
          userId: clientUser.id,
          trainingSessionId: session.id,
          status: "checked_in",
          checkedInAt: now,
        })
        .returning();

      const newCheckIn = newCheckInResult[0];

      if (!newCheckIn) {
        throw new Error("Failed to create check-in record");
      }

      logger.info("Created new check-in", {
        userId: clientUser.id,
        sessionId: session.id,
        checkInId: newCheckIn.id,
      });

      // SSE broadcast removed - will be replaced with Supabase Realtime
      logger.info(
        "Check-in completed (real-time updates temporarily disabled)",
        {
          sessionId: session.id,
          userId: clientUser.id,
          name: clientUser.name,
        },
      );

      // Auto-create preferences for standard templates
      const autoPrefsCreated = await createDefaultPreferencesIfNeeded({
        userId: clientUser.id,
        sessionId: session.id,
        businessId: clientUser.businessId,
      });

      return {
        success: true,
        message: `Hello ${clientUser.name}! You're checked in for the session. Welcome!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        sessionName: session.name,
        checkInId: newCheckIn.id,
        phoneNumber: normalizedPhone,
        shouldStartPreferences: true, // Always show preference prompt
        userName: clientUser.name,
      };
    }
  } catch (error) {
    logger.error("Check-in processing failed", error);
    return {
      success: false,
      message:
        "Sorry, something went wrong. Please try again or contact your trainer.",
    };
  }
}
