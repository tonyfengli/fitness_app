import { db } from "@acme/db/client";
import { eq, and, gte, lte, sql } from "@acme/db";
import { user, TrainingSession, UserTrainingSession } from "@acme/db/schema";
import { normalizePhoneNumber } from "./twilio";
import { createLogger } from "../utils/logger";

const logger = createLogger("CheckInService");

export interface CheckInResult {
  success: boolean;
  message: string;
  userId?: string;
  businessId?: string;
  sessionId?: string;
  checkInId?: string;
}

export async function processCheckIn(phoneNumber: string): Promise<CheckInResult> {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    logger.info("Processing check-in", { 
      originalPhone: phoneNumber,
      normalizedPhone: normalizedPhone 
    });
    
    // 1. Find user by phone number - try multiple formats
    let foundUser = await db
      .select()
      .from(user)
      .where(eq(user.phone, normalizedPhone))
      .limit(1);
    
    // If not found, try without country code
    if (!foundUser.length && normalizedPhone.startsWith("+1")) {
      const phoneWithoutCountry = normalizedPhone.substring(2);
      logger.info("Trying without country code", { phone: phoneWithoutCountry });
      
      foundUser = await db
        .select()
        .from(user)
        .where(eq(user.phone, phoneWithoutCountry))
        .limit(1);
    }
    
    // If still not found, try the original format
    if (!foundUser.length) {
      logger.info("Trying original format", { phone: phoneNumber });
      
      foundUser = await db
        .select()
        .from(user)
        .where(eq(user.phone, phoneNumber))
        .limit(1);
    }
    
    if (!foundUser.length || !foundUser[0]) {
      logger.warn("No user found for any phone format", { 
        tried: [normalizedPhone, normalizedPhone.substring(2), phoneNumber] 
      });
      return {
        success: false,
        message: "We couldn't find your account. Contact your trainer to get set up.",
      };
    }
    
    const clientUser = foundUser[0];
    logger.info("User found", { userId: clientUser.id, businessId: clientUser.businessId, name: clientUser.name });
    
    // 2. Find active session for user's business
    const now = new Date();
    const activeSession = await db
      .select()
      .from(TrainingSession)
      .where(
        and(
          eq(TrainingSession.businessId, clientUser.businessId),
          lte(TrainingSession.scheduledAt, now),
          gte(
            sql`${TrainingSession.scheduledAt} + INTERVAL '1 minute' * ${TrainingSession.durationMinutes}`,
            now
          )
        )
      )
      .limit(1);
    
    if (!activeSession.length || !activeSession[0]) {
      logger.warn("No active session found", { businessId: clientUser.businessId });
      return {
        success: false,
        message: `Hello ${clientUser.name}! There's no active session at your gym right now. Please check with your trainer.`,
      };
    }
    
    const session = activeSession[0];
    logger.info("Active session found", { sessionId: session.id });
    
    // 3. Check if already checked in
    const existingCheckIn = await db
      .select()
      .from(UserTrainingSession)
      .where(
        and(
          eq(UserTrainingSession.userId, clientUser.id),
          eq(UserTrainingSession.trainingSessionId, session.id)
        )
      )
      .limit(1);
    
    if (existingCheckIn.length && existingCheckIn[0] && existingCheckIn[0].status === "checked_in") {
      logger.info("User already checked in", { userId: clientUser.id, sessionId: session.id });
      return {
        success: true,
        message: `Hello ${clientUser.name}! You're already checked in for this session!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        checkInId: existingCheckIn[0].id,
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
        checkInId: existingCheckIn[0].id 
      });
      
      return {
        success: true,
        message: `Hello ${clientUser.name}! You're checked in for the session. Welcome!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        checkInId: existingCheckIn[0].id,
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
        checkInId: newCheckIn.id 
      });
      
      return {
        success: true,
        message: `Hello ${clientUser.name}! You're checked in for the session. Welcome!`,
        userId: clientUser.id,
        businessId: clientUser.businessId,
        sessionId: session.id,
        checkInId: newCheckIn.id,
      };
    }
  } catch (error) {
    logger.error("Check-in processing failed", error);
    return {
      success: false,
      message: "Sorry, something went wrong. Please try again or contact your trainer.",
    };
  }
}