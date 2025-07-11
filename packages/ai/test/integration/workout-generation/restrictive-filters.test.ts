import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock, testExercises } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import { getExerciseDataHelper } from '../../helpers/exerciseDataHelper';

describe('Restrictive Filter Scenarios (Phase 1 Focus)', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Joint Restriction Safety Overrides', () => {
    it('should exclude exercises loading avoided joints even if explicitly included', async () => {
      // CRITICAL SAFETY TEST: Joint restrictions must override include requests
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.withJointRestrictions(['knees']),
          exercise_requests: {
            include: ['Barbell Back Squat'], // This loads knees
            avoid: []
          }
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Squat should NOT be included despite being requested
      const hasSquat = result.filteredExercises.some(ex => ex.name === 'Barbell Back Squat');
      expect(hasSquat).toBe(false);

      // No exercises should load knees
      result.filteredExercises.forEach(exercise => {
        if (exercise.loadedJoints && Array.isArray(exercise.loadedJoints)) {
          expect(exercise.loadedJoints).not.toContain('knees');
        }
      });
    });

    it('should handle multiple joint restrictions severely limiting exercise pool', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withJointRestrictions(['knees', 'shoulders', 'elbows']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should still return some exercises (core, certain accessories)
      expect(result.filteredExercises.length).toBeGreaterThan(0);

      // Verify no restricted joints
      result.filteredExercises.forEach(exercise => {
        const joints = exercise.loadedJoints || [];
        expect(joints).not.toContain('knees');
        expect(joints).not.toContain('shoulders');
        expect(joints).not.toContain('elbows');
      });

      // Blocks might be incomplete due to restrictions
      const blocks = getExercisesByBlock(result.filteredExercises);
      // Core exercises should still be available
      expect(blocks.blockD.length).toBeGreaterThan(0);
    });
  });

  describe('Strength/Skill Level Edge Cases', () => {
    it('should handle very_low strength with high skill mismatch', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          name: 'Mismatched User',
          strength_capacity: 'very_low',
          skill_capacity: 'high' // Unusual combination
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should only include very_low strength exercises
      result.filteredExercises.forEach(exercise => {
        expect(exercise.strengthLevel).toBe('very_low');
      });

      // But skill can be anything up to high
      const skillLevels = new Set(result.filteredExercises.map(ex => ex.complexityLevel));
      expect(skillLevels.size).toBeGreaterThan(1);
    });

    it('should return limited exercises for very_low/very_low user', async () => {
      // Create a more limited exercise set for testing
      const limitedExercises = testExercises.filter(ex => 
        ex.strengthLevel === 'very_low' && ex.complexityLevel === 'very_low'
      );
      
      setupMocks(testExercises); // Use full set to ensure filtering works
      
      const result = await filterExercisesFromInput({
        clientContext: testContexts.beginner(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // All exercises should be very_low or low
      result.filteredExercises.forEach(exercise => {
        expect(['very_low', 'low']).toContain(exercise.strengthLevel);
        expect(['very_low', 'low']).toContain(exercise.complexityLevel);
      });

      // Might have incomplete blocks
      const blocks = getExercisesByBlock(result.filteredExercises);
      // Should have at least some exercises
      const totalExercises = blocks.blockA.length + blocks.blockB.length + 
                           blocks.blockC.length + blocks.blockD.length;
      expect(totalExercises).toBeGreaterThan(0);
    });
  });

  describe('Empty or Near-Empty Results', () => {
    it('should handle overly restrictive filters gracefully', async () => {
      // Create an impossible combination
      const result = await filterExercisesFromInput({
        clientContext: {
          name: 'Impossible User',
          strength_capacity: 'very_low',
          skill_capacity: 'very_low',
          avoid_joints: ['knees', 'hips', 'ankles', 'shoulders', 'elbows', 'wrists'],
          exercise_requests: {
            include: [],
            avoid: ['Plank', 'Dead Bug'] // Avoid remaining exercises
          }
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should not crash, should return empty or minimal results
      expect(result).toBeDefined();
      expect(result.filteredExercises).toBeDefined();
      
      // If no exercises pass filters, blocks should be empty
      if (result.filteredExercises.length === 0) {
        const blocks = getExercisesByBlock(result.filteredExercises);
        expect(blocks.blockA.length).toBe(0);
        expect(blocks.blockB.length).toBe(0);
        expect(blocks.blockC.length).toBe(0);
        expect(blocks.blockD.length).toBe(0);
      }
    });

    it('should prioritize safety over completeness', async () => {
      // User with many restrictions but requesting a complete workout
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.withJointRestrictions(['knees', 'lower_back']),
          primary_goal: 'strength'
        },
        intensity: 'high',
        workoutTemplate: createTestWorkoutTemplate(true)
      });

      // Every exercise should respect joint restrictions
      result.filteredExercises.forEach(exercise => {
        const joints = exercise.loadedJoints || [];
        expect(joints).not.toContain('knees');
        expect(joints).not.toContain('lower_back');
      });

      // Full body constraints might not be met due to safety
      const blocks = getExercisesByBlock(result.filteredExercises);
      // This is OK - safety > template requirements
    });
  });

  describe('Business ID Validation', () => {
    it('should handle invalid business ID by returning all exercises', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          business_id: 'invalid-not-uuid'
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should still work with all exercises
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Should get a complete workout
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockA.length).toBeLessThanOrEqual(5);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeLessThanOrEqual(8);
    });

    it('should handle missing business ID', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          business_id: undefined
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should work normally
      expect(result.filteredExercises.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Interaction Edge Cases', () => {
    it('should apply filters in correct order (include → filter → exclude)', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: {
          ...testContexts.beginner(),
          exercise_requests: {
            include: ['Pull-Ups', 'Push-Ups'], // High and very_low
            avoid: ['Push-Ups'] // Exclude one of the includes
          }
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Pull-Ups should be included (despite high level)
      const hasPullUp = result.filteredExercises.some(ex => ex.name === 'Pull-Ups');
      expect(hasPullUp).toBe(true);

      // Push-Ups should be excluded (exclude overrides include)
      const hasPushUp = result.filteredExercises.some(ex => ex.name === 'Push-Ups');
      expect(hasPushUp).toBe(false);
    });

    it('should handle empty include/exclude arrays', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          exercise_requests: {
            include: [],
            avoid: []
          }
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should work normally
      expect(result.filteredExercises.length).toBeGreaterThan(0);
    });
  });
});