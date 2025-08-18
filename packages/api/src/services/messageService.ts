import { desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { messages } from "@acme/db/schema";

import { createLogger } from "../utils/logger";

const logger = createLogger("MessageService");

interface SaveMessageParams {
  userId: string;
  businessId: string;
  direction: "inbound" | "outbound";
  content: string;
  channel?: "sms" | "in_app";
  phoneNumber?: string;
  metadata?: {
    intent?: { type: string; confidence: number };
    twilioMessageSid?: string;
    checkInResult?: { success: boolean; sessionId?: string };
    sentBy?: string;
    type?: string; // For message type classification
    step?: string; // For preference collection steps
    llmParsing?: any; // For LLM parsing metadata
    [key: string]: any; // Allow additional properties
  };
  status?: "sent" | "delivered" | "failed" | "read";
}

export async function saveMessage(params: SaveMessageParams) {
  try {
    const [savedMessage] = await db
      .insert(messages)
      .values({
        userId: params.userId,
        businessId: params.businessId,
        direction: params.direction,
        channel: params.channel || "sms",
        content: params.content,
        phoneNumber: params.phoneNumber,
        metadata: params.metadata || {},
        status: params.status || "sent",
      })
      .returning();

    logger.info("Message saved", {
      messageId: savedMessage?.id,
      userId: params.userId,
      direction: params.direction,
    });

    return savedMessage;
  } catch (error) {
    logger.error("Failed to save message", error);
    // Don't throw - we don't want message saving to break the check-in flow
    return null;
  }
}

export async function getMessagesByUser(userId: string) {
  try {
    const userMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt));

    return userMessages;
  } catch (error) {
    logger.error("Failed to get messages", error);
    return [];
  }
}
