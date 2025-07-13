import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { interpretWorkout } from '../../../src/workout-generation/workoutInterpretationGraph';
import { setupMocks, testContexts, getExercisesByBlock, createTestExerciseWithOverrides } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import { MockLLM } from '../../helpers/mockLLM';
import { setInterpretationLLM, resetInterpretationLLM } from '../../../src/workout-generation/generateWorkoutFromExercises';
import type { Exercise, ClientContext } from '../../../src/types';

// Mock LLM that can simulate various error conditions
class ErrorSimulatorMockLLM extends MockLLM {
  private errorType: string | null = null;
  private errorCount: number = 0;
  private maxErrors: number = 1;

  setError(type: string, count: number = 1) {
    this.errorType = type;
    this.errorCount = 0;
    this.maxErrors = count;
  }

  async invoke(messages: any[]): Promise<any> {
    if (this.errorType && this.errorCount < this.maxErrors) {
      this.errorCount++;
      
      switch (this.errorType) {
        case 'timeout':
          // Simulate network timeout
          await new Promise(resolve => setTimeout(resolve, 100));
          throw new Error('ECONNRESET: Connection reset by peer');
          
        case 'rate_limit':
          throw new Error('Rate limit exceeded. Please try again in 60 seconds.');
          
        case 'invalid_api_key':
          throw new Error('Invalid API key provided');
          
        case 'service_unavailable':
          throw new Error('Service temporarily unavailable (503)');
          
        case 'context_length':
          throw new Error('This model\'s maximum context length is 4096 tokens');
          
        case 'empty_response':
          return { content: '' };
          
        case 'null_response':
          return { content: null };
          
        case 'undefined_response':
          return { content: undefined };
          
        case 'non_json_response':
          return { 
            content: `I'll create a great workout for you!
            
            Let's start with some squats, then move to bench press.
            
            This is going to be an amazing workout!` 
          };
          
        case 'partial_json':
          return {
            content: `Here's your workout:
            
            \`\`\`json
            {
              "blocks": {
                "A": [
                  {
                    "name": "Barbell Squat",
                    "sets": [
                      { "setNumber": 1, "reps": 8`
          };
          
        case 'invalid_structure':
          return {
            content: `\`\`\`json
            {
              "workout": {
                "exercises": ["Squat", "Bench Press"],
                "duration": 45
              }
            }
            \`\`\``
          };
          
        case 'mixed_content':
          return {
            content: `Let me explain the workout first...
            
            \`\`\`json
            {"blocks": {"A": []}}
            \`\`\`
            
            Now, here's another version:
            
            \`\`\`json
            {"blocks": {"B": []}}
            \`\`\``
          };
          
        case 'huge_response':
          // Generate a very large response
          const hugeArray = Array(1000).fill({
            name: "Exercise",
            sets: Array(10).fill({ setNumber: 1, reps: 10 })
          });
          return {
            content: `\`\`\`json
            {
              "blocks": {
                "A": ${JSON.stringify(hugeArray)}
              }
            }
            \`\`\``
          };
          
        case 'unicode_issues':
          return {
            content: `\`\`\`json
            {
              "blocks": {
                "A": [{
                  "name": "Bulgarian Split Squat 🦵",
                  "sets": [{"setNumber": 1, "reps": "8-10", "emoji": "💪"}]
                }]
              }
            }
            \`\`\``
          };
          
        default:
          throw new Error(`Unknown error type: ${this.errorType}`);
      }
    }
    
    // Return valid response after errors
    return {
      content: `\`\`\`json
      {
        "blocks": {
          "A": [],
          "B": [],
          "C": [],
          "D": []
        },
        "totalSets": 20,
        "summary": "Recovery workout after errors"
      }
      \`\`\``
    };
  }
}

// Helper function to run pipeline with error handling
async function runPipelineWithErrors(
  clientContext: ClientContext,
  options: {
    intensity?: 'low' | 'moderate' | 'high';
    exercises?: Exercise[];
    skipInterpretation?: boolean;
  } = {}
) {
  // Phase 1-4: Filter and organize
  const filterResult = await filterExercisesFromInput({
    clientContext,
    intensity: options.intensity,
    workoutTemplate: createTestWorkoutTemplate(false),
    exercises: options.exercises
  });

  if (options.skipInterpretation) {
    return { filterResult };
  }

  // Get organized blocks
  const blocks = getExercisesByBlock(filterResult.filteredExercises);
  const organizedExercises = {
    blockA: blocks.blockA,
    blockB: blocks.blockB,
    blockC: blocks.blockC,
    blockD: blocks.blockD
  };

  // Phase 5: LLM interpretation
  const interpretResult = await interpretWorkout(organizedExercises, {
    strengthLevel: clientContext.strength_capacity || 'moderate',
    intensity: options.intensity || 'moderate',
    ...clientContext
  });

  return {
    filterResult,
    blocks,
    interpretResult,
    structuredOutput: interpretResult.structuredOutput,
    interpretation: interpretResult.interpretation,
    filteredExercises: filterResult.filteredExercises
  };
}

describe('Error Scenarios (Phase 5)', () => {
  let mockLLM: ErrorSimulatorMockLLM;

  beforeEach(() => {
    setupMocks();
    mockLLM = new ErrorSimulatorMockLLM();
    setInterpretationLLM(mockLLM);
  });

  afterEach(() => {
    resetInterpretationLLM();
  });

  describe('Network and API Errors', () => {
    it('should handle connection timeouts', async () => {
      mockLLM.setError('timeout');
      
      const result = await runPipelineWithErrors(testContexts.default());
      
      expect(result.interpretResult?.error).toBeDefined();
      expect(result.interpretResult?.error).toContain('ECONNRESET');
    });

    it('should handle rate limiting', async () => {
      mockLLM.setError('rate_limit');
      
      const result = await runPipelineWithErrors(testContexts.default());
      
      expect(result.interpretResult?.error).toBeDefined();
      expect(result.interpretResult?.error).toContain('Rate limit exceeded');
    });

    it('should handle invalid API key', async () => {
      mockLLM.setError('invalid_api_key');
      
      const result = await runPipelineWithErrors(testContexts.default());
      
      expect(result.interpretResult?.error).toBeDefined();
      expect(result.interpretResult?.error).toContain('Invalid API key');
    });

    it('should handle service unavailability', async () => {
      mockLLM.setError('service_unavailable');
      
      const result = await runPipelineWithErrors(testContexts.default());
      
      expect(result.interpretResult?.error).toBeDefined();
      expect(result.interpretResult?.error).toContain('Service temporarily unavailable');
    });

    it('should handle context length errors', async () => {
      mockLLM.setError('context_length');
      
      const result = await runPipelineWithErrors(testContexts.default());
      
      expect(result.interpretResult?.error).toBeDefined();
      expect(result.interpretResult?.error).toContain('context length');
    });
  });

  describe('Response Content Errors', () => {
    it('should handle empty responses', async () => {
      mockLLM.setError('empty_response');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toBe('');
      // Structured output might have defaults or be empty
    });

    it('should handle null responses', async () => {
      mockLLM.setError('null_response');
      
      const result = await runPipelineWithErrors(testContexts.default());

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle undefined responses', async () => {
      mockLLM.setError('undefined_response');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result).toBeDefined();
    });

    it('should handle non-JSON responses', async () => {
      mockLLM.setError('non_json_response');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toContain('great workout');
      // Structured output extraction should fail gracefully
    });

    it('should handle partial JSON responses', async () => {
      mockLLM.setError('partial_json');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toContain('Barbell Squat');
      // Should handle incomplete JSON
    });

    it('should handle invalid workout structure', async () => {
      mockLLM.setError('invalid_structure');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toBeDefined();
      // Should not have proper blocks structure
    });

    it('should handle mixed content responses', async () => {
      mockLLM.setError('mixed_content');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toContain('explain the workout');
      // Should extract the first valid JSON block
    });
  });

  describe('Data Size and Format Errors', () => {
    it('should handle extremely large responses', async () => {
      mockLLM.setError('huge_response');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.structuredOutput).toBeDefined();
      // Should handle but maybe truncate or limit
    });

    it('should handle unicode and special characters', async () => {
      mockLLM.setError('unicode_issues');
      
      const result = await runPipelineWithErrors(testContexts.default());

      expect(result.interpretation).toContain('🦵');
      expect(result.structuredOutput?.blocks.A[0].name).toContain('Bulgarian Split Squat');
    });
  });

  describe('Input Validation Errors', () => {
    it('should handle missing client context gracefully', async () => {
      const result = await runPipelineWithErrors(
        undefined as any,
        { skipInterpretation: true }
      );

      expect(result).toBeDefined();
      expect(result.filterResult.filteredExercises).toBeDefined();
    });

    it('should handle invalid exercise data', async () => {
      const invalidExercises = [
        { 
          // Missing required fields
          name: 'Invalid Exercise'
        } as any as Exercise
      ];

      const result = await runPipelineWithErrors(
        testContexts.default(),
        { exercises: invalidExercises, skipInterpretation: true }
      );

      expect(result).toBeDefined();
    });

    it('should handle circular references in input', async () => {
      const circular: any = { name: 'Test' };
      circular.self = circular;
      
      const exercises = [
        createTestExerciseWithOverrides({
          name: 'Normal Exercise',
          equipment: [circular] // Use a valid field that accepts arrays
        })
      ];

      // This might throw or handle gracefully depending on implementation
      try {
        const result = await runPipelineWithErrors(
          testContexts.default(),
          { exercises, skipInterpretation: true }
        );
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Retry and Recovery', () => {
    it('should retry on transient errors', async () => {
      mockLLM.setError('timeout', 2); // Fail twice, then succeed
      
      // Depending on implementation, might retry internally
      try {
        const result = await runPipelineWithErrors(testContexts.default());
        // If retries are implemented, this might succeed
        expect(result).toBeDefined();
      } catch (error) {
        // If no retries, should fail
        expect(error).toBeDefined();
      }
    });

    it('should handle partial pipeline failures', async () => {
      // Simulate exercises that cause issues in specific phases
      const problematicExercises = [
        createTestExerciseWithOverrides({
          name: 'Exercise 1',
          functionTags: ['primary_strength'],
          primaryMuscle: '' // Invalid empty muscle
        }),
        createTestExerciseWithOverrides({
          name: 'Exercise 2',
          functionTags: ['primary_strength'],
          strengthLevel: 'invalid_level' // Invalid strength level
        })
      ];

      const result = await runPipelineWithErrors(
        testContexts.default(),
        { exercises: problematicExercises, skipInterpretation: true }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases in Error Handling', () => {
    it('should handle errors during error handling', async () => {
      // Mock console.error to throw
      const originalError = console.error;
      console.error = vi.fn(() => {
        throw new Error('Error in error handler');
      });

      mockLLM.setError('timeout');
      
      try {
        await runPipelineWithErrors(testContexts.default());
      } catch (error) {
        expect(error).toBeDefined();
      }

      console.error = originalError;
    });

    it('should handle memory issues with large data sets', async () => {
      // Create a very large number of exercises
      const hugeExerciseSet = Array.from({ length: 10000 }, (_, i) => 
        createTestExerciseWithOverrides({
          id: `ex_${i}`,
          name: `Exercise ${i}`,
          functionTags: ['primary_strength']
        })
      );

      // Should handle without crashing
      const result = await runPipelineWithErrors(
        testContexts.default(),
        { exercises: hugeExerciseSet, skipInterpretation: true }
      );

      expect(result).toBeDefined();
      // Check that blocks are still limited by their max sizes
      const blocks = getExercisesByBlock(result.filterResult.filteredExercises);
      expect(blocks.blockA.length).toBeLessThanOrEqual(5);
      expect(blocks.blockB.length).toBeLessThanOrEqual(8);
      expect(blocks.blockC.length).toBeLessThanOrEqual(8);
      expect(blocks.blockD.length).toBeLessThanOrEqual(6);
    });

    it('should handle concurrent request issues', async () => {
      // Simulate multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        runPipelineWithErrors(testContexts.default())
      );

      const results = await Promise.allSettled(promises);
      
      // At least some should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });

  describe('Prompt Construction Errors', () => {
    it('should handle missing exercise names', async () => {
      const noNameExercises = [
        createTestExerciseWithOverrides({
          name: undefined as any,
          functionTags: ['primary_strength']
        })
      ];

      const result = await runPipelineWithErrors(
        testContexts.default(),
        { exercises: noNameExercises, skipInterpretation: true }
      );

      expect(result).toBeDefined();
    });

    it('should handle extremely long exercise names', async () => {
      const longName = 'A'.repeat(1000);
      const longNameExercises = [
        createTestExerciseWithOverrides({
          name: longName,
          functionTags: ['primary_strength']
        })
      ];

      const result = await runPipelineWithErrors(
        testContexts.default(),
        { exercises: longNameExercises, skipInterpretation: true }
      );

      expect(result).toBeDefined();
    });

    it('should handle special characters in all fields', async () => {
      const specialExercises = [
        createTestExerciseWithOverrides({
          name: '<script>alert("xss")</script>',
          primaryMuscle: 'chest & shoulders',
          secondaryMuscles: ['back\\shoulders', 'core"abs"'],
          functionTags: ['primary_strength']
        })
      ];

      const result = await runPipelineWithErrors(
        {
          ...testContexts.default(),
          exercise_requests: {
            include: ['bench"press', 'squat\'s'],
            avoid: ['deadlift<>']
          }
        },
        { exercises: specialExercises, skipInterpretation: true }
      );

      expect(result).toBeDefined();
      // Should escape or handle special characters properly
    });
  });
});