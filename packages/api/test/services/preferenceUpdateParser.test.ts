import { describe, it, expect, vi } from 'vitest';
import { PreferenceUpdateParser } from '../../src/services/preferenceUpdateParser';
import { ExerciseValidationService } from '../../src/services/exerciseValidationService';

// Mock the ExerciseValidationService
vi.mock('../../src/services/exerciseValidationService');

describe('PreferenceUpdateParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock - no exercises validated
    vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
      validatedExercises: [],
      matches: []
    } as any);
  });

  describe('parseIntensityUpdate', () => {
    it('should recognize "kick my butt" as high intensity', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually, I feel better now. Kick my butt',
        { 
          intensity: 'low',
          muscleTargets: [],
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.intensity).toBe('high');
      expect(result.fieldsUpdated).toContain('intensity');
      expect(result.updateType).toBe('change');
    });

    it('should recognize "kick my ass" as high intensity', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Feeling better. Kick my ass today!',
        { 
          intensity: 'moderate',
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.intensity).toBe('high');
      expect(result.fieldsUpdated).toContain('intensity');
    });

    it('should recognize other high intensity phrases', async () => {
      const highIntensityPhrases = [
        'Actually, push me hard',
        'Challenge me today',
        'I want to go all out',
        'Bring it on!',
        'Destroy me',
        'Crush it today'
      ];

      for (const phrase of highIntensityPhrases) {
        const result = await PreferenceUpdateParser.parseUpdate(
          phrase,
          { intensity: 'low', needsFollowUp: false }
        );

        expect(result.hasUpdates).toBe(true);
        expect(result.updates.intensity).toBe('high');
        expect(result.fieldsUpdated).toContain('intensity');
      }
    });

    it('should recognize low intensity updates', async () => {
      const lowIntensityPhrases = [
        'Actually, take it easy on me',
        'Feeling tired now',
        'Let\'s go light today',
        'I need something gentle'
      ];

      for (const phrase of lowIntensityPhrases) {
        const result = await PreferenceUpdateParser.parseUpdate(
          phrase,
          { intensity: 'high', needsFollowUp: false }
        );

        expect(result.hasUpdates).toBe(true);
        expect(result.updates.intensity).toBe('low');
        expect(result.fieldsUpdated).toContain('intensity');
      }
    });
  });

  describe('parseExerciseUpdates', () => {
    it('should recognize exercise additions', async () => {
      // Mock validation to return deadlifts
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValueOnce({
        validatedExercises: ['Deadlift'],
        matches: []
      } as any);
      
      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually, add some deadlifts',
        { includeExercises: ['squats'], needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.includeExercises).toEqual(['squats', 'Deadlift']);
      expect(result.fieldsUpdated).toContain('includeExercises');
      expect(result.updateType).toBe('add');
    });

    it('should recognize exercise removals', async () => {
      // Mock validation to return burpees
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValueOnce({
        validatedExercises: ['Burpees'],
        matches: []
      } as any);
      
      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually, skip the burpees',
        { avoidExercises: [], needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.avoidExercises).toEqual(['Burpees']);
      expect(result.fieldsUpdated).toContain('avoidExercises');
      expect(result.updateType).toBe('remove');
    });
  });

  describe('parseMuscleUpdates', () => {
    it('should recognize muscle target additions', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Also, let\'s work on chest',
        { muscleTargets: ['back'], needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.muscleTargets).toEqual(['back', 'chest']);
      expect(result.fieldsUpdated).toContain('muscleTargets');
    });

    it('should recognize muscles to avoid', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'My shoulders are sore now',
        { muscleLessens: [], needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.muscleLessens).toEqual(['shoulders']);
      expect(result.fieldsUpdated).toContain('muscleLessens');
    });
  });

  describe('parseJointUpdates', () => {
    it('should recognize joint issues', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'My knees are hurting a bit',
        { avoidJoints: [], needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.avoidJoints).toEqual(['knee']);
      expect(result.fieldsUpdated).toContain('avoidJoints');
    });
  });

  describe('parseSessionGoalUpdate', () => {
    it('should recognize strength goal updates', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually, let\'s focus on strength today',
        { sessionGoal: null, needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.sessionGoal).toBe('strength');
      expect(result.fieldsUpdated).toContain('sessionGoal');
    });

    it('should recognize stability goal updates', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Change it to stability work',
        { sessionGoal: 'strength', needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.sessionGoal).toBe('stability');
      expect(result.fieldsUpdated).toContain('sessionGoal');
    });
  });

  describe('complex updates', () => {
    it('should handle multiple updates in one message', async () => {
      // Mock validation to return deadlifts
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValueOnce({
        validatedExercises: ['Deadlift'],
        matches: []
      } as any);
      
      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually feeling better. Kick my butt and add deadlifts',
        { 
          intensity: 'low',
          includeExercises: [],
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.intensity).toBe('high');
      expect(result.updates.includeExercises).toEqual(['Deadlift']);
      expect(result.fieldsUpdated).toContain('intensity');
      expect(result.fieldsUpdated).toContain('includeExercises');
      expect(result.updateType).toBe('mixed');
    });

    it('should not find updates in non-update messages', async () => {
      const result = await PreferenceUpdateParser.parseUpdate(
        'Sounds good!',
        { intensity: 'moderate', needsFollowUp: false }
      );

      expect(result.hasUpdates).toBe(false);
      expect(result.fieldsUpdated).toHaveLength(0);
    });
  });
});