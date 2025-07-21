import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreferenceHandler } from '../../../src/services/sms/handlers/preference-handler';
import { WorkoutPreferenceService } from '../../../src/services/workoutPreferenceService';
import { getUserByPhone } from '../../../src/services/checkInService';
import { parseWorkoutPreferences } from '@acme/ai';
import { ExerciseValidationService } from '../../../src/services/exerciseValidationService';
import { saveMessage } from '../../../src/services/messageService';

// Mock dependencies
vi.mock('../../../src/services/checkInService', () => ({
  getUserByPhone: vi.fn(),
}));

vi.mock('../../../src/services/messageService', () => ({
  saveMessage: vi.fn(),
}));

vi.mock('../../../src/services/workoutPreferenceService', () => ({
  WorkoutPreferenceService: {
    getPreferences: vi.fn(),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    saveSimplePreferences: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/services/exerciseValidationService', () => ({
  ExerciseValidationService: {
    validateExercises: vi.fn(),
  },
}));

vi.mock('@acme/ai', () => ({
  parseWorkoutPreferences: vi.fn(),
}));

vi.mock('../../../src/utils/sessionTestDataLogger', () => ({
  sessionTestDataLogger: {
    isEnabled: vi.fn().mockReturnValue(false),
    initSession: vi.fn(),
    logMessage: vi.fn(),
    logLLMCall: vi.fn(),
    saveSessionData: vi.fn(),
  },
}));

describe('Follow-up Preference Merging', () => {
  const handler = new PreferenceHandler();

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure mocks return promises
    vi.mocked(WorkoutPreferenceService.savePreferences).mockResolvedValue(undefined);
    vi.mocked(WorkoutPreferenceService.saveSimplePreferences).mockResolvedValue(undefined);
  });

  it('should preserve existing preferences when follow-up response has no intensity', async () => {
    // Initial preferences with high intensity and exercises
    const existingPreferences = {
      intensity: 'high' as const,
      includeExercises: ['back squat', 'deadlifts'],
      muscleTargets: [],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: [],
      sessionGoal: null,
      needsFollowUp: false,
    };

    // Follow-up response only mentions session goal and muscle targets
    const followUpParsed = {
      sessionGoal: 'strength' as const,
      muscleTargets: ['arms', 'biceps', 'triceps'],
      // No intensity specified - should keep existing 'high'
      includeExercises: [],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false,
    };

    // Mock setup
    vi.mocked(getUserByPhone).mockResolvedValue({
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
    });

    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(existingPreferences);
    vi.mocked(parseWorkoutPreferences).mockResolvedValue(followUpParsed);
    
    // Mock exercise validation to return the same exercises
    vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => ({
      validatedExercises: exercises,
      matches: exercises.map(e => ({
        userInput: e,
        matchedExercises: [{ id: e, name: e }],
        confidence: 1,
        matchMethod: 'exact',
      })),
    }));

    const preferenceCheck = {
      waiting: true,
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
      currentStep: 'followup_sent',
    };

    const response = await handler.handle(
      '+1234567890',
      'Strength, and I want some arms in there as well',
      'msg123',
      preferenceCheck
    );

    // Verify preferences were saved with merged values
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'user123',
      'session123',
      'business123',
      expect.objectContaining({
        intensity: 'high', // Should preserve existing high intensity
        sessionGoal: 'strength', // New from follow-up
        muscleTargets: ['arms', 'biceps', 'triceps'], // New from follow-up
        includeExercises: ['back squat', 'deadlifts'], // Should preserve existing exercises
        muscleLessens: [],
        avoidExercises: [],
        avoidJoints: [],
      }),
      'preferences_active'
    );

    expect(response.success).toBe(true);
  });

  it('should merge arrays correctly when follow-up adds new items', async () => {
    const existingPreferences = {
      intensity: 'moderate' as const,
      muscleTargets: ['legs'],
      includeExercises: ['squats'],
      muscleLessens: ['shoulders'],
      avoidExercises: [],
      avoidJoints: [],
      sessionGoal: null,
      needsFollowUp: false,
    };

    const followUpParsed = {
      muscleTargets: ['chest', 'back'], // Adding new targets
      includeExercises: ['bench press'], // Adding new exercise
      avoidJoints: ['knees'], // New joint protection
      // Other fields empty
      intensity: undefined,
      muscleLessens: [],
      avoidExercises: [],
      sessionGoal: null,
      needsFollowUp: false,
    };

    vi.mocked(getUserByPhone).mockResolvedValue({
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
    });

    vi.mocked(WorkoutPreferenceService.getPreferences).mockResolvedValue(existingPreferences);
    vi.mocked(parseWorkoutPreferences).mockResolvedValue(followUpParsed);
    
    vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => ({
      validatedExercises: exercises,
      matches: exercises.map(e => ({
        userInput: e,
        matchedExercises: [{ id: e, name: e }],
        confidence: 1,
        matchMethod: 'exact',
      })),
    }));

    const preferenceCheck = {
      waiting: true,
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
      currentStep: 'followup_sent',
    };

    await handler.handle(
      '+1234567890',
      'Also add chest and back work, include bench press, and be careful with my knees',
      'msg123',
      preferenceCheck
    );

    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'user123',
      'session123',
      'business123',
      expect.objectContaining({
        intensity: 'moderate', // Preserved
        muscleTargets: ['legs', 'chest', 'back'], // Merged arrays
        includeExercises: ['squats', 'bench press'], // Merged arrays
        muscleLessens: ['shoulders'], // Preserved
        avoidJoints: ['knees'], // New from follow-up
      }),
      'preferences_active'
    );
  });

  it('should handle initial collection (not follow-up) without merging', async () => {
    const parsedPreferences = {
      intensity: 'high' as const,
      includeExercises: ['deadlifts'],
      muscleTargets: ['back'],
      muscleLessens: [],
      avoidExercises: [],
      avoidJoints: [],
      sessionGoal: 'strength' as const,
      needsFollowUp: false,
    };

    vi.mocked(getUserByPhone).mockResolvedValue({
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
    });

    vi.mocked(parseWorkoutPreferences).mockResolvedValue(parsedPreferences);
    
    vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => ({
      validatedExercises: exercises,
      matches: exercises.map(e => ({
        userInput: e,
        matchedExercises: [{ id: e, name: e }],
        confidence: 1,
        matchMethod: 'exact',
      })),
    }));

    const preferenceCheck = {
      waiting: true,
      userId: 'user123',
      trainingSessionId: 'session123',
      businessId: 'business123',
      currentStep: 'not_started', // Initial collection, not follow-up
    };

    await handler.handle(
      '+1234567890',
      'Feeling great! High intensity, deadlifts for back strength',
      'msg123',
      preferenceCheck
    );

    // Should NOT call getPreferences since it's not a follow-up
    expect(vi.mocked(WorkoutPreferenceService.getPreferences)).not.toHaveBeenCalled();

    // Should save exactly what was parsed, no merging
    expect(vi.mocked(WorkoutPreferenceService.savePreferences)).toHaveBeenCalledWith(
      'user123',
      'session123',
      'business123',
      expect.objectContaining({
        intensity: 'high',
        sessionGoal: 'strength',
        muscleTargets: ['back'],
        includeExercises: ['deadlifts'],
      }),
      'followup_sent'
    );
  });
});