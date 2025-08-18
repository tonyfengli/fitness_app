import { promises as fs } from "fs";
import path from "path";

import { createLogger } from "./logger";

const logger = createLogger("SMSDebugLogger");

interface SMSDebugEntry {
  timestamp: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  content: string;
  metadata?: any;
}

interface SMSSessionDebug {
  sessionId: string;
  timestamp: string;
  phoneNumber: string;
  templateType?: string;
  messages: SMSDebugEntry[];
}

export class SMSDebugLogger {
  private static debugSessions = new Map<string, SMSSessionDebug>();

  static async logInboundMessage(
    phoneNumber: string,
    content: string,
    sessionId?: string,
    metadata?: any,
  ) {
    const entry: SMSDebugEntry = {
      timestamp: new Date().toISOString(),
      phoneNumber,
      direction: "inbound",
      content,
      metadata,
    };

    if (sessionId) {
      this.addToSession(sessionId, phoneNumber, entry);
    }

    logger.info("Inbound SMS", { phoneNumber, content, sessionId, metadata });
  }

  static async logOutboundMessage(
    phoneNumber: string,
    content: string,
    sessionId?: string,
    metadata?: any,
  ) {
    const entry: SMSDebugEntry = {
      timestamp: new Date().toISOString(),
      phoneNumber,
      direction: "outbound",
      content,
      metadata,
    };

    if (sessionId) {
      this.addToSession(sessionId, phoneNumber, entry);
    }

    logger.info("Outbound SMS", { phoneNumber, content, sessionId, metadata });
  }

  static async logRouting(
    phoneNumber: string,
    routingDecision: any,
    sessionId?: string,
  ) {
    const metadata = {
      routingDecision,
      timestamp: new Date().toISOString(),
    };

    if (sessionId) {
      this.addToSession(sessionId, phoneNumber, {
        timestamp: new Date().toISOString(),
        phoneNumber,
        direction: "inbound",
        content: `[ROUTING] ${JSON.stringify(routingDecision)}`,
        metadata,
      });
    }

    logger.info("SMS Routing Decision", { phoneNumber, ...routingDecision });
  }

  private static addToSession(
    sessionId: string,
    phoneNumber: string,
    entry: SMSDebugEntry,
  ) {
    if (!this.debugSessions.has(sessionId)) {
      this.debugSessions.set(sessionId, {
        sessionId,
        timestamp: new Date().toISOString(),
        phoneNumber,
        messages: [],
      });
    }

    const session = this.debugSessions.get(sessionId)!;
    session.messages.push(entry);

    // Save to file after each message
    this.saveSessionToFile(sessionId).catch((error) => {
      logger.error("Failed to save SMS debug session", error);
    });
  }

  static async saveSessionToFile(sessionId: string) {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    try {
      const dirPath = path.join(process.cwd(), "apps/nextjs/session-test-data");
      await fs.mkdir(dirPath, { recursive: true });

      const fileName = `sms_routing_${sessionId}_${new Date().toISOString().replace(/:/g, "-")}.json`;
      const filePath = path.join(dirPath, fileName);

      await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf8");

      logger.info("SMS debug session saved", { filePath });
    } catch (error) {
      logger.error("Error saving SMS debug session", error);
    }
  }

  static setTemplateType(sessionId: string, templateType: string) {
    if (this.debugSessions.has(sessionId)) {
      const session = this.debugSessions.get(sessionId)!;
      session.templateType = templateType;
    }
  }
}
