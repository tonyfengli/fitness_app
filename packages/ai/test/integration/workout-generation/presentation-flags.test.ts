import { describe, it, expect, beforeEach } from 'vitest';
import { filterExercisesFromInput } from '../../../src/api/filterExercisesFromInput';
import { setupMocks, testContexts, getExercisesByBlock } from './test-helpers';
import { createTestWorkoutTemplate } from '../../../src/types/testHelpers';
import type { ExerciseWithUIFlags } from '../../../src/formatting/exerciseFlags';

describe('Presentation Flags (UI Support)', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Flag Structure', () => {
    it('should add all required presentation flags to every exercise', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Every exercise should have UI flags
      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        // Check all required flags exist
        expect(ex).toHaveProperty('isSelected');
        expect(ex).toHaveProperty('isSelectedBlockA');
        expect(ex).toHaveProperty('isSelectedBlockB');
        expect(ex).toHaveProperty('isSelectedBlockC');
        expect(ex).toHaveProperty('isSelectedBlockD');
        expect(ex).toHaveProperty('blockBPenalty');
        expect(ex).toHaveProperty('blockCPenalty');
        expect(ex).toHaveProperty('selectedBlocks');
        expect(ex).toHaveProperty('blockPenalties');
        
        // Check flag types
        expect(typeof ex.isSelected).toBe('boolean');
        expect(typeof ex.isSelectedBlockA).toBe('boolean');
        expect(typeof ex.isSelectedBlockB).toBe('boolean');
        expect(typeof ex.isSelectedBlockC).toBe('boolean');
        expect(typeof ex.isSelectedBlockD).toBe('boolean');
        expect(typeof ex.blockBPenalty).toBe('number');
        expect(typeof ex.blockCPenalty).toBe('number');
        expect(Array.isArray(ex.selectedBlocks)).toBe(true);
        expect(typeof ex.blockPenalties).toBe('object');
      });
    });

    it('should set flags to false when no template organization is applied', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default()
        // No workoutTemplate provided
      });

      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        // All selection flags should be false
        expect(ex.isSelected).toBe(false);
        expect(ex.isSelectedBlockA).toBe(false);
        expect(ex.isSelectedBlockB).toBe(false);
        expect(ex.isSelectedBlockC).toBe(false);
        expect(ex.isSelectedBlockD).toBe(false);
        
        // Penalties should be 0
        expect(ex.blockBPenalty).toBe(0);
        expect(ex.blockCPenalty).toBe(0);
        
        // Arrays/objects should be empty
        expect(ex.selectedBlocks).toEqual([]);
        expect(ex.blockPenalties).toEqual({});
      });
    });
  });

  describe('Block Selection Flags', () => {
    it('should correctly flag exercises selected for each block', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Check Block A exercises
      blocks.blockA.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        expect(ex.isSelectedBlockA).toBe(true);
        expect(ex.isSelected).toBe(true);
      });
      
      // Check Block B exercises
      blocks.blockB.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        expect(ex.isSelectedBlockB).toBe(true);
        expect(ex.isSelected).toBe(true);
      });
      
      // Check Block C exercises
      blocks.blockC.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        expect(ex.isSelectedBlockC).toBe(true);
        expect(ex.isSelected).toBe(true);
      });
      
      // Check Block D exercises
      blocks.blockD.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        expect(ex.isSelectedBlockD).toBe(true);
        expect(ex.isSelected).toBe(true);
      });
    });

    it('should flag only relevant blocks for each exercise', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      // Find exercises in specific blocks
      const blockAExercises = new Set(result.filteredExercises
        .filter(ex => (ex as ExerciseWithUIFlags).isSelectedBlockA)
        .map(ex => ex.id));
      
      const blockBExercises = new Set(result.filteredExercises
        .filter(ex => (ex as ExerciseWithUIFlags).isSelectedBlockB)
        .map(ex => ex.id));

      // Verify exercises in Block A are not flagged for other blocks
      // (unless they appear in multiple blocks due to penalties)
      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        if (blockAExercises.has(ex.id) && !blockBExercises.has(ex.id)) {
          // If only in Block A, other flags should be false
          expect(ex.isSelectedBlockB).toBe(false);
          expect(ex.isSelectedBlockC).toBe(false);
          expect(ex.isSelectedBlockD).toBe(false);
        }
      });
    });
  });

  describe('Penalty Flags', () => {
    it('should set blockBPenalty for exercises selected in blockA', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        if (ex.isSelectedBlockA) {
          expect(ex.blockBPenalty).toBe(2.0);
        } else {
          expect(ex.blockBPenalty).toBe(0);
        }
      });
    });

    it('should set blockCPenalty for exercises selected in blockB', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        if (ex.isSelectedBlockB) {
          expect(ex.blockCPenalty).toBe(2.0);
        } else {
          expect(ex.blockCPenalty).toBe(0);
        }
      });
    });
  });

  describe('Unselected Exercises', () => {
    it('should have isSelected=false for exercises not in any block', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      const selectedIds = new Set([
        ...blocks.blockA.map(ex => ex.id),
        ...blocks.blockB.map(ex => ex.id),
        ...blocks.blockC.map(ex => ex.id),
        ...blocks.blockD.map(ex => ex.id)
      ]);

      // Find unselected exercises
      const unselectedExercises = result.filteredExercises.filter(
        ex => !selectedIds.has(ex.id)
      );

      // Verify they have proper flags
      unselectedExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        expect(ex.isSelected).toBe(false);
        expect(ex.isSelectedBlockA).toBe(false);
        expect(ex.isSelectedBlockB).toBe(false);
        expect(ex.isSelectedBlockC).toBe(false);
        expect(ex.isSelectedBlockD).toBe(false);
        expect(ex.blockBPenalty).toBe(0);
        expect(ex.blockCPenalty).toBe(0);
      });
    });

    it('should maintain flag consistency across all exercises', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(false)
      });

      result.filteredExercises.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        
        // isSelected should be true if and only if at least one block flag is true
        const shouldBeSelected = ex.isSelectedBlockA || ex.isSelectedBlockB || 
                               ex.isSelectedBlockC || ex.isSelectedBlockD;
        
        expect(ex.isSelected).toBe(shouldBeSelected);
      });
    });
  });

  describe('Full Body Template Flags', () => {
    it('should correctly flag exercises for full body template', async () => {
      const result = await filterExercisesFromInput({
        clientContext: testContexts.default(),
        workoutTemplate: createTestWorkoutTemplate(true) // Full body
      });

      const blocks = getExercisesByBlock(result.filteredExercises);
      
      // Verify blocks have exercises
      expect(blocks.blockA.length).toBeGreaterThan(0);
      expect(blocks.blockB.length).toBeGreaterThan(0);
      expect(blocks.blockC.length).toBeGreaterThan(0);
      
      // Verify flags are set correctly
      const allSelected = [
        ...blocks.blockA,
        ...blocks.blockB,
        ...blocks.blockC,
        ...blocks.blockD
      ];

      allSelected.forEach(exercise => {
        const ex = exercise as ExerciseWithUIFlags;
        expect(ex.isSelected).toBe(true);
      });
    });
  });
});