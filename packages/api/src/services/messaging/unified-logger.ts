import { promises as fs } from "fs";
import path from "path";

import {
  MessageResponse,
  ProcessedMessage,
  UnifiedMessage,
} from "../../types/messaging";
import { saveMessage } from "../messageService";

export class UnifiedLogger {
  private debugEnabled: boolean;
  private sessionData: Map<string, any> = new Map();

  constructor() {
    // Always enable debug in development or when explicitly enabled
    this.debugEnabled =
      process.env.NODE_ENV === "development" ||
      process.env.SESSION_TEST_DATA_ENABLED === "true" ||
      true; // Temporarily always enabled
  }

  /**
   * Log incoming message
   */
  async logInbound(message: UnifiedMessage): Promise<void> {
    // Console log
    console.log(
      `[${new Date().toISOString()}] [${message.channel.toUpperCase()}] Inbound message:`,
      {
        userId: message.userId,
        content: message.content,
        sessionId: message.trainingSessionId,
        metadata: message.metadata,
      },
    );

    // Save to database
    await this.saveToDatabase(message, "inbound");

    // Add to session debug data
    if (this.debugEnabled && message.trainingSessionId) {
      this.addToSessionData(message.trainingSessionId, {
        direction: "inbound",
        content: message.content,
        metadata: message.metadata,
        timestamp: message.timestamp.toISOString(),
      });
    }
  }

  /**
   * Log outbound response
   */
  async logOutbound(
    originalMessage: UnifiedMessage,
    response: MessageResponse,
  ): Promise<void> {
    // Console log
    console.log(
      `[${new Date().toISOString()}] [${originalMessage.channel.toUpperCase()}] Outbound response:`,
      {
        userId: originalMessage.userId,
        success: response.success,
        messagePreview:
          response.message.substring(0, 100) +
          (response.message.length > 100 ? "..." : ""),
        metadata: response.metadata,
      },
    );

    // Save to database
    await this.saveToDatabase(
      originalMessage,
      "outbound",
      response.message,
      response.metadata,
    );

    // Add to session debug data
    if (this.debugEnabled && originalMessage.trainingSessionId) {
      this.addToSessionData(originalMessage.trainingSessionId, {
        direction: "outbound",
        content: response.message,
        metadata: response.metadata,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log complete processing cycle
   */
  async logProcessing(processed: ProcessedMessage): Promise<void> {
    console.log(`[${new Date().toISOString()}] Message processing complete:`, {
      channel: processed.originalMessage.channel,
      userId: processed.originalMessage.userId,
      intent: processed.intent.type,
      success: processed.response.success,
      processingTime: `${processed.processingTime}ms`,
    });

    // Save session data to file if we have a session
    if (this.debugEnabled && processed.originalMessage.trainingSessionId) {
      await this.saveSessionDebugFile(
        processed.originalMessage.trainingSessionId,
      );
    }
  }

  /**
   * Log errors
   */
  logError(context: string, error: any, message?: UnifiedMessage): void {
    console.error(`[${new Date().toISOString()}] [ERROR] ${context}:`, {
      error: error.message || error,
      stack: error.stack,
      messageId: message?.id,
      userId: message?.userId,
      channel: message?.channel,
    });
  }

  /**
   * Initialize session tracking
   */
  initSession(sessionId: string, userId: string, phoneNumber?: string): void {
    if (!this.debugEnabled) return;

    this.sessionData.set(sessionId, {
      sessionId,
      timestamp: new Date().toISOString(),
      phoneNumber: phoneNumber || userId,
      messages: [],
      llmCalls: [],
      exerciseMatcherCalls: [],
      summary: {
        totalMessages: 0,
        totalLLMCalls: 0,
        totalExerciseMatcherCalls: 0,
        llmFallbackCount: 0,
      },
    });
  }

  /**
   * Add LLM call to session data
   */
  logLLMCall(sessionId: string, llmCall: any): void {
    if (!this.debugEnabled) return;

    const session = this.sessionData.get(sessionId);
    if (!session) return;

    session.llmCalls.push({
      ...llmCall,
      timestamp: new Date().toISOString(),
    });
    session.summary.totalLLMCalls++;
  }

  /**
   * Save message to database
   */
  private async saveToDatabase(
    message: UnifiedMessage,
    direction: "inbound" | "outbound",
    content?: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await saveMessage({
        userId: message.userId,
        businessId: message.businessId,
        direction,
        content: content || message.content,
        phoneNumber: message.userPhone,
        channel: message.channel === "sms" ? "sms" : "in_app",
        metadata: {
          ...message.metadata,
          ...metadata,
          channelOriginal: message.channel,
          unifiedMessageId: message.id,
        },
        status: direction === "inbound" ? "delivered" : "sent",
      });
    } catch (error) {
      this.logError("Failed to save message to database", error, message);
    }
  }

  /**
   * Add message to session debug data
   */
  private addToSessionData(sessionId: string, messageData: any): void {
    const session = this.sessionData.get(sessionId);
    if (!session) {
      // Initialize if not exists
      this.initSession(sessionId, messageData.userId || "unknown");
    }

    const sessionToUpdate = this.sessionData.get(sessionId);
    if (sessionToUpdate) {
      sessionToUpdate.messages.push(messageData);
      sessionToUpdate.summary.totalMessages++;
    }
  }

  /**
   * Save session debug data to file
   */
  private async saveSessionDebugFile(sessionId: string): Promise<void> {
    if (!this.debugEnabled) return;

    const session = this.sessionData.get(sessionId);
    if (!session) return;

    try {
      // Use the same directory structure as existing session test data
      const dirPath = path.join(process.cwd(), "session-test-data");
      await fs.mkdir(dirPath, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `session_${sessionId}_${timestamp}.json`;
      const filepath = path.join(dirPath, filename);

      await fs.writeFile(filepath, JSON.stringify(session, null, 2), "utf-8");

      console.log(
        `[${new Date().toISOString()}] Session debug data saved:`,
        filepath,
      );
    } catch (error) {
      this.logError("Failed to save session debug file", error);
    }
  }
}

// Export singleton instance
export const unifiedLogger = new UnifiedLogger();
