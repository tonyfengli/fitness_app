import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreferenceHandler } from '../../../src/services/sms/handlers/preference-handler';
import { parseWorkoutPreferences } from '@acme/ai';
import { WorkoutPreferenceService } from '../../../src/services/workoutPreferenceService';
import { getUserByPhone } from '../../../src/services/checkInService';
import { ExerciseValidationService } from '../../../src/services/exerciseValidationService';
import { TargetedFollowupService } from '../../../src/services/targetedFollowupService';
import { saveMessage } from '../../../src/services/messageService';

// Mock all the required modules
vi.mock('@acme/ai');
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

describe('Intensity Preservation During Follow-up', () => {
  let handler: PreferenceHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new PreferenceHandler();
    
    // Default mock implementations
    vi.mocked(getUserByPhone).mockResolvedValue({
      userId: 'test-user-123',
      businessId: 'test-business-123',
      phoneNumber: '+1234567890'
    } as any);
    
    vi.mocked(saveMessage).mockResolvedValue({} as any);
  });

  it('should preserve high intensity when follow-up message has no intensity indicators', async () => {
    // Initial state - user has high intensity set
    const existingPreferences = {
      intensity: 'high',
      intensitySource: 'explicit',
      includeExercises: ['Deadlift'],
      muscleTargets: [],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: [],
      sessionGoal: undefined,
      sessionGoalSource: undefined
    };
    
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(existingPreferences);
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue({} as any);
    
    // Follow-up message with no intensity indicators - should not default to moderate
    vi.mocked(parseWorkoutPreferences).mockResolvedValue({
      muscleTargets: ['back'],
      sessionGoal: 'strength',
      // intensity is undefined - not mentioned in the message
      needsFollowUp: false
    });
    
    vi.mocked(TargetedFollowupService.generateFinalResponse).mockReturnValue(
      "Perfect! I'll create a strength-focused workout targeting your back with deadlifts. Let me know if you need any modifications during the session."
    );
    
    // Mock validation to return the existing exercises when called
    vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => {
      if (exercises.includes('Deadlift')) {
        return {
          validatedExercises: ['Deadlift'],
          matches: [{
            userInput: 'Deadlift',
            matchedExercises: [{ id: '1', name: 'Deadlift' }],
            confidence: 'high',
            matchMethod: 'exact'
          }]
        } as any;
      }
      return { validatedExercises: [], matches: [] } as any;
    });
    
    const result = await handler.handle(
      '+1234567890',
      "Let's focus on back and make this a strength session",
      'test-message-sid',
      {
        userId: 'test-user-123',
        trainingSessionId: 'test-session-123',
        businessId: 'test-business-123',
        currentStep: 'followup_sent'
      }
    );
    
    // Verify the intensity was preserved with proper source tracking
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'test-user-123',
      'test-session-123',
      'test-business-123',
      expect.objectContaining({
        intensity: 'high', // Should remain high, not default to moderate
        intensitySource: 'inherited', // Should be inherited since not explicitly mentioned
        muscleTargets: ['back'],
        sessionGoal: 'strength',
        sessionGoalSource: 'explicit', // Explicitly mentioned in follow-up
        includeExercises: ['Deadlift']
      }),
      'preferences_active'
    );
    
    expect(result.success).toBe(true);
  });

  it('should allow changing intensity when explicitly mentioned in follow-up', async () => {
    // Initial state - user has high intensity set
    const existingPreferences = {
      intensity: 'high',
      intensitySource: 'explicit',
      includeExercises: ['Deadlift'],
      muscleTargets: [],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: [],
      sessionGoal: undefined,
      sessionGoalSource: undefined
    };
    
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(existingPreferences);
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue({} as any);
    
    // Follow-up message explicitly requesting lower intensity
    vi.mocked(parseWorkoutPreferences).mockResolvedValue({
      intensity: 'low',
      muscleTargets: ['back'],
      needsFollowUp: false
    });
    
    vi.mocked(TargetedFollowupService.generateFinalResponse).mockReturnValue(
      "Got it! I'll create a lighter back workout for today. Let me know if you need any modifications."
    );
    
    const result = await handler.handle(
      '+1234567890',
      "Actually, I'm feeling a bit tired now. Let's take it easy and focus on back",
      'test-message-sid',
      {
        userId: 'test-user-123',
        trainingSessionId: 'test-session-123',
        businessId: 'test-business-123',
        currentStep: 'followup_sent'
      }
    );
    
    // Verify the intensity was updated with explicit source
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'test-user-123',
      'test-session-123',
      'test-business-123',
      expect.objectContaining({
        intensity: 'low', // Should change to low as requested
        intensitySource: 'explicit', // Explicitly changed in follow-up
        muscleTargets: ['back'],
        includeExercises: ['Deadlift']
      }),
      'preferences_active'
    );
    
    expect(result.success).toBe(true);
  });

  it('should preserve sessionGoal when not mentioned in follow-up', async () => {
    const existingPreferences = {
      intensity: 'moderate',
      intensitySource: 'explicit',
      sessionGoal: 'stability',
      sessionGoalSource: 'explicit',
      muscleTargets: ['core'],
      includeExercises: [],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: []
    };
    
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(existingPreferences);
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue({} as any);
    
    // Follow-up adds exercise but doesn't mention goal
    vi.mocked(parseWorkoutPreferences).mockResolvedValue({
      includeExercises: ['planks'],
      // sessionGoal is undefined - not mentioned
      needsFollowUp: false
    });
    
    vi.mocked(TargetedFollowupService.generateFinalResponse).mockReturnValue(
      "Perfect! I'll include planks in your stability-focused core workout."
    );
    
    vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
      validatedExercises: ['Plank'],
      matches: [{
        userInput: 'planks',
        matchedExercises: [{ id: '1', name: 'Plank' }],
        confidence: 'high',
        matchMethod: 'exact'
      }]
    } as any);
    
    const result = await handler.handle(
      '+1234567890',
      "Let's add some planks to the workout",
      'test-message-sid',
      {
        userId: 'test-user-123',
        trainingSessionId: 'test-session-123',
        businessId: 'test-business-123',
        currentStep: 'followup_sent'
      }
    );
    
    const savedPrefs = vi.mocked(WorkoutPreferenceService.savePreferences).mock.calls[0][3];
    expect(savedPrefs.intensity).toBe('moderate');
    expect(savedPrefs.intensitySource).toBe('inherited');
    expect(savedPrefs.sessionGoal).toBe('stability');
    expect(savedPrefs.sessionGoalSource).toBe('inherited');
    expect(savedPrefs.muscleTargets).toEqual(['core']);
    expect(savedPrefs.includeExercises).toContain('Plank');
  });

  it('should track source as explicit for initial preference collection', async () => {
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(null); // No existing preferences
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue({} as any);
    
    // Initial message with explicit intensity
    vi.mocked(parseWorkoutPreferences).mockResolvedValue({
      intensity: 'high',
      includeExercises: ['deadlifts'],
      needsFollowUp: false
    });
    
    vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
      validatedExercises: ['Deadlift'],
      matches: [{
        userInput: 'deadlifts',
        matchedExercises: [{ id: '1', name: 'Deadlift' }],
        confidence: 'high',
        matchMethod: 'exact'
      }]
    } as any);
    
    vi.mocked(TargetedFollowupService.generateFollowup).mockResolvedValue({
      followupQuestion: "What's your training focus today, and any specific areas you'd like to work on?",
      fieldsAsked: ['muscleTargets', 'sessionGoal']
    } as any);
    
    const result = await handler.handle(
      '+1234567890',
      "I'm feeling good today, push me a little. And I want to do deadlifts",
      'test-message-sid',
      {
        userId: 'test-user-123',
        trainingSessionId: 'test-session-123',
        businessId: 'test-business-123',
        currentStep: 'not_started'
      }
    );
    
    // Verify source tracking for initial collection
    const savedPrefs = vi.mocked(WorkoutPreferenceService.savePreferences).mock.calls[0][3];
    expect(savedPrefs.intensity).toBe('high');
    expect(savedPrefs.intensitySource).toBe('explicit');
    expect(savedPrefs.sessionGoalSource).toBe('default');
    expect(savedPrefs.includeExercises).toContain('Deadlift');
  });

  it('should track source as default when intensity not mentioned initially', async () => {
    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(null); // No existing preferences
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue({} as any);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue({} as any);
    
    // Initial message without intensity
    vi.mocked(parseWorkoutPreferences).mockResolvedValue({
      // intensity is undefined - not mentioned
      muscleTargets: ['legs'],
      needsFollowUp: false
    });
    
    vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
      validatedExercises: [],
      matches: []
    } as any);
    
    vi.mocked(TargetedFollowupService.generateFollowup).mockResolvedValue({
      followupQuestion: "Any specific exercises you'd like to include today?",
      fieldsAsked: ['includeExercises']
    } as any);
    
    const result = await handler.handle(
      '+1234567890',
      "Let's work on legs today",
      'test-message-sid',
      {
        userId: 'test-user-123',
        trainingSessionId: 'test-session-123',
        businessId: 'test-business-123',
        currentStep: 'not_started'
      }
    );
    
    // Verify default source for unmentioned intensity
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'test-user-123',
      'test-session-123',
      'test-business-123',
      expect.objectContaining({
        // intensity will be set to moderate by service layer
        intensitySource: 'default', // Not mentioned, so default
        muscleTargets: ['legs']
      }),
      'followup_sent'
    );
  });
});