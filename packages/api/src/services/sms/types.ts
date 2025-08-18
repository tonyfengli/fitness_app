export interface TwilioSMSPayload {
  MessageSid: string;
  SmsSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

export interface SMSResponse {
  success: boolean;
  message: string;
  metadata?: Record<string, any>;
}

export interface SMSHandlerContext {
  payload: TwilioSMSPayload;
  normalizedPhone: string;
}
