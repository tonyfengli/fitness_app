/**
 * Unified messaging types for all channels (SMS, Web, API)
 */

export type MessageChannel = 'sms' | 'web' | 'api';

export interface UnifiedMessage {
  // Core identifiers
  id: string;
  userId: string;
  businessId: string;
  trainingSessionId?: string;
  
  // Message content
  content: string;
  channel: MessageChannel;
  
  // Channel-specific data
  metadata: {
    phoneNumber?: string;           // For SMS
    twilioMessageSid?: string;      // For SMS
    webSessionId?: string;          // For Web
    testMode?: boolean;             // For testing
    initiatedBy?: string;           // Who triggered this (for web)
    initiatedByName?: string;       // Name of person who triggered
    [key: string]: any;             // Extensible
  };
  
  // Timestamps
  timestamp: Date;
  
  // User info (populated during processing)
  userName?: string;
  userPhone?: string;
}

export interface MessageResponse {
  success: boolean;
  message: string;
  metadata?: {
    userId?: string;
    businessId?: string;
    sessionId?: string;
    nextStep?: string;
    [key: string]: any;
  };
}

export interface MessageIntent {
  type: 'check_in' | 'preference_collection' | 'disambiguation' | 'preference_update' | 'default';
  confidence: number;
  data?: any;
}

export interface ProcessedMessage {
  originalMessage: UnifiedMessage;
  intent: MessageIntent;
  response: MessageResponse;
  processingTime: number;
}