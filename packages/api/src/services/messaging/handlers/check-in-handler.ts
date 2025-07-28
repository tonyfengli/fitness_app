import { BaseMessageHandler } from './base-handler';
import { UnifiedMessage, MessageResponse, MessageIntent } from '../../../types/messaging';
import { unifiedLogger } from '../unified-logger';
import { db } from "@acme/db/client";
import { eq, and } from "@acme/db";
import { user, TrainingSession, UserTrainingSession } from "@acme/db/schema";
import { getWorkoutTemplate } from "@acme/ai";
import { TemplateSMSService } from '../../sms/template-sms-service';
import { BlueprintGenerationService } from '../../blueprint-generation-service';
import { ExerciseSelectionService } from '../../sms/template-services/exercise-selection-service';

// Type for the broadcast function - will be injected from the API layer
let broadcastCheckInEvent: ((sessionId: string, clientData: {
  userId: string;
  name: string;
  checkedInAt: string;
}) => void) | null = null;

export function setBroadcastFunction(fn: typeof broadcastCheckInEvent) {
  broadcastCheckInEvent = fn;
}

export class CheckInHandler extends BaseMessageHandler {
  async handle(message: UnifiedMessage, intent: MessageIntent): Promise<MessageResponse> {
    try {
      console.log(`[${new Date().toISOString()}] Processing check-in for user:`, {
        userId: message.userId,
        userName: message.userName,
        channel: message.channel
      });

      // Find open session for user's business
      const now = new Date();
      const [openSession] = await db
        .select()
        .from(TrainingSession)
        .where(
          and(
            eq(TrainingSession.businessId, message.businessId),
            eq(TrainingSession.status, "open")
          )
        )
        .limit(1);
      
      if (!openSession) {
        return {
          success: false,
          message: `Hello ${this.formatClientName(message.userName)}! There's no open session at your gym right now. Please check with your trainer.`,
          metadata: {
            userId: message.userId,
            businessId: message.businessId
          }
        };
      }

      console.log(`[${new Date().toISOString()}] Found open session:`, openSession.id);
      
      // Check if already checked in
      const [existingCheckIn] = await db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, message.userId),
            eq(UserTrainingSession.trainingSessionId, openSession.id)
          )
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
        console.log(`[${new Date().toISOString()}] Updated registration to checked in`);
        
        // Broadcast check-in event for SSE
        if (broadcastCheckInEvent) {
          console.log(`[${new Date().toISOString()}] Broadcasting check-in event via function`);
          broadcastCheckInEvent(openSession.id, {
            userId: message.userId,
            name: message.userName || "Unknown",
            checkedInAt: now.toISOString()
          });
        } else if (message.channel === 'web') {
          // For web messages, call the broadcast endpoint directly
          console.log(`[${new Date().toISOString()}] Broadcasting check-in event via HTTP for web channel`);
          try {
            // Use localhost for development
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const broadcastUrl = new URL('/api/internal/broadcast-check-in', baseUrl);
            
            const response = await fetch(broadcastUrl.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: openSession.id,
                userId: message.userId,
                name: message.userName || "Unknown",
                checkedInAt: now.toISOString()
              })
            });
            
            if (!response.ok) {
              console.error(`[${new Date().toISOString()}] Broadcast HTTP response not ok:`, response.status);
            } else {
              console.log(`[${new Date().toISOString()}] Broadcast check-in event via HTTP successful`);
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to broadcast check-in via HTTP:`, error);
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
        
        // Broadcast check-in event for SSE
        if (broadcastCheckInEvent) {
          console.log(`[${new Date().toISOString()}] Broadcasting check-in event via function`);
          broadcastCheckInEvent(openSession.id, {
            userId: message.userId,
            name: message.userName || "Unknown",
            checkedInAt: now.toISOString()
          });
        } else if (message.channel === 'web') {
          // For web messages, call the broadcast endpoint directly
          console.log(`[${new Date().toISOString()}] Broadcasting check-in event via HTTP for web channel`);
          try {
            // Use localhost for development
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const broadcastUrl = new URL('/api/internal/broadcast-check-in', baseUrl);
            
            const response = await fetch(broadcastUrl.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: openSession.id,
                userId: message.userId,
                name: message.userName || "Unknown",
                checkedInAt: now.toISOString()
              })
            });
            
            if (!response.ok) {
              console.error(`[${new Date().toISOString()}] Broadcast HTTP response not ok:`, response.status);
            } else {
              console.log(`[${new Date().toISOString()}] Broadcast check-in event via HTTP successful`);
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to broadcast check-in via HTTP:`, error);
          }
        }
      }

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
          checkInSuccess: true
        }
      };

    } catch (error) {
      unifiedLogger.logError('Check-in handler error', error, message);
      throw error;
    }
  }
}