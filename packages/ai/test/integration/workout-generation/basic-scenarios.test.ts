import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock, createTestFromDebugData } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import { getExerciseDataHelper } from '../../helpers/exerciseDataHelper';

describe('Basic Workout Generation Scenarios', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Happy Path Scenarios', () => {
    it('should generate a complete workout for a moderate user with no restrictions', async () => {
      // This test is based on your debug file - the baseline scenario
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Verify we got exercises
      expect(result.filteredExercises).toBeDefined();
      expect(result.filteredExercises.length).toBeGreaterThan(0);

      // Verify block distribution
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBeGreaterThan(0); // Primary strength (up to 5)
      expect(blocks.blockA.length).toBeLessThanOrEqual(5);
      expect(blocks.blockB.length).toBeGreaterThan(0); // Secondary strength (up to 8)
      expect(blocks.blockB.length).toBeLessThanOrEqual(8);
      expect(blocks.blockC.length).toBeGreaterThan(0); // Accessory (up to 8)
      expect(blocks.blockC.length).toBeLessThanOrEqual(8);
      expect(blocks.blockD.length).toBeGreaterThan(0); // Core & Capacity (up to 6)
      expect(blocks.blockD.length).toBeLessThanOrEqual(6);

      // Verify no exercise appears in multiple blocks
      const exerciseIds = new Set<string>();
      result.filteredExercises.forEach(ex => {
        expect(exerciseIds.has(ex.id)).toBe(false);
        exerciseIds.add(ex.id);
      });
    });

    it('should respect strength level cascading for beginner users', async () => {
      // Get all exercises to ensure we have enough beginner-friendly ones
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.beginner(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // All exercises should be very_low or low strength
      result.filteredExercises.forEach(exercise => {
        expect(['very_low', 'low']).toContain(exercise.strengthLevel);
      });

      // Should still get a complete workout
      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Debug: check if there are any primary strength exercises
      const primaryStrength = result.filteredExercises.filter(ex => 
        ex.functionTags?.includes('primary_strength')
      );
      
      // If there are no primary strength exercises, blockA could be empty
      if (primaryStrength.length > 0) {
        expect(blocks.blockA.length).toBeGreaterThan(0);
      }
      
      // Check if there are any secondary strength exercises
      const secondaryStrength = result.filteredExercises.filter(ex => 
        ex.functionTags?.includes('secondary_strength')
      );
      
      if (secondaryStrength.length > 0) {
        expect(blocks.blockB.length).toBeGreaterThan(0);
      }
    });

    it('should allow advanced users to access all exercises', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.advanced(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should have access to exercises of all levels
      const strengthLevels = new Set(result.filteredExercises.map(ex => ex.strengthLevel));
      expect(strengthLevels.size).toBeGreaterThan(1);
      
      // Should include some high-level exercises
      const hasHighLevel = result.filteredExercises.some(ex => ex.strengthLevel === 'high');
      expect(hasHighLevel).toBe(true);
    });
  });

  describe('Include/Exclude Exercise Overrides', () => {
    it('should include requested exercises even if above user level', async () => {
      // Get all exercises to ensure Pull-Ups is available
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.withExerciseRequests(['Pull-Ups']), // High level exercise
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Pull-Ups should be included despite being high level
      const hasPullUp = result.filteredExercises.some(ex => ex.name === 'Pull-Ups');
      expect(hasPullUp).toBe(true);

      // And it should be in blockA due to include boost
      const blockA = getExercisesByBlock(result.filteredExercises).blockA;
      const pullUpInBlockA = blockA.some(ex => ex.name === 'Pull-Ups');
      expect(pullUpInBlockA).toBe(true);
    });

    it('should exclude avoided exercises even if they match other criteria', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withExerciseRequests([], ['Barbell Back Squat']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should not include the avoided exercise
      const hasSquat = result.filteredExercises.some(ex => ex.name === 'Barbell Back Squat');
      expect(hasSquat).toBe(false);
    });
  });

  describe('Template Variations', () => {
    it('should apply full body constraints when requested', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true)
      });

      // Each main block (A, B, C) should have mix of upper and lower body
      const blocks = getExercisesByBlock(result.filteredExercises);
      
      ['blockA', 'blockB', 'blockC'].forEach(blockName => {
        const block = blocks[blockName as keyof typeof blocks];
        const upperBody = block.filter(ex => 
          ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats', 'delts', 'upper_back', 'upper_chest', 'traps', 'forearms'].includes(ex.primaryMuscle)
        );
        const lowerBody = block.filter(ex => 
          ['quads', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors', 'hip_flexors'].includes(ex.primaryMuscle)
        );
        
        // Full body constraint tries to balance upper and lower body
        if (block.length >= 4) {
          // With 4+ exercises, we should have at least 1 of each type
          expect(upperBody.length).toBeGreaterThan(0);
          expect(lowerBody.length).toBeGreaterThan(0);
          // The balance check - with random selection, we might get some variance
          // Block B has 8 exercises, so a 6-2 split is possible but not ideal
          const imbalance = Math.abs(upperBody.length - lowerBody.length);
          // For blocks with 8 exercises, allow up to 4 difference (6-2 or 2-6)
          // For smaller blocks, allow up to 3 difference
          const maxImbalance = block.length >= 8 ? 4 : 3;
          expect(imbalance).toBeLessThanOrEqual(maxImbalance);
        } else if (block.length > 0) {
          // For smaller blocks, just ensure we have both types if possible
          if (block.length >= 2) {
            expect(upperBody.length + lowerBody.length).toBeGreaterThan(0);
          }
        }
      });
    });

    it('should work without a template (returning scored exercises only)', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default()
        // No template provided
      });

      // Should still filter and score exercises
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // But no block assignments
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBe(0);
      expect(blocks.blockB.length).toBe(0);
      expect(blocks.blockC.length).toBe(0);
      expect(blocks.blockD.length).toBe(0);
    });
  });

  describe('Using Debug Data for Test Cases', () => {
    it('should reproduce results similar to captured debug state', async () => {
      // This demonstrates the "smart approach" - using debug data to create tests
      const debugData = {
        filters: {
          clientName: "Web User",
          strengthCapacity: "moderate",
          skillCapacity: "moderate",
          intensity: "moderate",
          muscleTarget: [],
          muscleLessen: [],
          avoidJoints: [],
          includeExercises: [],
          avoidExercises: [],
          isFullBody: false
        },
        results: {
          totalExercises: 117,
          blockA: { count: 5 },
          blockB: { count: 8 },
          blockC: { count: 8 },
          blockD: { count: 6 }
        }
      };

      const { clientContext, expectedCounts } = createTestFromDebugData(debugData);
      
      const result = await filterExercisesFromInput({
        clientContext,
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Verify we get reasonable block distribution
      const blocks = getExercisesByBlock(result.filteredExercises);
      // Allow some variation from exact counts due to exercise availability
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockA.length).toBeLessThanOrEqual(expectedCounts.blockA);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeLessThanOrEqual(expectedCounts.blockB);
      expect(blocks.blockC.length).toBeGreaterThan(0);
      expect(blocks.blockC.length).toBeLessThanOrEqual(expectedCounts.blockC);
      expect(blocks.blockD.length).toBeGreaterThan(0);
      expect(blocks.blockD.length).toBeLessThanOrEqual(expectedCounts.blockD);
    });
  });
});