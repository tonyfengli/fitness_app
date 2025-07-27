import { v4 as uuidv4 } from 'uuid';
import { UnifiedMessage, MessageChannel } from '../../../types/messaging';

export class WebAdapter {
  /**
   * Convert web app message request to UnifiedMessage
   */
  static fromWebRequest(params: {
    recipientId: string;  // The user who is "sending" the message (client)
    content: string;
    businessId: string;
    trainingSessionId?: string;
    sentBy: string;       // The trainer who initiated this test
    sentByName?: string;
  }): UnifiedMessage {
    const message: UnifiedMessage = {
      id: uuidv4(),
      userId: params.recipientId,  // Client is the sender
      businessId: params.businessId,
      trainingSessionId: params.trainingSessionId,
      content: params.content,
      channel: 'web' as MessageChannel,
      metadata: {
        testMode: true,
        initiatedBy: params.sentBy,
        initiatedByName: params.sentByName,
        webSessionId: uuidv4()
      },
      timestamp: new Date()
    };
    
    return message;
  }
}