import { UnifiedMessage, MessageResponse } from '../../../types/messaging';
import { sendSMS } from '../../twilio';

export class ResponseDispatcher {
  /**
   * Send response via appropriate channel
   */
  async send(message: UnifiedMessage, response: MessageResponse): Promise<void> {
    switch (message.channel) {
      case 'sms':
        await this.sendSMS(message, response);
        break;
      
      case 'web':
        // For web, the response is already returned to the API caller
        // Messages are saved to DB by the logger
        console.log(`[${new Date().toISOString()}] Web response ready for client:`, {
          userId: message.userId,
          responseLength: response.message.length
        });
        break;
      
      default:
        console.warn(`[${new Date().toISOString()}] Unknown channel for response dispatch:`, message.channel);
    }
  }

  /**
   * Send SMS response via Twilio
   */
  private async sendSMS(message: UnifiedMessage, response: MessageResponse): Promise<void> {
    if (!message.userPhone) {
      throw new Error('No phone number available for SMS response');
    }
    
    try {
      const result = await sendSMS(message.userPhone, response.message);
      
      if (!result.success) {
        throw new Error(`SMS send failed: ${result.error}`);
      }
      
      console.log(`[${new Date().toISOString()}] SMS sent successfully:`, {
        to: message.userPhone,
        messageId: result.messageId
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to send SMS:`, error);
      throw error;
    }
  }
}