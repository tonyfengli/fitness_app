import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SMSWebhookHandler } from '../../../src/services/sms/webhook-handler';
import { WorkoutPreferenceService } from '../../../src/services/workoutPreferenceService';
import { getUserByPhone } from '../../../src/services/checkInService';
import { PreferenceUpdateParser } from '../../../src/services/preferenceUpdateParser';
import { TargetedFollowupService } from '../../../src/services/targetedFollowupService';
import { saveMessage } from '../../../src/services/messageService';

// Mock all the required modules
vi.mock('../../../src/services/workoutPreferenceService');
vi.mock('../../../src/services/checkInService');
vi.mock('../../../src/services/preferenceUpdateParser');
vi.mock('../../../src/services/targetedFollowupService');
vi.mock('../../../src/services/messageService');
vi.mock('../../../src/services/conversationStateService');
vi.mock('../../../src/utils/sessionTestDataLogger', () => ({
  sessionTestDataLogger: {
    isEnabled: vi.fn().mockReturnValue(false),
    initSession: vi.fn(),
    logMessage: vi.fn(),
    logLLMCall: vi.fn(),
    saveSessionData: vi.fn()
  }
}));

// Mock environment variables
vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-auth-token');
vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567');

describe('Preference Updates in Active State', () => {
  let handler: SMSWebhookHandler;
  
  beforeEach(() => {
    vi.clearAllMocks();
    handler = new SMSWebhookHandler();
    
    // Default mock implementations
    vi.mocked(getUserByPhone).mockResolvedValue({
      userId: 'test-user-123',
      businessId: 'test-business-123',
      trainingSessionId: 'test-session-123',
      phoneNumber: '+1234567890'
    } as any);
    
    vi.mocked(saveMessage).mockResolvedValue({} as any);
  });

  it('should allow preference updates when in preferences_active state', async () => {
    // Mock preference check to show user is in active state
    vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue({
      waiting: true,
      userId: 'test-user-123',
      trainingSessionId: 'test-session-123',
      businessId: 'test-business-123',
      currentStep: 'preferences_active'
    });
    
    // Mock existing preferences
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue({
      intensity: 'low',
      intensitySource: 'inherited',
      muscleTargets: ['legs'],
      includeExercises: ['Barbell Bench Press'],
      avoidExercises: [],
      muscleLessens: [],
      avoidJoints: [],
      sessionGoal: null,
      sessionGoalSource: 'explicit'
    });
    
    // Mock preference update parser to recognize "kick my butt"
    vi.mocked(PreferenceUpdateParser.parseUpdate).mockReturnValue({
      hasUpdates: true,
      updates: {
        intensity: 'high'
      },
      updateType: 'change',
      fieldsUpdated: ['intensity'],
      rawInput: 'Actually, I feel better now. Kick my butt'
    });
    
    // Mock the update response
    vi.mocked(TargetedFollowupService.generateUpdateResponse).mockReturnValue(
      "Got it, I've adjusted the intensity. Let me know if you need anything else changed."
    );
    
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    
    // Create a mock request
    const mockRequest = new Request('https://api.example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'mock-signature'
      },
      body: new URLSearchParams({
        From: '+1234567890',
        Body: 'Actually, I feel better now. Kick my butt',
        MessageSid: 'test-message-sid'
      })
    });
    
    // Mock webhook validation
    const validator = (handler as any).validator;
    const formData = await mockRequest.formData();
    vi.spyOn(validator, 'validateWebhook').mockResolvedValue({
      valid: true,
      payload: formData
    });
    
    // Mock payload extraction
    vi.spyOn(validator, 'extractPayload').mockReturnValue({
      From: '+1234567890',
      Body: 'Actually, I feel better now. Kick my butt',
      MessageSid: 'test-message-sid'
    });
    
    // Mock response sender
    const responseSender = (handler as any).responseSender;
    vi.spyOn(responseSender, 'sendResponseAsync').mockImplementation(() => {});
    
    // Handle the webhook
    const response = await handler.handleWebhook(mockRequest);
    
    // Verify response
    expect(response.status).toBe(200);
    
    // Verify preference update was saved with correct source tracking
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'test-user-123',
      'test-session-123',
      'test-business-123',
      expect.objectContaining({
        intensity: 'high',
        intensitySource: 'explicit', // Should be explicit when user updates
        muscleTargets: ['legs'],
        includeExercises: ['Barbell Bench Press']
      }),
      'preferences_active'
    );
    
    // Verify correct response was sent
    expect(responseSender.sendResponseAsync).toHaveBeenCalledWith(
      '+1234567890',
      "Got it, I've adjusted the intensity. Let me know if you need anything else changed."
    );
  });

  it('should not process preference updates when not in preference collection flow', async () => {
    // Mock preference check to show user is NOT in preference collection
    vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue({
      waiting: false
    });
    
    // Create a mock request
    const mockRequest = new Request('https://api.example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'mock-signature'
      },
      body: new URLSearchParams({
        From: '+1234567890',
        Body: 'Random message not related to preferences',
        MessageSid: 'test-message-sid'
      })
    });
    
    // Mock webhook validation
    const validator = (handler as any).validator;
    const formData = await mockRequest.formData();
    vi.spyOn(validator, 'validateWebhook').mockResolvedValue({
      valid: true,
      payload: formData
    });
    
    // Mock payload extraction
    vi.spyOn(validator, 'extractPayload').mockReturnValue({
      From: '+1234567890',
      Body: 'Random message not related to preferences',
      MessageSid: 'test-message-sid'
    });
    
    // Mock intent router to return unknown intent
    const intentRouter = (handler as any).intentRouter;
    vi.spyOn(intentRouter, 'interpretMessage').mockResolvedValue({
      intent: { type: 'unknown' }
    });
    
    // Mock response sender
    const responseSender = (handler as any).responseSender;
    vi.spyOn(responseSender, 'sendResponseAsync').mockImplementation(() => {});
    
    // Handle the webhook
    const response = await handler.handleWebhook(mockRequest);
    
    // Verify response
    expect(response.status).toBe(200);
    
    // Verify default handler response was sent
    expect(responseSender.sendResponseAsync).toHaveBeenCalledWith(
      '+1234567890',
      "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive."
    );
    
    // Verify preference update was NOT attempted
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).not.toHaveBeenCalled();
  });
});