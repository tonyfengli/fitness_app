import { describe, it, expect } from 'vitest';
import { 
  WORKOUT_TEMPLATES, 
  getWorkoutTemplate, 
  getWorkoutStructure,
  type WorkoutTemplateType 
} from '../../src/workout-generation/templates/workoutTemplates';

describe('Workout Templates', () => {
  it('should have all three template types defined', () => {
    expect(WORKOUT_TEMPLATES.standard).toBeDefined();
    expect(WORKOUT_TEMPLATES.circuit).toBeDefined();
    expect(WORKOUT_TEMPLATES.full_body).toBeDefined();
  });

  describe('getWorkoutTemplate', () => {
    it('should return correct template for standard workout', () => {
      const template = getWorkoutTemplate('standard');
      expect(template.id).toBe('standard');
      expect(template.name).toBe('Standard Workout');
      expect(template.sections).toHaveLength(4);
      const firstSection = template.sections[0];
      expect(firstSection).toBeDefined();
      expect(firstSection?.name).toBe('Block A');
      expect(template.totalExerciseLimit).toBe(8);
    });

    it('should return correct template for circuit workout', () => {
      const template = getWorkoutTemplate('circuit');
      expect(template.id).toBe('circuit');
      expect(template.name).toBe('Circuit Training');
      expect(template.sections).toHaveLength(3);
      const firstSection = template.sections[0];
      expect(firstSection).toBeDefined();
      expect(firstSection?.name).toBe('Round 1');
      expect(template.totalExerciseLimit).toBe(6);
    });

    it('should return correct template for full body workout', () => {
      const template = getWorkoutTemplate('full_body');
      expect(template.id).toBe('full_body');
      expect(template.name).toBe('Full Body Workout');
      expect(template.sections).toHaveLength(4);
      expect(template.totalExerciseLimit).toBe(8);
    });

    it('should throw error for unknown template type', () => {
      expect(() => getWorkoutTemplate('unknown' as WorkoutTemplateType)).toThrow(
        'Unknown workout template type: unknown'
      );
    });
  });

  describe('getWorkoutStructure', () => {
    it('should return WorkoutStructure without extra fields', () => {
      const structure = getWorkoutStructure('standard');
      expect(structure).toHaveProperty('sections');
      expect(structure).toHaveProperty('totalExerciseLimit');
      expect(structure).not.toHaveProperty('id');
      expect(structure).not.toHaveProperty('name');
      expect(structure).not.toHaveProperty('description');
    });

    it('should preserve section structure', () => {
      const structure = getWorkoutStructure('circuit');
      expect(structure.sections).toHaveLength(3);
      const firstSection = structure.sections[0];
      expect(firstSection).toBeDefined();
      expect(firstSection).toHaveProperty('name');
      expect(firstSection).toHaveProperty('exerciseCount');
      expect(firstSection).toHaveProperty('setGuidance');
    });
  });

  describe('Template Structure Validation', () => {
    it('should have valid exercise counts for standard template', () => {
      const template = WORKOUT_TEMPLATES.standard;
      let totalMin = 0;
      let totalMax = 0;
      
      template.sections.forEach(section => {
        expect(section.exerciseCount.min).toBeLessThanOrEqual(section.exerciseCount.max);
        totalMin += section.exerciseCount.min;
        totalMax += section.exerciseCount.max;
      });
      
      expect(template.totalExerciseLimit).toBeDefined();
      expect(totalMin).toBeLessThanOrEqual(template.totalExerciseLimit || 0);
      expect(totalMax).toBeGreaterThanOrEqual(totalMin);
    });

    it('should have same exercise count for all circuit rounds', () => {
      const template = WORKOUT_TEMPLATES.circuit;
      const firstSection = template.sections[0];
      expect(firstSection).toBeDefined();
      const firstRoundMin = firstSection!.exerciseCount.min;
      const firstRoundMax = firstSection!.exerciseCount.max;
      
      template.sections.forEach(section => {
        expect(section.exerciseCount.min).toBe(firstRoundMin);
        expect(section.exerciseCount.max).toBe(firstRoundMax);
      });
    });
  });
});