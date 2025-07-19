import { db } from "@acme/db/client";
import { eq, and, or, sql } from "@acme/db";
import { user, TrainingSession, UserTrainingSession } from "@acme/db/schema";
import { normalizePhoneNumber } from "./twilio";
import { createLogger } from "../utils/logger";

const logger = createLogger("CheckInService");

// Type for the broadcast function - will be injected from the API layer
let broadcastCheckInEvent: ((sessionId: string, clientData: {
  userId: string;
  name: string;
  checkedInAt: string;
}) => void) | null = null;

export function setBroadcastFunction(fn: typeof broadcastCheckInEvent) {
  broadcastCheckInEvent = fn;
}

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
    
    // 1. Find user by normalized phone number only
    logger.info("Searching for user with normalized phone", { normalizedPhone });
    
    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.phone, normalizedPhone))
      .limit(1);
    
    if (!foundUser.length || !foundUser[0]) {
      logger.warn("No user found for normalized phone", { 
        normalizedPhone,
        originalPhone: phoneNumber 
      });
      return {
        success: false,
        message: "We couldn't find your account. Contact your trainer to get set up.",
      };
    }
    
    const clientUser = foundUser[0];
    logger.info("User found", { userId: clientUser.id, businessId: clientUser.businessId, name: clientUser.name });
    
    // 2. Find open session for user's business
    const now = new Date();
    const openSession = await db
      .select()
      .from(TrainingSession)
      .where(
        and(
          eq(TrainingSession.businessId, clientUser.businessId),
          eq(TrainingSession.status, "open")
        )
      )
      .limit(1);
    
    if (!openSession.length || !openSession[0]) {
      logger.warn("No open session found", { businessId: clientUser.businessId });
      return {
        success: false,
        message: `Hello ${clientUser.name}! There's no open session at your gym right now. Please check with your trainer.`,
      };
    }
    
    const session = openSession[0];
    logger.info("Open session found", { sessionId: session.id });
    
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
      
      // Broadcast check-in event if broadcast function is available
      if (broadcastCheckInEvent) {
        logger.info("Broadcasting check-in event", {
          sessionId: session.id,
          userId: clientUser.id,
          name: clientUser.name
        });
        broadcastCheckInEvent(session.id, {
          userId: clientUser.id,
          name: clientUser.name || "Unknown",
          checkedInAt: now.toISOString()
        });
      } else {
        logger.warn("Broadcast function not available");
      }
      
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
      
      // Broadcast check-in event if broadcast function is available
      if (broadcastCheckInEvent) {
        logger.info("Broadcasting check-in event", {
          sessionId: session.id,
          userId: clientUser.id,
          name: clientUser.name
        });
        broadcastCheckInEvent(session.id, {
          userId: clientUser.id,
          name: clientUser.name || "Unknown",
          checkedInAt: now.toISOString()
        });
      } else {
        logger.warn("Broadcast function not available");
      }
      
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