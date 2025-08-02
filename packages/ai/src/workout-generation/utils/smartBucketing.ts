import type { ScoredExercise } from '../../types/scoredExercise';
import type { Exercise } from '../../types/exercise';
import type { ClientContext } from '../../types/clientContext';
import { WorkoutType, BUCKET_CONFIGS, type BucketConstraints } from '../types/workoutTypes';
import { randomSelect } from '../../utils/exerciseSelection';

export class SmartBucketingService {
  private static bucketAssignments: Map<string, { 
    bucketType: 'movement_pattern' | 'functional' | 'flex'; 
    constraint: string;
    tiedCount?: number; // Number of exercises that were tied at the same score
  }> = new Map();

  /**
   * Smart bucket exercises based on workout type and constraints
   */
  static bucketExercises(
    exercises: ScoredExercise[],
    clientContext: ClientContext,
    workoutType: WorkoutType,
    preAssigned: Exercise[]
  ): ScoredExercise[] {
    // Clear previous assignments
    this.bucketAssignments.clear();
    const config = BUCKET_CONFIGS[workoutType];
    const selected: ScoredExercise[] = [];
    const usedExerciseIds = new Set<string>();
    
    // 1. Analyze what pre-assigned exercises already cover
    const coveredPatterns = this.analyzeCoverage(preAssigned);
    
    // 2. Fill movement pattern requirements
    selected.push(...this.fillMovementPatterns(
      exercises,
      config.movementPatterns,
      coveredPatterns,
      usedExerciseIds
    ));
    
    // 3. Fill functional requirements (capacity/strength)
    selected.push(...this.fillFunctionalRequirements(
      exercises,
      config.functionalRequirements,
      usedExerciseIds
    ));
    
    // 4. Fill flex slots with highest scoring remaining
    const remaining = config.flexSlots;
    const flexExercises = exercises
      .filter(ex => !usedExerciseIds.has(ex.id))
      .slice(0, remaining);
    
    flexExercises.forEach(ex => {
      selected.push(ex);
      usedExerciseIds.add(ex.id);
      this.bucketAssignments.set(ex.id, {
        bucketType: 'flex',
        constraint: 'highest_score'
      });
    });
    
    // 5. Ensure we don't exceed total limit
    return selected.slice(0, config.totalExercises);
  }
  
  /**
   * Analyze what movement patterns are already covered by pre-assigned exercises
   */
  private static analyzeCoverage(preAssigned: Exercise[]): Map<string, number> {
    const coverage = new Map<string, number>();
    
    preAssigned.forEach(exercise => {
      if (exercise.movementPattern) {
        const count = coverage.get(exercise.movementPattern) || 0;
        coverage.set(exercise.movementPattern, count + 1);
      }
    });
    
    return coverage;
  }
  
  /**
   * Fill movement pattern buckets based on constraints
   */
  private static fillMovementPatterns(
    exercises: ScoredExercise[],
    patternConstraints: Record<string, { min: number; max: number }>,
    coveredPatterns: Map<string, number>,
    usedIds: Set<string>
  ): ScoredExercise[] {
    const selected: ScoredExercise[] = [];
    
    // Group exercises by movement pattern
    const byPattern = new Map<string, ScoredExercise[]>();
    exercises.forEach(ex => {
      if (ex.movementPattern && !usedIds.has(ex.id)) {
        const pattern = ex.movementPattern;
        if (!byPattern.has(pattern)) {
          byPattern.set(pattern, []);
        }
        byPattern.get(pattern)!.push(ex);
      }
    });
    
    // Fill each pattern bucket
    for (const [pattern, constraints] of Object.entries(patternConstraints)) {
      const alreadyCovered = coveredPatterns.get(pattern) || 0;
      const needed = Math.max(0, constraints.min - alreadyCovered);
      const maxToAdd = Math.max(0, constraints.max - alreadyCovered);
      
      if (needed > 0 && maxToAdd > 0) {
        const patternExercises = byPattern.get(pattern) || [];
        
        // Select exercises with randomization for ties
        const selectedForPattern = this.selectWithTieBreaking(
          patternExercises, 
          Math.min(needed, maxToAdd)
        );
        
        selectedForPattern.forEach(({ exercise, tiedCount }) => {
          selected.push(exercise);
          usedIds.add(exercise.id);
          this.bucketAssignments.set(exercise.id, {
            bucketType: 'movement_pattern',
            constraint: pattern,
            tiedCount
          });
        });
      }
    }
    
    return selected;
  }
  
  /**
   * Fill functional requirements (capacity/strength exercises)
   */
  private static fillFunctionalRequirements(
    exercises: ScoredExercise[],
    functionalRequirements: Record<string, number>,
    usedIds: Set<string>
  ): ScoredExercise[] {
    const selected: ScoredExercise[] = [];
    
    for (const [functionTag, count] of Object.entries(functionalRequirements)) {
      const functionalExercises = exercises
        .filter(ex => 
          !usedIds.has(ex.id) && 
          ex.functionTags?.includes(functionTag)
        )
        .slice(0, count);
      
      functionalExercises.forEach(ex => {
        selected.push(ex);
        usedIds.add(ex.id);
        this.bucketAssignments.set(ex.id, {
          bucketType: 'functional',
          constraint: functionTag
        });
      });
    }
    
    return selected;
  }
  
  /**
   * Get a descriptive summary of what was bucketed
   */
  static getBucketingSummary(
    selected: ScoredExercise[],
    config: BucketConstraints
  ): string {
    const patternCounts = new Map<string, number>();
    const functionCounts = new Map<string, number>();
    
    selected.forEach(ex => {
      if (ex.movementPattern) {
        patternCounts.set(ex.movementPattern, (patternCounts.get(ex.movementPattern) || 0) + 1);
      }
      ex.functionTags?.forEach(tag => {
        functionCounts.set(tag, (functionCounts.get(tag) || 0) + 1);
      });
    });
    
    let summary = `Selected ${selected.length}/${config.totalExercises} exercises:\n`;
    summary += 'Movement Patterns: ';
    summary += Array.from(patternCounts.entries())
      .map(([pattern, count]) => `${pattern}(${count})`)
      .join(', ');
    summary += '\nFunctional Tags: ';
    summary += Array.from(functionCounts.entries())
      .map(([tag, count]) => `${tag}(${count})`)
      .join(', ');
    
    return summary;
  }

  /**
   * Select exercises with randomization for ties
   */
  private static selectWithTieBreaking(
    exercises: ScoredExercise[], 
    count: number
  ): Array<{ exercise: ScoredExercise; tiedCount?: number }> {
    if (exercises.length === 0 || count <= 0) return [];
    if (exercises.length <= count) {
      return exercises.map(ex => ({ exercise: ex }));
    }

    const selected: Array<{ exercise: ScoredExercise; tiedCount?: number }> = [];
    const used = new Set<string>();

    while (selected.length < count && exercises.length > used.size) {
      // Find the highest score among unused exercises
      let highestScore = -Infinity;
      for (const ex of exercises) {
        if (!used.has(ex.id) && ex.score > highestScore) {
          highestScore = ex.score;
        }
      }

      // Get all exercises with the highest score
      const tied = exercises.filter(ex => 
        !used.has(ex.id) && ex.score === highestScore
      );

      if (tied.length === 0) break;

      // If we need more exercises than tied, take all tied
      const remaining = count - selected.length;
      if (tied.length <= remaining) {
        tied.forEach(ex => {
          selected.push({ 
            exercise: ex, 
            tiedCount: tied.length > 1 ? tied.length : undefined 
          });
          used.add(ex.id);
        });
      } else {
        // Randomly select from tied exercises
        for (let i = 0; i < remaining; i++) {
          const randomEx = randomSelect(tied.filter(ex => !used.has(ex.id)));
          if (randomEx) {
            selected.push({ 
              exercise: randomEx, 
              tiedCount: tied.length 
            });
            used.add(randomEx.id);
          }
        }
      }
    }

    return selected;
  }

  /**
   * Get bucket assignments for the last bucketing operation
   */
  static getBucketAssignments(): Record<string, { bucketType: 'movement_pattern' | 'functional' | 'flex'; constraint: string; tiedCount?: number }> {
    const assignments: Record<string, { bucketType: 'movement_pattern' | 'functional' | 'flex'; constraint: string; tiedCount?: number }> = {};
    this.bucketAssignments.forEach((value, key) => {
      assignments[key] = value;
    });
    return assignments;
  }
}