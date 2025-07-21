import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreferenceUpdateParser } from '../../src/services/preferenceUpdateParser';
import { ExerciseValidationService } from '../../src/services/exerciseValidationService';

// Mock the ExerciseValidationService
vi.mock('../../src/services/exerciseValidationService');

describe('PreferenceUpdateParser with Exercise Validation', () => {
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
  });

  describe('parseExerciseUpdates with validation', () => {
    it('should handle Bulgarian Split Squat removal', async () => {
      // Mock the validation service to return Bulgarian Split Squat
      vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises, businessId, intent) => {
        if (exercises.includes('bulgarian')) {
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

      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually I don\'t want to Bulgarian, remove that',
        { 
          includeExercises: ['Bulgarian Split Squat'],
          needsFollowUp: false 
        },
        'test-business-id'
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.includeExercises).toEqual([]); // Removed from list
      expect(result.fieldsUpdated).toContain('includeExercises');
      
      // Verify validation service was called
      expect(ExerciseValidationService.validateExercises).toHaveBeenCalledWith(
        ['bulgarian'],
        'test-business-id',
        'avoid'
      );
    });

    it('should add exercise to avoid list if not in includes', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
        validatedExercises: ['Burpees'],
        matches: [{
          userInput: 'burpees',
          matchedExercises: [{ id: '1', name: 'Burpees' }],
          confidence: 'high',
          matchMethod: 'exact'
        }]
      } as any);

      const result = await PreferenceUpdateParser.parseUpdate(
        'skip the burpees',
        { 
          includeExercises: [],
          avoidExercises: [],
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.avoidExercises).toEqual(['Burpees']);
      expect(result.fieldsUpdated).toContain('avoidExercises');
    });

    it('should recognize exercise additions', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
        validatedExercises: ['Deadlift'],
        matches: [{
          userInput: 'deadlifts',
          matchedExercises: [{ id: '1', name: 'Deadlift' }],
          confidence: 'high',
          matchMethod: 'exact'
        }]
      } as any);

      const result = await PreferenceUpdateParser.parseUpdate(
        'Actually, add some deadlifts',
        { 
          includeExercises: ['Squat'],
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(true);
      expect(result.updates.includeExercises).toEqual(['Squat', 'Deadlift']);
      expect(result.fieldsUpdated).toContain('includeExercises');
      expect(result.updateType).toBe('add');
    });

    it('should handle no exercise matches gracefully', async () => {
      // Mock returns no matches
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
        validatedExercises: [],
        matches: []
      } as any);

      const result = await PreferenceUpdateParser.parseUpdate(
        'remove that weird exercise',
        { 
          includeExercises: [],
          needsFollowUp: false 
        }
      );

      expect(result.hasUpdates).toBe(false);
      expect(result.updates.includeExercises).toBeUndefined();
      expect(result.updates.avoidExercises).toBeUndefined();
    });

    it('should handle validation service errors gracefully', async () => {
      // Mock throws an error
      vi.mocked(ExerciseValidationService.validateExercises).mockRejectedValue(
        new Error('Validation service unavailable')
      );

      const result = await PreferenceUpdateParser.parseUpdate(
        'add some squats',
        { 
          includeExercises: [],
          needsFollowUp: false 
        }
      );

      // Should still complete without crashing
      expect(result.hasUpdates).toBe(false);
      expect(result.fieldsUpdated).toHaveLength(0);
    });
  });

  describe('complex updates', () => {
    it('should handle multiple updates including exercises', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
        validatedExercises: ['Deadlift'],
        matches: [{
          userInput: 'deadlifts',
          matchedExercises: [{ id: '1', name: 'Deadlift' }],
          confidence: 'high',
          matchMethod: 'exact'
        }]
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
  });
});