import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock, createTestFromDebugData } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';

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
      expect(blocks.blockA.length).toBe(5); // Primary strength
      expect(blocks.blockB.length).toBe(8); // Secondary strength
      expect(blocks.blockC.length).toBe(8); // Accessory
      expect(blocks.blockD.length).toBe(6); // Core & Capacity

      // Verify no exercise appears in multiple blocks
      const exerciseIds = new Set<string>();
      result.filteredExercises.forEach(ex => {
        expect(exerciseIds.has(ex.id)).toBe(false);
        exerciseIds.add(ex.id);
      });
    });

    it('should respect strength level cascading for beginner users', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.beginner(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // All exercises should be very_low or low strength
      result.filteredExercises.forEach(exercise => {
        expect(['very_low', 'low']).toContain(exercise.strengthLevel);
      });

      // Should still get a complete workout
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeGreaterThan(0);
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
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withExerciseRequests(['Pull-Up']), // High level exercise
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Pull-Up should be included despite being high level
      const hasPullUp = result.filteredExercises.some(ex => ex.name === 'Pull-Up');
      expect(hasPullUp).toBe(true);

      // And it should be in blockA due to include boost
      const blockA = getExercisesByBlock(result.filteredExercises).blockA;
      const pullUpInBlockA = blockA.some(ex => ex.name === 'Pull-Up');
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
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true)
      });

      // Each main block (A, B, C) should have mix of upper and lower body
      const blocks = getExercisesByBlock(result.filteredExercises);
      
      ['blockA', 'blockB', 'blockC'].forEach(blockName => {
        const block = blocks[blockName as keyof typeof blocks];
        const upperBody = block.filter(ex => 
          ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'].includes(ex.primaryMuscle)
        );
        const lowerBody = block.filter(ex => 
          ['quads', 'hamstrings', 'glutes', 'calves'].includes(ex.primaryMuscle)
        );
        
        // Full body constraint requires min 2 of each
        expect(upperBody.length).toBeGreaterThanOrEqual(2);
        expect(lowerBody.length).toBeGreaterThanOrEqual(2);
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

      // Verify counts match (approximately - some randomness in selection)
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBe(expectedCounts.blockA);
      expect(blocks.blockB.length).toBe(expectedCounts.blockB);
      expect(blocks.blockC.length).toBe(expectedCounts.blockC);
      expect(blocks.blockD.length).toBe(expectedCounts.blockD);
    });
  });
});