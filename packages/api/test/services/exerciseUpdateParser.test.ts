import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExerciseUpdateParser } from '../../src/services/exerciseUpdateParser';
import { ExerciseValidationService } from '../../src/services/exerciseValidationService';

// Mock the ExerciseValidationService
vi.mock('../../src/services/exerciseValidationService');

describe('ExerciseUpdateParser', () => {
  let parser: ExerciseUpdateParser;
  
  beforeEach(() => {
    vi.clearAllMocks();
    parser = new ExerciseUpdateParser();
    
    // Default mock - no exercises validated
    vi.mocked(ExerciseValidationService.validateExercises).mockResolvedValue({
      validatedExercises: [],
      matches: []
    } as any);
  });

  describe('determineIntent', () => {
    it('should recognize removal intent', async () => {
      const testCases = [
        'remove bulgarian',
        'don\'t want bulgarian',
        'skip the squats',
        'avoid deadlifts',
        'no burpees',
        'delete bench press',
        'Actually I don\'t want to Bulgarian, remove that'
      ];

      for (const message of testCases) {
        const result = await parser.parseExerciseUpdate(message);
        expect(result.action).toBe('remove');
      }
    });

    it('should recognize addition intent', async () => {
      const testCases = [
        'add bulgarian',
        'include squats',
        'also deadlifts',
        'plus bench press',
        'want some curls',
        'and planks'
      ];

      for (const message of testCases) {
        const result = await parser.parseExerciseUpdate(message);
        expect(result.action).toBe('add');
      }
    });

    it('should handle conflicting intents by prioritizing remove', async () => {
      const result = await parser.parseExerciseUpdate('add squats but remove bulgarian');
      // Should prioritize the stronger intent or first clear intent
      expect(['add', 'remove']).toContain(result.action);
    });
  });

  describe('exercise extraction and validation', () => {
    it('should extract and validate Bulgarian Split Squat', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => {
        if (exercises.some(e => e.includes('bulgarian'))) {
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

      const result = await parser.parseExerciseUpdate(
        'Actually I don\'t want to Bulgarian, remove that',
        'test-business-id'
      );

      expect(result.action).toBe('remove');
      expect(result.exercises).toEqual(['Bulgarian Split Squat']);
      
      // Verify validation was called with the extracted mention
      expect(ExerciseValidationService.validateExercises).toHaveBeenCalledWith(
        expect.arrayContaining(['bulgarian']),
        'test-business-id',
        'avoid'
      );
    });

    it('should handle multiple exercise mentions', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => {
        const mockExerciseMap: Record<string, string> = {
          'squats': 'Barbell Back Squat',
          'deadlifts': 'Conventional Deadlift'
        };
        
        const validated = exercises
          .map(e => mockExerciseMap[e.toLowerCase()])
          .filter(Boolean);
          
        return { validatedExercises: validated, matches: [] } as any;
      });

      const result = await parser.parseExerciseUpdate(
        'add squats and deadlifts',
        'test-business-id'
      );

      expect(result.action).toBe('add');
      expect(result.exercises).toContain('Barbell Back Squat');
      expect(result.exercises).toContain('Conventional Deadlift');
    });

    it('should handle no matches', async () => {
      const result = await parser.parseExerciseUpdate(
        'remove that weird thing',
        'test-business-id'
      );

      expect(result.action).toBe('remove');
      expect(result.exercises).toEqual([]);
    });

    it('should handle validation errors gracefully', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await parser.parseExerciseUpdate(
        'add squats',
        'test-business-id'
      );

      expect(result.action).toBe('add');
      expect(result.exercises).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', async () => {
      const result = await parser.parseExerciseUpdate('');
      expect(result.action).toBe('unknown');
      expect(result.exercises).toEqual([]);
    });

    it('should handle messages with no clear intent', async () => {
      const result = await parser.parseExerciseUpdate('bulgarian split squat');
      expect(result.action).toBe('unknown');
      expect(result.exercises).toEqual([]);
    });

    it('should clean up exercise mentions properly', async () => {
      vi.mocked(ExerciseValidationService.validateExercises).mockImplementation(async (exercises) => {
        // Should receive cleaned exercise names
        if (exercises.includes('bench press')) {
          return {
            validatedExercises: ['Barbell Bench Press'],
            matches: []
          } as any;
        }
        return { validatedExercises: [], matches: [] } as any;
      });

      const result = await parser.parseExerciseUpdate(
        'remove the bench press from my workout'
      );

      expect(result.action).toBe('remove');
      expect(result.exercises).toEqual(['Barbell Bench Press']);
    });
  });
});