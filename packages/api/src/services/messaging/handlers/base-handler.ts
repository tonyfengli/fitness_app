import type {
  MessageIntent,
  MessageResponse,
  UnifiedMessage,
} from "../../../types/messaging";

/**
 * Base class for all message handlers
 */
export abstract class BaseMessageHandler {
  /**
   * Handle a message and return a response
   */
  abstract handle(
    message: UnifiedMessage,
    intent: MessageIntent,
  ): Promise<MessageResponse>;

  /**
   * Common utility methods for all handlers
   */

  /**
   * Format a client name for messages
   */
  protected formatClientName(name?: string): string {
    return name || "there";
  }

  /**
   * Check if message is from web app test mode
   */
  protected isTestMode(message: UnifiedMessage): boolean {
    return message.metadata.testMode === true;
  }

  /**
   * Get channel-specific identifier
   */
  protected getChannelIdentifier(message: UnifiedMessage): string {
    switch (message.channel) {
      case "sms":
        return message.userPhone || message.userId;
      case "web":
        return message.userId;
      default:
        return message.userId;
    }
  }
}
