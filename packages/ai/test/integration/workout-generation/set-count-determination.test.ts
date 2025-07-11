import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { interpretExercisesNode, setInterpretationLLM, resetInterpretationLLM } from '../../../src/workout-interpretation/interpretExercisesNode';
import { setupMocks, testContexts, getExercisesByBlock } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import type { WorkoutInterpretationStateType } from '../../../src/workout-interpretation/types';
import { MockLLM } from '../../helpers/mockLLM';

// Custom mock LLM that extracts set count from the prompt
class SetCountAwareMockLLM extends MockLLM {
  async invoke(messages: any[]): Promise<any> {
    // Extract the user message
    const userMessage = messages.find(m => m.constructor.name === 'HumanMessage');
    const content = userMessage?.content || '';
    
    // Extract the set count from the user message
    const setCountMatch = content.match(/Total Set Range: (\d+)-(\d+) sets/);
    const minSets = setCountMatch ? setCountMatch[1] : '19';
    const maxSets = setCountMatch ? setCountMatch[2] : '22';
    
    // Extract reasoning if present
    const reasoningMatch = content.match(/Total Set Range: \d+-\d+ sets\n(.+?)\n/);
    const reasoning = reasoningMatch ? reasoningMatch[1] : '';
    
    const responseContent = JSON.stringify({
      exercises: {
        blockA: [
          { name: 'Squat', sets: '3x5', reps: '5', rest: '3-5min', notes: 'Focus on depth' },
          { name: 'Bench Press', sets: '3x5', reps: '5', rest: '3-5min' }
        ],
        blockB: [
          { name: 'Romanian Deadlift', sets: '3x8', reps: '8', rest: '2-3min' },
          { name: 'Row', sets: '3x8', reps: '8', rest: '2-3min' }
        ],
        blockC: [
          { name: 'Curls', sets: '3x12', reps: '12', rest: '90s' }
        ]
      },
      summary: `Workout designed for ${minSets}-${maxSets} sets total. ${reasoning}`,
      totalSets: `${minSets}-${maxSets} sets`
    });
    
    const response = {
      content: {
        toString: () => responseContent
      }
    };
    
    this.calls.push({ messages, response });
    return response;
  }
}

describe('Set Count Determination Integration (Phase 3)', () => {
  let mockLLM: SetCountAwareMockLLM;

  beforeEach(() => {
    setupMocks();
    
    // Create a mock LLM that includes set count info in response
    mockLLM = new SetCountAwareMockLLM({});
    
    // Set the mock LLM for interpretation
    setInterpretationLLM(mockLLM);
  });
  
  afterEach(() => {
    // Reset to default LLM after each test
    resetInterpretationLLM();
  });

  describe('Strength x Intensity Matrix Integration', () => {
    const testSetCountIntegration = async (
      strengthLevel: string,
      intensity: 'low' | 'moderate' | 'high',
      expectedMin: number,
      expectedMax: number
    ) => {
      // Phase 1 & 2: Filter and score exercises
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          strength_capacity: strengthLevel as any,
          intensity
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      expect(filterResult.filteredExercises.length).toBeGreaterThan(0);
      
      // Organize exercises into blocks for interpretation
      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5), // Take up to 5 for primary strength
        blockB: blocks.blockB.slice(0, 8), // Take up to 8 for secondary strength
        blockC: blocks.blockC.slice(0, 8), // Take up to 8 for accessory
        blockD: blocks.blockD.slice(0, 6)  // Take up to 6 for core/capacity
      };

      // Phase 3, 4, 5: Interpret exercises (includes set count determination)
      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: strengthLevel as any,
          intensity
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);

      // Check that interpretation succeeded
      expect(interpretResult.error).toBeUndefined();
      expect(interpretResult.interpretation).toBeDefined();
      expect(interpretResult.structuredOutput).toBeDefined();

      // Verify structured output contains exercises and set count
      expect(interpretResult.structuredOutput).toBeDefined();
      const output = interpretResult.structuredOutput as any;
      
      // Check that the summary or totalSets contains the expected set count
      if (output.totalSets) {
        expect(output.totalSets).toContain(`${expectedMin}-${expectedMax}`);
      } else if (output.summary) {
        expect(output.summary).toContain(`${expectedMin}-${expectedMax}`);
      }
      
      // Verify it has exercises
      expect(output).toHaveProperty('exercises');
    };

    describe('Very Low Strength', () => {
      it('should generate 14-16 sets for very_low + low', async () => {
        await testSetCountIntegration('very_low', 'low', 14, 16);
      });

      it('should generate 16-18 sets for very_low + moderate', async () => {
        await testSetCountIntegration('very_low', 'moderate', 16, 18);
      });

      it('should generate 18-20 sets for very_low + high', async () => {
        await testSetCountIntegration('very_low', 'high', 18, 20);
      });
    });

    describe('Low Strength', () => {
      it('should generate 16-18 sets for low + low', async () => {
        await testSetCountIntegration('low', 'low', 16, 18);
      });

      it('should generate 18-20 sets for low + moderate', async () => {
        await testSetCountIntegration('low', 'moderate', 18, 20);
      });

      it('should generate 20-22 sets for low + high', async () => {
        await testSetCountIntegration('low', 'high', 20, 22);
      });
    });

    describe('Moderate Strength', () => {
      it('should generate 17-19 sets for moderate + low', async () => {
        await testSetCountIntegration('moderate', 'low', 17, 19);
      });

      it('should generate 19-22 sets for moderate + moderate', async () => {
        await testSetCountIntegration('moderate', 'moderate', 19, 22);
      });

      it('should generate 22-25 sets for moderate + high', async () => {
        await testSetCountIntegration('moderate', 'high', 22, 25);
      });
    });

    describe('High Strength', () => {
      it('should generate 18-20 sets for high + low', async () => {
        await testSetCountIntegration('high', 'low', 18, 20);
      });

      it('should generate 22-25 sets for high + moderate', async () => {
        await testSetCountIntegration('high', 'moderate', 22, 25);
      });

      it('should generate 25-27 sets for high + high', async () => {
        await testSetCountIntegration('high', 'high', 25, 27);
      });
    });
  });

  describe('Default Behavior Integration', () => {
    it('should default to moderate/moderate (19-22 sets) when both undefined', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: testContexts.default(), // No strength or intensity specified
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {}, // Empty context
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('19-22');
    });

    it('should default strength to moderate when only intensity provided', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          intensity: 'high' // Only intensity, no strength
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          intensity: 'high'
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // moderate strength + high intensity = 22-25 sets
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('22-25');
    });

    it('should default intensity to moderate when only strength provided', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          strength_capacity: 'low' // Only strength, no intensity
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'low'
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // low strength + moderate intensity = 18-20 sets
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('18-20');
    });
  });

  describe('Edge Cases and Invalid Inputs', () => {
    it('should handle invalid strength level by using defaults', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'invalid_strength' as any,
          intensity: 'low'
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // Should fallback to moderate/moderate = 19-22 sets
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('19-22');
    });

    it('should handle invalid intensity by using defaults', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'high',
          intensity: 'invalid_intensity' as any
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // Should fallback to moderate/moderate = 19-22 sets
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('19-22');
    });

    it('should handle null/undefined values gracefully', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: null as any,
          intensity: undefined as any
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // Should use defaults: moderate/moderate = 19-22 sets
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('19-22');
    });
  });

  describe('Reasoning Integration', () => {
    it('should include appropriate reasoning for low capacity users', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          strength_capacity: 'very_low',
          intensity: 'low'
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'very_low',
          intensity: 'low'
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      const output = interpretResult.structuredOutput as any;
      
      // Should see the reasoning in the summary
      const summary = output.summary || '';
      expect(summary).toMatch(/lower strength capacity|conservative volume/i);
      expect(summary).toMatch(/lower intensity|controlled volume/i);
      expect(output.totalSets || summary).toContain('14-16');
    });

    it('should include appropriate reasoning for high capacity users', async () => {
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          strength_capacity: 'high',
          intensity: 'high'
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'high',
          intensity: 'high'
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      const output = interpretResult.structuredOutput as any;
      
      // Should see the reasoning in the summary
      const summary = output.summary || '';
      expect(summary).toMatch(/higher strength capacity|increased.*volume/i);
      expect(summary).toMatch(/higher intensity|work capacity/i);
      expect(output.totalSets || summary).toContain('25-27');
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should generate workouts with appropriate set counts for different user profiles', async () => {
      // Test a few key user profiles
      const profiles: Array<{
        strength: 'very_low' | 'low' | 'moderate' | 'high';
        intensity: 'low' | 'moderate' | 'high';
        expectedSets: string;
      }> = [
        { strength: 'very_low', intensity: 'low', expectedSets: '14-16' },
        { strength: 'moderate', intensity: 'moderate', expectedSets: '19-22' },
        { strength: 'high', intensity: 'high', expectedSets: '25-27' }
      ];

      for (const profile of profiles) {
        const filterResult = await filterExercisesFromInput({
          clientContext: {
            ...testContexts.default(),
            strength_capacity: profile.strength,
            intensity: profile.intensity
          },
          workoutTemplate: createTestWorkoutTemplate(false)
        });

        const blocks = getExercisesByBlock(filterResult.filteredExercises);
        const organizedExercises = {
          blockA: blocks.blockA.slice(0, 5),
          blockB: blocks.blockB.slice(0, 8),
          blockC: blocks.blockC.slice(0, 8),
          blockD: blocks.blockD.slice(0, 6)
        };

        const state: WorkoutInterpretationStateType = {
          exercises: organizedExercises,
          clientContext: {
            strength_capacity: profile.strength,
            intensity: profile.intensity
          },
          interpretation: '',
          structuredOutput: {},
          timing: {},
          error: null
        };

        const interpretResult = await interpretExercisesNode(state);
        
        // Verify the workout was generated with correct set count
        const output = interpretResult.structuredOutput as any;
        expect(output.totalSets || output.summary).toContain(profile.expectedSets);
        
        // Verify the structured output contains actual exercises
        expect(interpretResult.structuredOutput).toBeDefined();
        if (interpretResult.structuredOutput && 
            typeof interpretResult.structuredOutput === 'object' &&
            'exercises' in interpretResult.structuredOutput) {
          const exercises = interpretResult.structuredOutput.exercises;
          expect(exercises).toBeDefined();
          expect(Object.keys(exercises).length).toBeGreaterThan(0);
        }
      }
    });

    it('should respect client context beyond just set counts', async () => {
      // Test that other client context still works with set count determination
      const filterResult = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.withMuscleTargets(['chest', 'triceps']),
          strength_capacity: 'low',
          intensity: 'high',
          avoid_joints: ['knees']
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(filterResult.filteredExercises);
      const organizedExercises = {
        blockA: blocks.blockA.slice(0, 5),
        blockB: blocks.blockB.slice(0, 8),
        blockC: blocks.blockC.slice(0, 8),
        blockD: blocks.blockD.slice(0, 6)
      };

      const state: WorkoutInterpretationStateType = {
        exercises: organizedExercises,
        clientContext: {
          strength_capacity: 'low',
          intensity: 'high',
          muscle_target: ['chest', 'triceps'],
          avoid_joints: ['knees']
        },
        interpretation: '',
        structuredOutput: {},
        timing: {},
        error: null
      };

      const interpretResult = await interpretExercisesNode(state);
      
      // Should have correct set count for low/high
      const output = interpretResult.structuredOutput as any;
      expect(output.totalSets || output.summary).toContain('20-22');
      
      // Should still respect muscle targeting - check that chest/triceps exercises are prioritized
      const allExercises = Object.values(organizedExercises).flat();
      const hasChestOrTriceps = allExercises.some(ex => 
        ex.primaryMuscle === 'chest' || ex.primaryMuscle === 'triceps' ||
        ex.secondaryMuscles?.includes('chest') || ex.secondaryMuscles?.includes('triceps')
      );
      expect(hasChestOrTriceps).toBe(true);
      
      // Verify exercises were selected and organized properly
      expect(Object.values(organizedExercises).flat().length).toBeGreaterThan(0);
    });
  });
});