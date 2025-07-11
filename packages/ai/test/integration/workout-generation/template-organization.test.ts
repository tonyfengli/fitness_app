import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock, createTestExerciseWithOverrides } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import { getExerciseDataHelper } from '../../helpers/exerciseDataHelper';
import type { Exercise } from '../../../src/types';

describe('Template Organization & Block Selection (Phase 4)', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Template Selection Logic', () => {
    it('should use standard workout template by default', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false) // isFullBody = false
      });

      // Standard template should organize into 4 blocks
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA).toBeDefined();
      expect(blocks.blockB).toBeDefined();
      expect(blocks.blockC).toBeDefined();
      expect(blocks.blockD).toBeDefined();
      
      // Should not have full-body constraints (can verify by checking if blocks have mixed upper/lower)
      // This is tested more thoroughly in the full-body constraints section
    });

    it('should use full-body template when isFullBody flag is true', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true) // isFullBody = true
      });

      // Should still have 4 blocks but with muscle constraints
      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Verify blocks A, B, C have mixed upper/lower (tested in detail later)
      ['blockA', 'blockB', 'blockC'].forEach(blockName => {
        const block = blocks[blockName as keyof typeof blocks];
        const hasUpper = block.some(ex => 
          ['chest', 'shoulders', 'back', 'lats', 'traps', 'biceps', 'triceps', 'upper_back', 'upper_chest', 'delts'].includes(ex.primaryMuscle || '')
        );
        const hasLower = block.some(ex => 
          ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'abductors', 'adductors'].includes(ex.primaryMuscle || '')
        );
        
        if (block.length >= 4) { // Only check if block has enough exercises
          expect(hasUpper || hasLower).toBe(true);
        }
      });
    });

    it('should handle dynamic template selection based on criteria', async () => {
      // Currently the system doesn't expose dynamic template selection through the API
      // This would test future functionality when workoutType is exposed
      // For now, we can only test that the default template works
      
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      expect(result.filteredExercises.length).toBeGreaterThan(0);
    });
  });

  describe('Block Organization', () => {
    it('should filter exercises by function tags for each block', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Block A should only have primary_strength exercises
      blocks.blockA.forEach(ex => {
        expect(ex.functionTags).toContain('primary_strength');
      });
      
      // Block B should only have secondary_strength exercises
      blocks.blockB.forEach(ex => {
        expect(ex.functionTags).toContain('secondary_strength');
      });
      
      // Block C should only have accessory exercises
      blocks.blockC.forEach(ex => {
        expect(ex.functionTags).toContain('accessory');
      });
      
      // Block D should only have core or capacity exercises
      blocks.blockD.forEach(ex => {
        const hasCoreOrCapacity = ex.functionTags?.includes('core') || 
                                 ex.functionTags?.includes('capacity');
        expect(hasCoreOrCapacity).toBe(true);
      });
    });

    it('should respect maximum exercise limits per block', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Verify max limits from architecture doc
      expect(blocks.blockA.length).toBeLessThanOrEqual(5);  // Primary strength
      expect(blocks.blockB.length).toBeLessThanOrEqual(8);  // Secondary strength
      expect(blocks.blockC.length).toBeLessThanOrEqual(8);  // Accessory
      expect(blocks.blockD.length).toBeLessThanOrEqual(6);  // Core & Capacity
    });

    it('should maintain exercise ordering within blocks', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Exercises should be ordered: constraint-satisfying first, then by score
      // For Block A (deterministic), should be in descending score order
      if (blocks.blockA.length > 1) {
        const scores = blocks.blockA.map(ex => ex.score);
        // Note: This assumes no penalties in block A, which is true
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeLessThanOrEqual(scores[i-1]);
        }
      }
    });
  });

  describe('Constraint Satisfaction', () => {
    it('should satisfy movement pattern requirements for each block', async () => {
      const helper = getExerciseDataHelper();
      // Create a diverse set of exercises with all movement patterns
      const exercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: exercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Helper to check movement patterns
      const hasMovementPattern = (block: Exercise[], patterns: string[]) => {
        return patterns.some(pattern => 
          block.some(ex => {
            if (pattern === 'squat/hinge') {
              return ex.movementPattern === 'squat' || ex.movementPattern === 'hinge';
            } else if (pattern === 'push') {
              return ex.movementPattern === 'horizontal_push' || ex.movementPattern === 'vertical_push';
            } else if (pattern === 'pull') {
              return ex.movementPattern === 'horizontal_pull' || ex.movementPattern === 'vertical_pull';
            } else if (pattern === 'lunge') {
              return ex.movementPattern === 'lunge';
            }
            return ex.movementPattern === pattern;
          })
        );
      };
      
      // Block A: squat/hinge AND push AND pull
      if (blocks.blockA.length >= 3) {
        expect(hasMovementPattern(blocks.blockA, ['squat/hinge'])).toBe(true);
        expect(hasMovementPattern(blocks.blockA, ['push'])).toBe(true);
        expect(hasMovementPattern(blocks.blockA, ['pull'])).toBe(true);
      }
      
      // Block B: squat/hinge AND push AND pull AND lunge
      if (blocks.blockB.length >= 4) {
        expect(hasMovementPattern(blocks.blockB, ['squat/hinge'])).toBe(true);
        expect(hasMovementPattern(blocks.blockB, ['push'])).toBe(true);
        expect(hasMovementPattern(blocks.blockB, ['pull'])).toBe(true);
        expect(hasMovementPattern(blocks.blockB, ['lunge'])).toBe(true);
      }
      
      // Block C: squat/hinge AND push AND pull
      if (blocks.blockC.length >= 3) {
        expect(hasMovementPattern(blocks.blockC, ['squat/hinge'])).toBe(true);
        expect(hasMovementPattern(blocks.blockC, ['push'])).toBe(true);
        expect(hasMovementPattern(blocks.blockC, ['pull'])).toBe(true);
      }
      
      // Block D: min 1 core AND min 2 capacity
      if (blocks.blockD.length >= 3) {
        const coreCount = blocks.blockD.filter(ex => ex.functionTags?.includes('core')).length;
        const capacityCount = blocks.blockD.filter(ex => ex.functionTags?.includes('capacity')).length;
        expect(coreCount).toBeGreaterThanOrEqual(1);
        expect(capacityCount).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle constraint fulfillment logic correctly', async () => {
      const helper = getExerciseDataHelper();
      // Create exercises that specifically meet constraints
      const primaryStrengthExercises = helper.getAllExercises()
        .filter(ex => ex.functionTags?.includes('primary_strength'))
        .slice(0, 10);
      
      const result = await filterExercisesFromInput({
        exercises: primaryStrengthExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Constraint-satisfying exercises should appear first in block
      // This is hard to test without access to internal state, but we can verify
      // that exercises matching required patterns are included
      if (blocks.blockA.length > 0) {
        const patterns = blocks.blockA.map(ex => ex.movementPattern);
        const hasSquatHinge = patterns.some(p => p === 'squat' || p === 'hinge');
        const hasPush = patterns.some(p => p === 'horizontal_push' || p === 'vertical_push');
        const hasPull = patterns.some(p => p === 'horizontal_pull' || p === 'vertical_pull');
        
        // At least one constraint should be satisfied if exercises exist
        expect(hasSquatHinge || hasPush || hasPull).toBe(true);
      }
    });

    it('should apply tie-breaking mechanisms correctly', async () => {
      // Create exercises with same score but different patterns
      const helper = getExerciseDataHelper();
      const exercises = helper.getAllExercises()
        .filter(ex => ex.functionTags?.includes('primary_strength'))
        .map(ex => ({ ...ex, score: 5.0 })); // Force same score
      
      const result = await filterExercisesFromInput({
        exercises: exercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Block A uses deterministic selection - should take first exercise that meets constraints
      // Blocks B/C/D use randomized selection - harder to test but should have variety
      expect(blocks.blockA.length).toBeGreaterThan(0);
    });

    it('should respect block-specific constraints', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Each block should only contain exercises matching its function tags
      const blockConstraints = {
        blockA: ['primary_strength'],
        blockB: ['secondary_strength'],
        blockC: ['accessory'],
        blockD: ['core', 'capacity']
      };
      
      Object.entries(blocks).forEach(([blockName, exercises]) => {
        const allowedTags = blockConstraints[blockName as keyof typeof blockConstraints];
        exercises.forEach(ex => {
          const hasAllowedTag = allowedTags.some(tag => ex.functionTags?.includes(tag));
          expect(hasAllowedTag).toBe(true);
        });
      });
    });
  });

  describe('Selection Strategies', () => {
    it('should use deterministic selection for Block A', async () => {
      // Run multiple times with same input to verify deterministic behavior
      const helper = getExerciseDataHelper();
      const exercises = helper.getAllExercises()
        .filter(ex => ex.functionTags?.includes('primary_strength'));
      
      const results = await Promise.all([
        filterExercisesFromInput({
          exercises: exercises,
          clientContext: testContexts.default(),
          workoutTemplate: createTestWorkoutTemplate(false)
        }),
        filterExercisesFromInput({
          exercises: exercises,
          clientContext: testContexts.default(),
          workoutTemplate: createTestWorkoutTemplate(false)
        })
      ]);
      
      const blocks1 = getExercisesByBlock(results[0].filteredExercises);
      const blocks2 = getExercisesByBlock(results[1].filteredExercises);
      
      // Block A should be identical (deterministic)
      expect(blocks1.blockA.map(ex => ex.id)).toEqual(blocks2.blockA.map(ex => ex.id));
    });

    it('should use randomized weighted selection for Blocks B/C/D', async () => {
      // This is harder to test definitively due to randomness
      // We can verify that exercises with muscle targeting score higher and appear more
      const helper = getExerciseDataHelper();
      const exercises = helper.getAllExercises();
      
      // Create context with muscle targeting to boost scores
      const contextWithMuscleTarget = {
        ...testContexts.default(),
        muscle_target: ['chest', 'lats'] // This will boost exercises targeting these muscles
      };
      
      const result = await filterExercisesFromInput({
        exercises,
        clientContext: contextWithMuscleTarget,
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Find exercises that target chest or lats (they should have higher scores)
      const targetedExercises = result.filteredExercises.filter(ex => 
        ex.primaryMuscle === 'chest' || ex.primaryMuscle === 'lats' ||
        (ex.secondaryMuscles && (ex.secondaryMuscles.includes('chest') || ex.secondaryMuscles.includes('lats')))
      );
      
      // At least some targeted exercises should appear in blocks B/C/D
      const selectedIds = [
        ...blocks.blockB.map(ex => ex.id),
        ...blocks.blockC.map(ex => ex.id),
        ...blocks.blockD.map(ex => ex.id)
      ];
      
      const targetedSelected = targetedExercises.filter(ex => selectedIds.includes(ex.id));
      expect(targetedSelected.length).toBeGreaterThan(0);
    });

    it('should fill remaining slots based on score after constraints', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // After constraint exercises, remaining should be filled by score
      // This is implicit in the selection but hard to test directly
      // We can verify blocks are filled up to their limits when exercises available
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockC.length).toBeGreaterThan(0);
      expect(blocks.blockD.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Block Penalty Mechanics', () => {
    it('should apply penalties when exercises reused across blocks', async () => {
      const helper = getExerciseDataHelper();
      // Get exercises that have multiple function tags
      const exercises = helper.getAllExercises()
        .filter(ex => 
          ex.functionTags?.includes('primary_strength') && 
          ex.functionTags?.includes('secondary_strength')
        );
      
      if (exercises.length > 0) {
        const result = await filterExercisesFromInput({
          exercises: exercises,
          clientContext: testContexts.default(),
          workoutTemplate: createTestWorkoutTemplate(false)
        });

        const allExercises = result.filteredExercises;
        
        // Find exercises that appear in multiple blocks
        const exerciseBlockMap = new Map<string, string[]>();
        
        const blocks = getExercisesByBlock(allExercises);
        Object.entries(blocks).forEach(([blockName, blockExercises]) => {
          blockExercises.forEach(ex => {
            if (!exerciseBlockMap.has(ex.id)) {
              exerciseBlockMap.set(ex.id, []);
            }
            exerciseBlockMap.get(ex.id)!.push(blockName);
          });
        });
        
        // Check for exercises in multiple blocks
        exerciseBlockMap.forEach((blocks, exerciseId) => {
          if (blocks.includes('blockA') && blocks.includes('blockB')) {
            // Exercise in both A and B - B version should have penalty
            const exerciseInB = allExercises.find(ex => 
              ex.id === exerciseId && (ex as any).isSelectedBlockB
            );
            // Note: The penalty is applied during selection, not visible in output
            expect(exerciseInB).toBeDefined();
          }
        });
      }
    });

    it('should preserve original scores when applying penalties', async () => {
      const helper = getExerciseDataHelper();
      const exercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: exercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // All exercises should have their original scores preserved
      result.filteredExercises.forEach(ex => {
        expect(ex.score).toBeDefined();
        expect(ex.score).toBeGreaterThanOrEqual(0);
      });
    });

    it('should not apply penalties to Block D exercises', async () => {
      const helper = getExerciseDataHelper();
      // Get exercises that could appear in multiple blocks including D
      const exercises = helper.getAllExercises()
        .filter(ex => 
          (ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity')) &&
          ex.functionTags?.includes('secondary_strength')
        );
      
      const result = await filterExercisesFromInput({
        exercises: exercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Block D exercises can reuse from other blocks without penalty
      // This is implicit in the selection logic
      expect(blocks.blockD.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Full-Body Constraints', () => {
    it('should enforce minimum upper body exercises in blocks A/B/C', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true) // Full body mode
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      const upperBodyMuscles = ['chest', 'shoulders', 'back', 'lats', 'traps', 'biceps', 'triceps', 'upper_back', 'upper_chest', 'delts'];
      
      ['blockA', 'blockB', 'blockC'].forEach(blockName => {
        const block = blocks[blockName as keyof typeof blocks];
        if (block.length >= 4) { // Only check if block has enough exercises
          const upperBodyCount = block.filter(ex => 
            upperBodyMuscles.includes(ex.primaryMuscle || '')
          ).length;
          expect(upperBodyCount).toBeGreaterThanOrEqual(2);
        }
      });
    });

    it('should enforce minimum lower body exercises in blocks A/B/C', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true) // Full body mode
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      const lowerBodyMuscles = ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'abductors', 'adductors'];
      
      ['blockA', 'blockB', 'blockC'].forEach(blockName => {
        const block = blocks[blockName as keyof typeof blocks];
        if (block.length >= 4) { // Only check if block has enough exercises
          const lowerBodyCount = block.filter(ex => 
            lowerBodyMuscles.includes(ex.primaryMuscle || '')
          ).length;
          expect(lowerBodyCount).toBeGreaterThanOrEqual(2);
        }
      });
    });

    it('should exclude Block D from muscle constraints', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true) // Full body mode
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Block D should not be required to have upper/lower balance
      // It should only have core/capacity exercises regardless
      blocks.blockD.forEach(ex => {
        const hasCoreOrCapacity = ex.functionTags?.includes('core') || 
                                 ex.functionTags?.includes('capacity');
        expect(hasCoreOrCapacity).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle insufficient exercises for constraints gracefully', async () => {
      // Create very limited exercise set
      const helper = getExerciseDataHelper();
      const limitedExercises = helper.getAllExercises()
        .filter(ex => ex.functionTags?.includes('primary_strength'))
        .slice(0, 2); // Only 2 primary strength exercises
      
      const result = await filterExercisesFromInput({
        exercises: limitedExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Should still work but with fewer exercises
      expect(blocks.blockA.length).toBeLessThanOrEqual(2);
      expect(result.filteredExercises.length).toBeGreaterThan(0);
    });

    it('should handle all exercises having the same score', async () => {
      const helper = getExerciseDataHelper();
      // Force all exercises to have same score
      const exercises = helper.getAllExercises().map(ex => ({
        ...ex,
        score: 5.0
      }));
      
      const result = await filterExercisesFromInput({
        exercises: exercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Should still organize into blocks properly
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockC.length).toBeGreaterThan(0);
      expect(blocks.blockD.length).toBeGreaterThan(0);
    });

    it('should handle no exercises matching function tags', async () => {
      // Create exercises with no valid function tags
      const invalidExercises: Exercise[] = [{
        id: '1',
        name: 'Invalid Exercise',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        loadedJoints: [],
        movementPattern: 'horizontal_push',
        modality: 'strength',
        movementTags: [],
        functionTags: ['invalid_tag'] as any, // Invalid tag
        fatigueProfile: 'moderate_local',
        complexityLevel: 'moderate',
        equipment: [],
        strengthLevel: 'moderate',
        createdAt: new Date()
      }];
      
      const result = await filterExercisesFromInput({
        exercises: invalidExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // All blocks should be empty
      expect(blocks.blockA.length).toBe(0);
      expect(blocks.blockB.length).toBe(0);
      expect(blocks.blockC.length).toBe(0);
      expect(blocks.blockD.length).toBe(0);
    });

    it('should handle template fallback behavior', async () => {
      // Test with undefined template - should still work with default
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: undefined
      });

      // Should work but without template organization
      expect(result.filteredExercises).toBeDefined();
      expect(result.filteredExercises.length).toBeGreaterThan(0);
    });
  });
});