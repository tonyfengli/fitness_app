import type { Exercise } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper to load and filter exercises from the exported database data
 * Provides intelligent selection of exercises for different test scenarios
 */
export class ExerciseDataHelper {
  private allExercises: Exercise[];
  
  constructor() {
    // Load all exercises from the exported JSON file
    // Try multiple possible paths since test runner might be in different directory
    const possiblePaths = [
      path.join(process.cwd(), '../../test-data/all-exercises.json'),
      path.join(process.cwd(), '../../../test-data/all-exercises.json'),
      path.join(process.cwd(), 'test-data/all-exercises.json'),
      path.join(__dirname, '../../../../test-data/all-exercises.json'),
      '/Users/tonyli/Desktop/fitness_app/test-data/all-exercises.json' // Absolute fallback
    ];
    
    let dataPath: string | null = null;
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        dataPath = tryPath;
        break;
      }
    }
    
    if (!dataPath) {
      throw new Error(`Exercise data not found. Tried paths: ${possiblePaths.join(', ')}. Run 'npm run export-exercises' first.`);
    }
    
    this.allExercises = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }
  
  /**
   * Get all exercises (use sparingly in tests to avoid performance issues)
   */
  getAllExercises(): Exercise[] {
    return [...this.allExercises];
  }
  
  /**
   * Get a diverse subset of exercises for basic testing
   * Ensures coverage across different attributes
   */
  getBasicTestSet(count = 30): Exercise[] {
    const selected: Exercise[] = [];
    const used = new Set<string>();
    
    // First, ensure we have at least one exercise from each function tag
    const functionTags = ['primary_strength', 'secondary_strength', 'accessory', 'capacity', 'core'];
    for (const tag of functionTags) {
      const exercise = this.allExercises.find(ex => 
        ex.functionTags?.includes(tag) && !used.has(ex.id)
      );
      if (exercise) {
        selected.push(exercise);
        used.add(exercise.id);
      }
    }
    
    // Then, ensure we have exercises from each strength level
    const strengthLevels = ['very_low', 'low', 'moderate', 'high'];
    for (const level of strengthLevels) {
      const exercise = this.allExercises.find(ex => 
        ex.strengthLevel === level && !used.has(ex.id)
      );
      if (exercise) {
        selected.push(exercise);
        used.add(exercise.id);
      }
    }
    
    // Add exercises to cover different movement patterns
    const patterns = ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'lunge'];
    for (const pattern of patterns) {
      const exercise = this.allExercises.find(ex => 
        ex.movementPattern === pattern && !used.has(ex.id)
      );
      if (exercise) {
        selected.push(exercise);
        used.add(exercise.id);
      }
    }
    
    // Fill remaining slots with random exercises
    const remaining = this.allExercises.filter(ex => !used.has(ex.id));
    while (selected.length < count && remaining.length > 0) {
      const index = Math.floor(Math.random() * remaining.length);
      const exercise = remaining[index];
      if (exercise) {
        selected.push(exercise);
        remaining.splice(index, 1);
      }
    }
    
    return selected;
  }
  
  /**
   * Get exercises filtered by specific criteria
   */
  getFiltered(criteria: {
    functionTags?: string[];
    strengthLevel?: string | string[];
    complexityLevel?: string | string[];
    primaryMuscle?: string | string[];
    movementPattern?: string | string[];
    exclude?: string[]; // Exercise IDs to exclude
  }): Exercise[] {
    return this.allExercises.filter(exercise => {
      // Check function tags
      if (criteria.functionTags && criteria.functionTags.length > 0) {
        const hasTag = criteria.functionTags.some(tag => 
          exercise.functionTags?.includes(tag)
        );
        if (!hasTag) return false;
      }
      
      // Check strength level
      if (criteria.strengthLevel) {
        const levels = Array.isArray(criteria.strengthLevel) 
          ? criteria.strengthLevel 
          : [criteria.strengthLevel];
        if (!levels.includes(exercise.strengthLevel)) return false;
      }
      
      // Check complexity level
      if (criteria.complexityLevel) {
        const levels = Array.isArray(criteria.complexityLevel) 
          ? criteria.complexityLevel 
          : [criteria.complexityLevel];
        if (!levels.includes(exercise.complexityLevel)) return false;
      }
      
      // Check primary muscle
      if (criteria.primaryMuscle) {
        const muscles = Array.isArray(criteria.primaryMuscle) 
          ? criteria.primaryMuscle 
          : [criteria.primaryMuscle];
        if (!muscles.includes(exercise.primaryMuscle)) return false;
      }
      
      // Check movement pattern
      if (criteria.movementPattern) {
        const patterns = Array.isArray(criteria.movementPattern) 
          ? criteria.movementPattern 
          : [criteria.movementPattern];
        if (!patterns.includes(exercise.movementPattern)) return false;
      }
      
      // Check exclusions
      if (criteria.exclude?.includes(exercise.id)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get exercises for edge case testing
   */
  getEdgeCaseSet(): {
    veryLowStrength: Exercise[];
    highComplexity: Exercise[];
    withJointLoads: Exercise[];
    noSecondaryMuscles: Exercise[];
    multiFunction: Exercise[];
  } {
    return {
      veryLowStrength: this.getFiltered({ strengthLevel: 'very_low' }),
      highComplexity: this.getFiltered({ complexityLevel: 'high' }),
      withJointLoads: this.allExercises.filter(ex => 
        ex.loadedJoints && ex.loadedJoints.length > 0
      ),
      noSecondaryMuscles: this.allExercises.filter(ex => 
        !ex.secondaryMuscles || ex.secondaryMuscles.length === 0
      ),
      multiFunction: this.allExercises.filter(ex => 
        ex.functionTags && ex.functionTags.length > 1
      )
    };
  }
  
  /**
   * Get exercises that avoid duplicate movement patterns while maintaining diversity
   * Useful for testing template constraints
   */
  getConstraintTestSet(): Exercise[] {
    const selected: Exercise[] = [];
    const usedPatterns = new Set<string>();
    const usedMuscles = new Set<string>();
    
    // Prioritize exercises with unique patterns and muscles
    const sorted = [...this.allExercises].sort((a, b) => {
      const aUnique = !usedPatterns.has(a.movementPattern) && !usedMuscles.has(a.primaryMuscle);
      const bUnique = !usedPatterns.has(b.movementPattern) && !usedMuscles.has(b.primaryMuscle);
      return aUnique === bUnique ? 0 : aUnique ? -1 : 1;
    });
    
    for (const exercise of sorted) {
      if (selected.length >= 40) break; // Enough for all blocks
      
      // Skip if we already have this pattern and muscle combo
      if (usedPatterns.has(exercise.movementPattern) && 
          usedMuscles.has(exercise.primaryMuscle)) {
        continue;
      }
      
      selected.push(exercise);
      usedPatterns.add(exercise.movementPattern);
      usedMuscles.add(exercise.primaryMuscle);
    }
    
    return selected;
  }
  
  /**
   * Get specific exercises by ID for targeted testing
   */
  getByIds(ids: string[]): Exercise[] {
    return this.allExercises.filter(ex => ids.includes(ex.id));
  }
  
  /**
   * Get exercises matching the current debug state
   * Useful for recreating exact scenarios from debug files
   */
  getDebugStateExercises(debugState: any): Exercise[] {
    const exerciseIds = new Set<string>();
    
    // Collect all exercise IDs from the debug state
    if (debugState.results) {
      ['blockA', 'blockB', 'blockC', 'blockD'].forEach(block => {
        if (debugState.results[block]?.exercises) {
          debugState.results[block].exercises.forEach((ex: any) => {
            exerciseIds.add(ex.id);
          });
        }
      });
    }
    
    return this.getByIds(Array.from(exerciseIds));
  }
}

// Singleton instance
let instance: ExerciseDataHelper | null = null;

export function getExerciseDataHelper(): ExerciseDataHelper {
  if (!instance) {
    instance = new ExerciseDataHelper();
  }
  return instance;
}