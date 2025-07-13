import { describe, it, expect } from 'vitest';
import { determineTotalSetCount } from '../../../src/workout-generation/setCountLogic';

describe('Phase 3: Set Count Determination', () => {
  describe('Strength x Intensity Matrix Combinations', () => {
    describe('Very Low Strength', () => {
      it('should return [14, 16] sets for very_low strength + low intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'very_low',
          intensity: 'low'
        });
        
        expect(result.minSets).toBe(14);
        expect(result.maxSets).toBe(16);
        expect(result.reasoning).toContain('Lower strength capacity');
        expect(result.reasoning).toContain('Lower intensity');
      });

      it('should return [16, 18] sets for very_low strength + moderate intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'very_low',
          intensity: 'moderate'
        });
        
        expect(result.minSets).toBe(16);
        expect(result.maxSets).toBe(18);
        expect(result.reasoning).toContain('Lower strength capacity');
      });

      it('should return [18, 20] sets for very_low strength + high intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'very_low',
          intensity: 'high'
        });
        
        expect(result.minSets).toBe(18);
        expect(result.maxSets).toBe(20);
        expect(result.reasoning).toContain('Lower strength capacity');
        expect(result.reasoning).toContain('Higher intensity');
      });
    });

    describe('Low Strength', () => {
      it('should return [16, 18] sets for low strength + low intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'low',
          intensity: 'low'
        });
        
        expect(result.minSets).toBe(16);
        expect(result.maxSets).toBe(18);
      });

      it('should return [18, 20] sets for low strength + moderate intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'low',
          intensity: 'moderate'
        });
        
        expect(result.minSets).toBe(18);
        expect(result.maxSets).toBe(20);
      });

      it('should return [20, 22] sets for low strength + high intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'low',
          intensity: 'high'
        });
        
        expect(result.minSets).toBe(20);
        expect(result.maxSets).toBe(22);
      });
    });

    describe('Moderate Strength (Default)', () => {
      it('should return [17, 19] sets for moderate strength + low intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'moderate',
          intensity: 'low'
        });
        
        expect(result.minSets).toBe(17);
        expect(result.maxSets).toBe(19);
      });

      it('should return [19, 22] sets for moderate strength + moderate intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'moderate',
          intensity: 'moderate'
        });
        
        expect(result.minSets).toBe(19);
        expect(result.maxSets).toBe(22);
      });

      it('should return [22, 25] sets for moderate strength + high intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'moderate',
          intensity: 'high'
        });
        
        expect(result.minSets).toBe(22);
        expect(result.maxSets).toBe(25);
      });
    });

    describe('High Strength', () => {
      it('should return [18, 20] sets for high strength + low intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'high',
          intensity: 'low'
        });
        
        expect(result.minSets).toBe(18);
        expect(result.maxSets).toBe(20);
        expect(result.reasoning).toContain('Higher strength capacity');
        expect(result.reasoning).toContain('Lower intensity');
      });

      it('should return [22, 25] sets for high strength + moderate intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'high',
          intensity: 'moderate'
        });
        
        expect(result.minSets).toBe(22);
        expect(result.maxSets).toBe(25);
        expect(result.reasoning).toContain('Higher strength capacity');
      });

      it('should return [25, 27] sets for high strength + high intensity', () => {
        const result = determineTotalSetCount({
          strengthLevel: 'high',
          intensity: 'high'
        });
        
        expect(result.minSets).toBe(25);
        expect(result.maxSets).toBe(27);
        expect(result.reasoning).toContain('Higher strength capacity');
        expect(result.reasoning).toContain('Higher intensity');
      });
    });
  });

  describe('Default Behavior', () => {
    it('should default to moderate strength when strength level is undefined', () => {
      const result = determineTotalSetCount({
        intensity: 'high'
      });
      
      // Should use moderate strength + high intensity = [22, 25]
      expect(result.minSets).toBe(22);
      expect(result.maxSets).toBe(25);
    });

    it('should default to moderate intensity when intensity is undefined', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'low'
      });
      
      // Should use low strength + moderate intensity = [18, 20]
      expect(result.minSets).toBe(18);
      expect(result.maxSets).toBe(20);
    });

    it('should default to moderate/moderate when both are undefined', () => {
      const result = determineTotalSetCount({});
      
      // Should use moderate strength + moderate intensity = [19, 22]
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
      expect(result.reasoning).toContain('19-22 sets');
    });

    it('should handle empty factors object', () => {
      const result = determineTotalSetCount({});
      
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('Edge Cases and Invalid Inputs', () => {
    it('should fallback to defaults for invalid strength level', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'invalid_strength' as any,
        intensity: 'low'
      });
      
      // Invalid strength falls back to 'moderate', keeps valid intensity 'low'
      // So moderate + low = [17, 19], but the fallback is to [19, 22]
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
    });

    it('should fallback to defaults for invalid intensity', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'high',
        intensity: 'invalid_intensity' as any
      });
      
      // Invalid intensity causes full fallback to moderate/moderate = [19, 22]
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
    });

    it('should handle null values', () => {
      const result = determineTotalSetCount({
        strengthLevel: null as any,
        intensity: null as any
      });
      
      // Should use defaults: moderate/moderate = [19, 22]
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
    });

    it('should handle mixed case strength levels', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'VERY_LOW' as any,
        intensity: 'low'
      });
      
      // Should NOT match (case sensitive) and fallback to moderate/moderate
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
    });

    it('should handle numeric values as invalid', () => {
      const result = determineTotalSetCount({
        strengthLevel: 3 as any,
        intensity: 1 as any
      });
      
      // Should fallback to defaults
      expect(result.minSets).toBe(19);
      expect(result.maxSets).toBe(22);
    });
  });

  describe('Reasoning Generation', () => {
    it('should generate appropriate reasoning for low capacity users', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'very_low',
        intensity: 'low'
      });
      
      expect(result.reasoning).toContain('Lower strength capacity requires conservative volume');
      expect(result.reasoning).toContain('Lower intensity with controlled volume');
      expect(result.reasoning).toContain('14-16 sets for optimal training stimulus');
    });

    it('should generate appropriate reasoning for high capacity users', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'high',
        intensity: 'high'
      });
      
      expect(result.reasoning).toContain('Higher strength capacity allows for increased training volume');
      expect(result.reasoning).toContain('Higher intensity increases total work capacity');
      expect(result.reasoning).toContain('25-27 sets for optimal training stimulus');
    });

    it('should generate minimal reasoning for moderate users', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'moderate',
        intensity: 'moderate'
      });
      
      // Should only have the total sets part
      expect(result.reasoning).toBe('Total: 19-22 sets for optimal training stimulus');
      expect(result.reasoning).not.toContain('Lower');
      expect(result.reasoning).not.toContain('Higher');
    });

    it('should include both strength and intensity reasoning when applicable', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'low',
        intensity: 'high'
      });
      
      expect(result.reasoning).toContain('Lower strength capacity');
      expect(result.reasoning).toContain('Higher intensity');
      expect(result.reasoning.split('. ').length).toBe(3); // Three parts
    });
  });

  describe('Boundary Testing', () => {
    it('should have minimum sets of 14 (lowest possible)', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'very_low',
        intensity: 'low'
      });
      
      expect(result.minSets).toBe(14);
      expect(result.minSets).toBeGreaterThanOrEqual(14);
    });

    it('should have maximum sets of 27 (highest possible)', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'high',
        intensity: 'high'
      });
      
      expect(result.maxSets).toBe(27);
      expect(result.maxSets).toBeLessThanOrEqual(27);
    });

    it('should always have maxSets greater than minSets', () => {
      const strengthLevels = ['very_low', 'low', 'moderate', 'high'];
      const intensities = ['low', 'moderate', 'high'] as const;
      
      strengthLevels.forEach(strength => {
        intensities.forEach(intensity => {
          const result = determineTotalSetCount({
            strengthLevel: strength,
            intensity
          });
          
          expect(result.maxSets).toBeGreaterThan(result.minSets);
          expect(result.maxSets - result.minSets).toBeGreaterThanOrEqual(2);
          expect(result.maxSets - result.minSets).toBeLessThanOrEqual(3);
        });
      });
    });
  });

  describe('Return Value Structure', () => {
    it('should always return an object with minSets, maxSets, and reasoning', () => {
      const result = determineTotalSetCount({
        strengthLevel: 'moderate',
        intensity: 'moderate'
      });
      
      expect(result).toHaveProperty('minSets');
      expect(result).toHaveProperty('maxSets');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.minSets).toBe('number');
      expect(typeof result.maxSets).toBe('number');
      expect(typeof result.reasoning).toBe('string');
    });

    it('should return valid numbers even with invalid inputs', () => {
      const result = determineTotalSetCount({
        strengthLevel: undefined,
        intensity: undefined
      });
      
      expect(Number.isInteger(result.minSets)).toBe(true);
      expect(Number.isInteger(result.maxSets)).toBe(true);
      expect(result.minSets).toBeGreaterThan(0);
      expect(result.maxSets).toBeGreaterThan(0);
    });
  });
});