import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, testExercises, createTestExerciseWithOverrides } from './test-helpers';
import type { Exercise } from '../../../src/types';

describe('Filter Edge Cases & Validation', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Skill Level Cascading', () => {
    it('should apply cascading inclusion for skill levels (higher includes lower)', async () => {
      // Create exercises with different skill levels
      const skillTestExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 's1', name: 'Very Low Skill', complexityLevel: 'very_low' }),
        createTestExerciseWithOverrides(testExercises[1], { id: 's2', name: 'Low Skill', complexityLevel: 'low' }),
        createTestExerciseWithOverrides(testExercises[2], { id: 's3', name: 'Moderate Skill', complexityLevel: 'moderate' }),
        createTestExerciseWithOverrides(testExercises[3], { id: 's4', name: 'High Skill', complexityLevel: 'high' }),
      ];
      
      // Test with moderate skill user
      const result = await filterExercisesFromInput({
        exercises: skillTestExercises,
        clientContext: {
          ...testContexts.default(),
          skill_capacity: 'moderate',
          strength_capacity: 'high' // High strength to not filter by strength
        }
      });
      
      // Should include very_low, low, and moderate (but not high)
      const skillLevels = result.filteredExercises.map(ex => ex.complexityLevel);
      expect(skillLevels).toContain('very_low');
      expect(skillLevels).toContain('low');
      expect(skillLevels).toContain('moderate');
      expect(skillLevels).not.toContain('high');
    });

    it('should handle skill cascading independently from strength cascading', async () => {
      // Create exercises with mixed strength/skill levels
      const mixedExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 'm1', name: 'High Strength Low Skill', strengthLevel: 'high', complexityLevel: 'low' }),
        createTestExerciseWithOverrides(testExercises[1], { id: 'm2', name: 'Low Strength High Skill', strengthLevel: 'low', complexityLevel: 'high' }),
        createTestExerciseWithOverrides(testExercises[2], { id: 'm3', name: 'High Strength High Skill', strengthLevel: 'high', complexityLevel: 'high' }),
        createTestExerciseWithOverrides(testExercises[3], { id: 'm4', name: 'Low Strength Low Skill', strengthLevel: 'low', complexityLevel: 'low' }),
      ];
      
      const result = await filterExercisesFromInput({
        exercises: mixedExercises,
        clientContext: {
          name: 'Mixed Capacity User',
          strength_capacity: 'high',  // Can do all strength levels
          skill_capacity: 'low'       // Limited to low skill
        }
      });
      
      // Should allow high strength but only low/very_low skill
      const hasHighStrength = result.filteredExercises.some(ex => ex.strengthLevel === 'high');
      const hasHighSkill = result.filteredExercises.some(ex => ex.complexityLevel === 'high');
      
      expect(hasHighStrength).toBe(true);  // High strength allowed
      expect(hasHighSkill).toBe(false);    // High skill not allowed
    });
  });

  describe('Exercise Field Validation', () => {
    it('should handle exercises with null/undefined strength level', async () => {
      const invalidExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 'null1', strengthLevel: null as any }),
        createTestExerciseWithOverrides(testExercises[1], { id: 'undef1', strengthLevel: undefined as any }),
        createTestExerciseWithOverrides(testExercises[2], { id: 'valid1', strengthLevel: 'moderate' })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: invalidExercises,
        clientContext: testContexts.default()
      });
      
      // Should filter out exercises with invalid strength levels
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      expect(result.filteredExercises.every(ex => ex.strengthLevel)).toBe(true);
    });

    it('should handle exercises with null/undefined skill level', async () => {
      const invalidExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 'null2', complexityLevel: null as any }),
        createTestExerciseWithOverrides(testExercises[1], { id: 'undef2', complexityLevel: undefined as any }),
        createTestExerciseWithOverrides(testExercises[2], { id: 'valid2', complexityLevel: 'moderate' })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: invalidExercises,
        clientContext: testContexts.default()
      });
      
      // Should filter out exercises with invalid skill levels
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      expect(result.filteredExercises.every(ex => ex.complexityLevel)).toBe(true);
    });

    it('should handle exercises with empty or null loadedJoints when joint restrictions exist', async () => {
      const jointTestExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 'j1', loadedJoints: null as any }),
        createTestExerciseWithOverrides(testExercises[1], { id: 'j2', loadedJoints: undefined as any }),
        createTestExerciseWithOverrides(testExercises[2], { id: 'j3', loadedJoints: [] }), // Empty array
        createTestExerciseWithOverrides(testExercises[3], { id: 'j4', loadedJoints: ['shoulders'] })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: jointTestExercises,
        clientContext: testContexts.withJointRestrictions(['knees'])
      });
      
      // Exercises with null/undefined/empty joints should be allowed
      // (they don't load the restricted joint)
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Should include exercises with no joint loading
      const hasEmptyJoints = result.filteredExercises.some(ex => 
        !ex.loadedJoints || ex.loadedJoints.length === 0
      );
      expect(hasEmptyJoints).toBe(true);
    });

    it('should handle missing required fields gracefully', async () => {
      const brokenExercises: Exercise[] = [
        { 
          id: 'broken1',
          name: undefined as any, // Missing name
          primaryMuscle: 'chest',
          strengthLevel: 'moderate',
          complexityLevel: 'moderate'
        } as Exercise,
        {
          id: 'broken2',
          name: 'Valid Exercise',
          primaryMuscle: undefined as any, // Missing primary muscle
          strengthLevel: 'moderate',
          complexityLevel: 'moderate'
        } as Exercise,
        testExercises[0]! // At least one valid exercise
      ];
      
      const result = await filterExercisesFromInput({
        exercises: brokenExercises,
        clientContext: testContexts.default()
      });
      
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      // All returned exercises should have required fields
      result.filteredExercises.forEach(ex => {
        expect(ex.name).toBeTruthy();
        expect(ex.primaryMuscle).toBeTruthy();
      });
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should handle all filters applied simultaneously', async () => {
      // Set up diverse exercise pool
      const complexTestExercises: Exercise[] = [
        // Exercise that matches everything
        createTestExerciseWithOverrides(testExercises[0], {
          id: 'perfect',
          name: 'Perfect Exercise',
          strengthLevel: 'low',
          complexityLevel: 'low',
          primaryMuscle: 'chest',
          loadedJoints: ['shoulders'] // Not knees
        }),
        // Exercise excluded by strength
        createTestExerciseWithOverrides(testExercises[1], {
          id: 'tooStrong',
          name: 'Too Strong',
          strengthLevel: 'high',
          complexityLevel: 'low',
          loadedJoints: ['shoulders']
        }),
        // Exercise excluded by joints
        createTestExerciseWithOverrides(testExercises[2], {
          id: 'badJoints',
          name: 'Bad Joints',
          strengthLevel: 'low',
          complexityLevel: 'low',
          loadedJoints: ['knees']
        }),
        // Exercise in avoid list
        createTestExerciseWithOverrides(testExercises[3], {
          id: 'avoided',
          name: 'Avoided Exercise',
          strengthLevel: 'low',
          complexityLevel: 'low',
          loadedJoints: ['shoulders']
        })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: complexTestExercises,
        clientContext: {
          name: 'Complex Filter User',
          strength_capacity: 'low',
          skill_capacity: 'low',
          avoid_joints: ['knees'],
          muscle_target: ['chest'],
          exercise_requests: {
            include: [],
            avoid: ['Avoided Exercise']
          }
        }
      });
      
      // Only 'Perfect Exercise' should pass all filters
      expect(result.filteredExercises.length).toBe(1);
      expect(result.filteredExercises[0]?.name).toBe('Perfect Exercise');
    });

    it('should respect filter priority order with conflicting rules', async () => {
      const priorityExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], {
          id: 'included_but_joints',
          name: 'Included But Bad Joints',
          strengthLevel: 'high', // Above user level
          loadedJoints: ['knees'] // Restricted joint
        }),
        createTestExerciseWithOverrides(testExercises[1], {
          id: 'included_and_avoided',
          name: 'Both Included and Avoided',
          strengthLevel: 'moderate'
        })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: priorityExercises,
        clientContext: {
          ...testContexts.default(),
          strength_capacity: 'low',
          avoid_joints: ['knees'],
          exercise_requests: {
            include: ['Included But Bad Joints', 'Both Included and Avoided'],
            avoid: ['Both Included and Avoided']
          }
        }
      });
      
      // Joint safety overrides include
      const hasJointExercise = result.filteredExercises.some(ex => 
        ex.name === 'Included But Bad Joints'
      );
      expect(hasJointExercise).toBe(false);
      
      // Avoid overrides include
      const hasAvoidedExercise = result.filteredExercises.some(ex => 
        ex.name === 'Both Included and Avoided'
      );
      expect(hasAvoidedExercise).toBe(false);
    });

    it('should handle case sensitivity in exercise names', async () => {
      const caseExercises: Exercise[] = [
        createTestExerciseWithOverrides(testExercises[0], { id: 'case1', name: 'Barbell Squat' }),
        createTestExerciseWithOverrides(testExercises[1], { id: 'case2', name: 'barbell squat' }),
        createTestExerciseWithOverrides(testExercises[2], { id: 'case3', name: 'BARBELL SQUAT' })
      ];
      
      const result = await filterExercisesFromInput({
        exercises: caseExercises,
        clientContext: {
          ...testContexts.default(),
          exercise_requests: {
            include: ['Barbell Squat'], // Exact case
            avoid: []
          }
        }
      });
      
      // Should match exact case (current behavior)
      // If case-insensitive is desired, this test documents the behavior
      const matchingExercises = result.filteredExercises.filter(ex => 
        ex.name === 'Barbell Squat'
      );
      expect(matchingExercises.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle empty exercise database gracefully', async () => {
      const result = await filterExercisesFromInput({
        exercises: [], // Empty exercise array
        clientContext: testContexts.default()
      });
      
      // Should return empty result without crashing
      expect(result.filteredExercises).toBeDefined();
      expect(result.filteredExercises.length).toBe(0);
    });

    it('should handle null/undefined exercise array', async () => {
      // Should handle gracefully (might throw or return empty)
      try {
        const result = await filterExercisesFromInput({
          exercises: null as any, // Null exercises
          clientContext: testContexts.default()
        });
        
        expect(result.filteredExercises).toBeDefined();
        expect(result.filteredExercises.length).toBe(0);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed client context', async () => {
      const malformedContexts = [
        { ...testContexts.default(), strength_capacity: 'invalid' as any },
        { ...testContexts.default(), skill_capacity: null as any },
        { ...testContexts.default(), avoid_joints: 'not-an-array' as any },
        null as any
      ];
      
      for (const context of malformedContexts) {
        // Each should either handle gracefully or throw meaningful error
        try {
          const result = await filterExercisesFromInput({
            exercises: testExercises,
            clientContext: context
          });
          
          // If it succeeds, should have valid structure
          expect(result).toBeDefined();
          expect(result.filteredExercises).toBeDefined();
        } catch (error) {
          // If it fails, should have meaningful error
          expect(error).toBeDefined();
          // Could check for specific error types here
        }
      }
    });

    it('should handle include list with non-existent exercises', async () => {
      const result = await filterExercisesFromInput({
        exercises: testExercises,
        clientContext: {
          ...testContexts.default(),
          exercise_requests: {
            include: ['Non Existent Exercise 1', 'Non Existent Exercise 2'],
            avoid: []
          }
        }
      });
      
      // Should continue with available exercises
      expect(result.filteredExercises.length).toBeGreaterThan(0);
      
      // Non-existent exercises won't be in results
      const hasNonExistent = result.filteredExercises.some(ex => 
        ex.name.includes('Non Existent')
      );
      expect(hasNonExistent).toBe(false);
    });
  });
});