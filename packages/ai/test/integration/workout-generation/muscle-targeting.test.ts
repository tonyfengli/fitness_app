import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock, testExercises, createTestExerciseWithOverrides } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import { getExerciseDataHelper } from '../../helpers/exerciseDataHelper';

describe('Muscle Targeting & Scoring Scenarios (Phase 2 Focus)', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Include Exercise Boost Guarantee', () => {
    it('should ensure included exercises always score highest', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: {
          ...testContexts.withExerciseRequests(['Push-Ups', 'Plank']),
          muscle_target: ['chest'], // This would normally boost bench press
          muscle_lessen: ['core'] // This would normally penalize plank
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Get all scores
      const scores = result.filteredExercises.map(ex => ({
        name: ex.name,
        score: ex.score
      })).sort((a, b) => b.score - a.score);

      // Included exercises should have the highest scores
      const topTwoNames = [scores[0]?.name, scores[1]?.name];
      expect(topTwoNames).toContain('Push-Ups');
      expect(topTwoNames).toContain('Plank');
      
      // Their scores should be higher than any non-included exercise
      const highestNonIncludedScore = Math.max(
        ...scores.slice(2).map(s => s.score)
      );
      expect(scores[0]?.score).toBeGreaterThan(highestNonIncludedScore);
      expect(scores[1]?.score).toBeGreaterThan(highestNonIncludedScore);
    });

    it('should place included exercises in blockA due to high scores', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.withExerciseRequests(
          ['Incline Bicep Curl', 'Single-Leg Calf Raise'] // Normally accessory exercises
        ),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Check that included exercises are present with high scores
      const includedExercises = result.filteredExercises.filter(ex => 
        ex.name === 'Incline Bicep Curl' || ex.name === 'Single-Leg Calf Raise'
      );
      
      expect(includedExercises.length).toBe(2);
      
      // They should have high scores due to include boost
      const allScores = result.filteredExercises.map(ex => ex.score).sort((a, b) => b - a);
      includedExercises.forEach(ex => {
        // Each included exercise should be in top 10 by score
        const scoreRank = allScores.indexOf(ex.score);
        expect(scoreRank).toBeLessThan(10);
      });
    });
  });

  describe('Muscle Target Scoring', () => {
    it('should boost exercises targeting requested muscles', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withMuscleTargets(['chest', 'triceps']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Exercises targeting chest or triceps should score higher
      const chestExercises = result.filteredExercises.filter(ex => 
        ex.primaryMuscle === 'chest' || ex.secondaryMuscles?.includes('chest')
      );
      const tricepExercises = result.filteredExercises.filter(ex => 
        ex.primaryMuscle === 'triceps' || ex.secondaryMuscles?.includes('triceps')
      );

      // Average score of targeted exercises should be higher
      const targetedAvgScore = [...chestExercises, ...tricepExercises]
        .reduce((sum, ex) => sum + ex.score, 0) / (chestExercises.length + tricepExercises.length);
      
      const nonTargetedExercises = result.filteredExercises.filter(ex => 
        ex.primaryMuscle !== 'chest' && !ex.secondaryMuscles?.includes('chest') &&
        ex.primaryMuscle !== 'triceps' && !ex.secondaryMuscles?.includes('triceps')
      );
      const nonTargetedAvgScore = nonTargetedExercises
        .reduce((sum, ex) => sum + ex.score, 0) / nonTargetedExercises.length;

      expect(targetedAvgScore).toBeGreaterThan(nonTargetedAvgScore);
    });

    it('should apply larger bonus for primary muscle matches', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withMuscleTargets(['lats']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Find exercises with lats as primary vs secondary
      const primaryLats = result.filteredExercises.find(ex => ex.primaryMuscle === 'lats');
      const secondaryLats = result.filteredExercises.find(ex => 
        ex.secondaryMuscles?.includes('lats') && ex.primaryMuscle !== 'lats'
      );

      expect(primaryLats).toBeDefined();
      expect(secondaryLats).toBeDefined();
      
      // Primary muscle match should score higher
      expect(primaryLats!.score).toBeGreaterThan(secondaryLats!.score);
    });

    it('should handle multiple muscle targets without stacking bonuses', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: testContexts.withMuscleTargets(['chest', 'triceps', 'shoulders']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Bench press hits all three (chest primary, triceps & shoulders secondary)
      const benchPress = result.filteredExercises.find(ex => ex.name === 'Barbell Bench Press');
      expect(benchPress).toBeDefined();

      // Score should have only the highest bonus applied (primary muscle match)
      // Not stacked bonuses for all three matches
      // Base score (5) + primary bonus (3) = 8
      expect(benchPress!.score).toBeLessThanOrEqual(8);
    });
  });

  describe('Muscle Lessen Penalties', () => {
    it('should penalize exercises targeting muscles to lessen', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withMuscleTargets([], ['quads']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Quad exercises should have lower scores
      const quadExercises = result.filteredExercises.filter(ex => ex.primaryMuscle === 'quads');
      const nonQuadExercises = result.filteredExercises.filter(ex => ex.primaryMuscle !== 'quads');

      if (quadExercises.length > 0 && nonQuadExercises.length > 0) {
        const quadAvgScore = quadExercises.reduce((sum, ex) => sum + ex.score, 0) / quadExercises.length;
        const nonQuadAvgScore = nonQuadExercises.reduce((sum, ex) => sum + ex.score, 0) / nonQuadExercises.length;
        
        expect(quadAvgScore).toBeLessThan(nonQuadAvgScore);
      }
    });

    it('should handle conflicts between target and lessen', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      const result = await filterExercisesFromInput({
        exercises: allExercises,
        clientContext: {
          ...testContexts.default(),
          muscle_target: ['chest'],
          muscle_lessen: ['triceps'] // Conflict - most chest exercises use triceps
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Bench press: chest primary (+3) but triceps secondary (-1.5)
      const benchPress = result.filteredExercises.find(ex => ex.name === 'Barbell Bench Press');
      
      // Should still have positive score adjustment
      // Base (5) + chest bonus (3) - triceps penalty (1.5) = 6.5
      expect(benchPress!.score).toBeGreaterThan(5);
      expect(benchPress!.score).toBeLessThan(8);
    });

    it('should not allow scores to go negative', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.withMuscleTargets([], ['core', 'shoulders']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Even with penalties, no score should be negative
      result.filteredExercises.forEach(exercise => {
        expect(exercise.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Intensity-Based Scoring', () => {
    it('should prefer low fatigue exercises for low intensity', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        intensity: 'low',
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Low intensity should prefer low_local and moderate_local fatigue
      const lowFatigueExercises = result.filteredExercises.filter(ex => 
        ex.fatigueProfile === 'low_local' || ex.fatigueProfile === 'moderate_local'
      );
      const highFatigueExercises = result.filteredExercises.filter(ex => 
        ex.fatigueProfile === 'high_systemic' || ex.fatigueProfile === 'metabolic'
      );

      if (lowFatigueExercises.length > 0 && highFatigueExercises.length > 0) {
        const lowAvg = lowFatigueExercises.reduce((sum, ex) => sum + ex.score, 0) / lowFatigueExercises.length;
        const highAvg = highFatigueExercises.reduce((sum, ex) => sum + ex.score, 0) / highFatigueExercises.length;
        
        expect(lowAvg).toBeGreaterThan(highAvg);
      }
    });

    it('should prefer high fatigue exercises for high intensity', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        intensity: 'high',
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // High intensity should prefer high fatigue exercises
      const highFatigueExercises = result.filteredExercises.filter(ex => 
        ['high_local', 'high_systemic', 'metabolic'].includes(ex.fatigueProfile || '')
      );
      const lowFatigueExercises = result.filteredExercises.filter(ex => 
        ex.fatigueProfile === 'low_local'
      );

      if (highFatigueExercises.length > 0 && lowFatigueExercises.length > 0) {
        const highAvg = highFatigueExercises.reduce((sum, ex) => sum + ex.score, 0) / highFatigueExercises.length;
        const lowAvg = lowFatigueExercises.reduce((sum, ex) => sum + ex.score, 0) / lowFatigueExercises.length;
        
        expect(highAvg).toBeGreaterThan(lowAvg);
      }
    });

    it('should be neutral for moderate intensity', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        intensity: 'moderate',
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // With moderate intensity and no muscle targeting, exercises should have scores close to base
      const scores = result.filteredExercises.map(ex => ex.score);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      // Average score should be close to base score (5) with some variation
      expect(avgScore).toBeGreaterThan(4);
      expect(avgScore).toBeLessThan(6);
    });
  });

  describe('Score Distribution Edge Cases', () => {
    it('should handle all exercises having the same score', async () => {
      // No targeting, moderate intensity = all base scores
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Check if many exercises have the same score
      const scoreGroups = result.filteredExercises.reduce((acc, ex) => {
        acc[ex.score] = (acc[ex.score] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // When exercises have same score, selection becomes random
      // But blocks should still be filled according to function tags
      const blocks = getExercisesByBlock(result.filteredExercises);
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockA.length).toBeLessThanOrEqual(5);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeLessThanOrEqual(8);
      expect(blocks.blockC.length).toBeGreaterThan(0);
      expect(blocks.blockC.length).toBeLessThanOrEqual(8);
      expect(blocks.blockD.length).toBeGreaterThan(0);
      expect(blocks.blockD.length).toBeLessThanOrEqual(6);
    });

    it('should create clear score differentiation with targeting', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          muscle_target: ['chest', 'triceps'],
          muscle_lessen: ['legs', 'back']
        },
        intensity: 'high',
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Should have a range of scores
      const scores = [...new Set(result.filteredExercises.map(ex => ex.score))].sort((a, b) => b - a);
      expect(scores.length).toBeGreaterThan(3); // Multiple score levels

      // Highest scores should be chest/triceps exercises
      const topExercises = result.filteredExercises
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      const topTargetsMuscles = topExercises.filter(ex => 
        ex.primaryMuscle === 'chest' || ex.primaryMuscle === 'triceps' ||
        ex.secondaryMuscles?.includes('chest') || ex.secondaryMuscles?.includes('triceps')
      );
      
      // At least 1 of the top 5 should target chest or triceps (with 'legs' and 'back' penalized)
      expect(topTargetsMuscles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fatigue Profile Edge Cases', () => {
    it('should handle exercises with missing fatigue profiles', async () => {
      const helper = getExerciseDataHelper();
      const allExercises = helper.getAllExercises();
      
      // Create exercises with missing/invalid fatigue profiles
      const exercisesWithMissingProfiles = [
        ...allExercises.slice(0, 5),
        createTestExerciseWithOverrides({ 
          ...allExercises[5],
          id: 'missing1', 
          name: 'Missing Profile Exercise',
          fatigueProfile: undefined as any 
        }),
        createTestExerciseWithOverrides({ 
          ...allExercises[6],
          id: 'missing2', 
          name: 'Null Profile Exercise',
          fatigueProfile: null as any 
        }),
        createTestExerciseWithOverrides({ 
          ...allExercises[7],
          id: 'invalid1', 
          name: 'Invalid Profile Exercise',
          fatigueProfile: 'invalid_profile' as any 
        })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: exercisesWithMissingProfiles,
        clientContext: testContexts.default(),
        intensity: 'high', // This should trigger fatigue profile scoring
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // Should not crash and should include exercises with missing profiles
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Exercises with missing/invalid profiles should get base score (no intensity adjustment)
      const missingProfileExercises = result.filteredExercises.filter(ex => 
        ex.name.includes('Missing') || ex.name.includes('Null') || ex.name.includes('Invalid')
      );
      
      missingProfileExercises.forEach(ex => {
        expect(ex.score).toBe(5); // Base score with no adjustments
      });
    });

    it('should handle all exercises missing fatigue profiles', async () => {
      // Create exercises without fatigue profiles
      const exercisesWithoutProfiles = testExercises.map(ex => 
        createTestExerciseWithOverrides({ ...ex, fatigueProfile: undefined as any })
      );
      
      const result = await filterExercisesFromInput({
        exercises: exercisesWithoutProfiles,
        clientContext: testContexts.default(),
        // Don't pass intensity when testing exercises without fatigue profiles
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // Should work normally with base scoring
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // All should have base score since no intensity adjustments possible
      result.filteredExercises.forEach(ex => {
        expect(ex.score).toBe(5);
      });
    });
  });

  describe('Malformed Scoring Criteria', () => {
    it('should handle invalid intensity values', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        intensity: 'invalid_intensity' as any,
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // Should not crash - invalid intensity should be ignored
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Scores should be base (5) or adjusted by muscle targeting only
      result.filteredExercises.forEach(ex => {
        expect(ex.score).toBeGreaterThanOrEqual(0);
        expect(ex.score).toBeLessThanOrEqual(8); // Max without intensity adjustments
      });
    });

    it('should handle null/undefined muscle arrays gracefully', async () => {
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          muscle_target: null as any,
          muscle_lessen: undefined as any
        },
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // Should work with base scoring
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      result.filteredExercises.forEach(ex => {
        expect(ex.score).toBe(5); // Base score only
      });
    });

    it('should handle exercises with null/undefined muscle arrays', async () => {
      const exercisesWithBadMuscles = [
        createTestExerciseWithOverrides({
          ...testExercises[0],
          id: 'bad1',
          secondaryMuscles: null as any
        }),
        createTestExerciseWithOverrides({
          ...testExercises[1],
          id: 'bad2',
          secondaryMuscles: undefined as any
        }),
        createTestExerciseWithOverrides({
          ...testExercises[2],
          id: 'bad3',
          secondaryMuscles: 'not_an_array' as any
        }),
        ...testExercises.slice(3, 10)
      ];
      
      const result = await filterExercisesFromInput({
        exercises: exercisesWithBadMuscles,
        clientContext: testContexts.withMuscleTargets(['chest', 'triceps']),
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // Should not crash
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Exercises with bad secondary muscles should still get primary muscle bonus if applicable
      const badExercises = result.filteredExercises.filter(ex => 
        ex.id === 'bad1' || ex.id === 'bad2' || ex.id === 'bad3'
      );
      
      badExercises.forEach(ex => {
        if (ex.primaryMuscle === 'chest' || ex.primaryMuscle === 'triceps') {
          expect(ex.score).toBe(8); // Base (5) + primary bonus (3)
        } else {
          expect(ex.score).toBe(5); // Base only
        }
      });
    });

    it('should handle extreme scoring scenarios without overflow', async () => {
      // Create a scenario that could cause score overflow if not handled properly
      const result = await filterExercisesFromInput({
        clientContext: {
          ...testContexts.default(),
          muscle_target: ['chest', 'triceps', 'shoulders', 'back', 'legs'],
          muscle_lessen: ['core', 'calves', 'forearms'],
          exercise_requests: {
            include: ['Barbell Bench Press', 'Squats', 'Deadlifts'],
            avoid: []
          }
        },
        intensity: 'high',
        workoutTemplate: createTestWorkoutTemplate(false)
      });
      
      // All scores should be reasonable
      result.filteredExercises.forEach(ex => {
        expect(ex.score).toBeGreaterThanOrEqual(0);
        expect(ex.score).toBeLessThanOrEqual(20); // Reasonable upper bound
        expect(Number.isFinite(ex.score)).toBe(true);
      });
      
      // Included exercises should still be highest
      const includedNames = ['Barbell Bench Press', 'Squats', 'Deadlifts'];
      const includedExercises = result.filteredExercises.filter(ex => 
        includedNames.includes(ex.name)
      );
      const maxNonIncludedScore = Math.max(
        ...result.filteredExercises
          .filter(ex => !includedNames.includes(ex.name))
          .map(ex => ex.score)
      );
      
      includedExercises.forEach(ex => {
        expect(ex.score).toBeGreaterThan(maxNonIncludedScore);
      });
    });
  });
});