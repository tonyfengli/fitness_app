import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SMSWebhookHandler } from '../../../src/services/sms/webhook-handler';
import { WorkoutPreferenceService } from '../../../src/services/workoutPreferenceService';
import { getUserByPhone } from '../../../src/services/checkInService';
import { ExerciseValidationService } from '../../../src/services/exerciseValidationService';
import { TargetedFollowupService } from '../../../src/services/targetedFollowupService';
import { saveMessage } from '../../../src/services/messageService';

// Mock all the required modules
vi.mock('../../../src/services/workoutPreferenceService');
vi.mock('../../../src/services/checkInService');
vi.mock('../../../src/services/exerciseValidationService');
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

describe('Bulgarian Split Squat Removal', () => {
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

  it('should remove Bulgarian Split Squat when user says "Actually I don\'t want to Bulgarian, remove that"', async () => {
    // Mock preference check to show user is in active state
    vi.mocked(WorkoutPreferenceService.isAwaitingPreferences).mockResolvedValue({
      waiting: true,
      userId: 'test-user-123',
      trainingSessionId: 'test-session-123',
      businessId: 'test-business-123',
      currentStep: 'preferences_active'
    });
    
    // Mock existing preferences with Bulgarian Split Squat
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue({
      intensity: null,
      intensitySource: 'inherited',
      muscleTargets: ['legs', 'quads', 'hamstrings', 'glutes'],
      includeExercises: ['Bulgarian Split Squat'],
      avoidExercises: [],
      muscleLessens: ['back'],
      avoidJoints: ['shoulders'],
      sessionGoal: null,
      sessionGoalSource: 'inherited'
    });
    
    // Mock exercise validation to recognize "bulgarian" as "Bulgarian Split Squat"
    vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => {
      if (exercises.some(e => e.toLowerCase().includes('bulgarian'))) {
        return {
          validatedExercises: ['Bulgarian Split Squat'],
          matches: [{
            userInput: 'bulgarian',
            matchedExercises: [{ id: '1', name: 'Bulgarian Split Squat' }],
            confidence: 'high',
            matchMethod: 'llm'
          }]
        } as any;
      }
      return { validatedExercises: [], matches: [] } as any;
    });
    
    // Mock the update response
    vi.mocked(TargetedFollowupService.generateUpdateResponse).mockReturnValue(
      "Updated your exercise selections. Let me know if you need any other changes."
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
        Body: 'Actually I don\'t want to Bulgarian, remove that',
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
      Body: 'Actually I don\'t want to Bulgarian, remove that',
      MessageSid: 'test-message-sid'
    });
    
    // Mock response sender
    const responseSender = (handler as any).responseSender;
    vi.spyOn(responseSender, 'sendResponseAsync').mockImplementation(() => {});
    
    // Handle the webhook
    const response = await handler.handleWebhook(mockRequest);
    
    // Verify response
    expect(response.status).toBe(200);
    
    // Verify preference update was saved with Bulgarian Split Squat removed
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'test-user-123',
      'test-session-123',
      'test-business-123',
      expect.objectContaining({
        intensity: null,
        intensitySource: 'inherited',
        muscleTargets: ['legs', 'quads', 'hamstrings', 'glutes'],
        includeExercises: [], // Bulgarian Split Squat should be removed
        muscleLessens: ['back'],
        avoidJoints: ['shoulders']
      }),
      'preferences_active'
    );
    
    // Verify correct response was sent
    expect(responseSender.sendResponseAsync).toHaveBeenCalledWith(
      '+1234567890',
      "Updated your exercise selections. Let me know if you need any other changes."
    );
    
    // Verify exercise validation was called
    expect(vi.mocked(ExerciseValidationService.validateExercises)).toHaveBeenCalled();
  });
});