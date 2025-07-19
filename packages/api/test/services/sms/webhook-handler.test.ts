import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SMSWebhookHandler } from '../../../src/services/sms/webhook-handler';
import { setBroadcastFunction } from '../../../src/services/checkInService';
import { WorkoutPreferenceService } from '../../../src/services/workoutPreferenceService';

// Mock dependencies
vi.mock('../../../src/services/checkInService', () => ({
  processCheckIn: vi.fn(),
  getUserByPhone: vi.fn(),
  setBroadcastFunction: vi.fn(),
}));

vi.mock('../../../src/services/messageService', () => ({
  saveMessage: vi.fn(),
}));

vi.mock('../../../src/services/workoutPreferenceService', () => ({
  WorkoutPreferenceService: {
    isAwaitingPreferences: vi.fn(),
    savePreferences: vi.fn(),
    PREFERENCE_PROMPT: 'How are you feeling today?',
  },
}));

vi.mock('../../../src/services/twilio', () => ({
  twilioClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@acme/ai', () => ({
  interpretSMS: vi.fn(),
  parseWorkoutPreferences: vi.fn(),
}));

describe('SMSWebhookHandler', () => {
  let handler: SMSWebhookHandler;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables
    process.env = {
      ...originalEnv,
      TWILIO_AUTH_TOKEN: 'test-auth-token',
      TWILIO_PHONE_NUMBER: '+1234567890',
      SKIP_TWILIO_VALIDATION: 'true',
    };
    handler = new SMSWebhookHandler();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('handleWebhook', () => {
    it('should reject requests without Twilio signature', async () => {
      const request = new Request('http://localhost/api/sms/inbound', {
        method: 'POST',
        body: new URLSearchParams({
          From: '+1234567890',
          Body: 'here',
        }),
      });

      const response = await handler.handleWebhook(request);
      
      expect(response.status).toBe(401);
      expect(await response.text()).toContain('Missing X-Twilio-Signature');
    });

    it('should handle check-in messages successfully', async () => {
      const mockCheckInResult = {
        success: true,
        message: 'Welcome!',
        userId: 'user-123',
        businessId: 'business-456',
        sessionId: 'session-789',
      };

      vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue({
        waiting: false,
      });

      const { processCheckIn } = await import('../../../src/services/checkInService');
      vi.mocked(processCheckIn).mockResolvedValue(mockCheckInResult);

      const request = new Request('http://localhost/api/sms/inbound', {
        method: 'POST',
        headers: {
          'X-Twilio-Signature': 'test-signature',
        },
        body: new URLSearchParams({
          MessageSid: 'SM123',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'here',
        }),
      });

      // Skip validation in test
      process.env.SKIP_TWILIO_VALIDATION = 'true';

      const response = await handler.handleWebhook(request);
      
      expect(response.status).toBe(200);
      expect(processCheckIn).toHaveBeenCalledWith('+1234567890');
    });

    it('should handle preference collection flow', async () => {
      const mockPreferenceCheck = {
        waiting: true,
        userId: 'user-123',
        sessionId: 'session-789',
        businessId: 'business-456',
        currentStep: 'not_started',
      };

      vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue(mockPreferenceCheck);

      const { parseWorkoutPreferences } = await import('@acme/ai');
      vi.mocked(parseWorkoutPreferences).mockResolvedValue({
        intensity: 'medium',
        needsFollowUp: false,
      });

      const request = new Request('http://localhost/api/sms/inbound', {
        method: 'POST',
        headers: {
          'X-Twilio-Signature': 'test-signature',
        },
        body: new URLSearchParams({
          MessageSid: 'SM123',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'feeling good today, medium intensity',
        }),
      });

      process.env.SKIP_TWILIO_VALIDATION = 'true';

      const response = await handler.handleWebhook(request);
      
      expect(response.status).toBe(200);
      expect(parseWorkoutPreferences).toHaveBeenCalledWith('feeling good today, medium intensity');
      expect(WorkoutPreferenceService.savePreferences).toHaveBeenCalled();
    });

    it('should handle invalid payloads gracefully', async () => {
      const request = new Request('http://localhost/api/sms/inbound', {
        method: 'POST',
        headers: {
          'X-Twilio-Signature': 'test-signature',
        },
        body: new URLSearchParams({
          // Missing required fields
          MessageSid: 'SM123',
        }),
      });

      process.env.SKIP_TWILIO_VALIDATION = 'true';

      const response = await handler.handleWebhook(request);
      
      expect(response.status).toBe(401);
      expect(await response.text()).toContain('Missing required fields');
    });

    it('should handle non-check-in messages', async () => {
      vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue({
        waiting: false,
      });

      const { interpretSMS } = await import('@acme/ai');
      vi.mocked(interpretSMS).mockResolvedValue({
        intent: { type: 'other', confidence: 0.8 },
      });

      const request = new Request('http://localhost/api/sms/inbound', {
        method: 'POST',
        headers: {
          'X-Twilio-Signature': 'test-signature',
        },
        body: new URLSearchParams({
          MessageSid: 'SM123',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'what time is class?',
        }),
      });

      process.env.SKIP_TWILIO_VALIDATION = 'true';

      const response = await handler.handleWebhook(request);
      
      expect(response.status).toBe(200);
      expect(interpretSMS).toHaveBeenCalledWith('what time is class?');
    });
  });
});