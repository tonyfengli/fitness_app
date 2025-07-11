/**
 * Enhanced constraint tracking for workout template organization
 */

import type { ScoredExercise } from "../../../types/scoredExercise";
import type { MovementConstraints, MuscleConstraints } from "../types/blockConfig";
import { constraintTracker, debugLogger } from "../../../utils/enhancedDebug";
import { ConstraintTracker } from "../utils/ConstraintTracker";

export class EnhancedConstraintTracker extends ConstraintTracker {
  private blockId: string;
  private enableDebug: boolean;
  private movementConstraints?: MovementConstraints;
  private muscleConstraints?: MuscleConstraints;
  private selectedExercises: ScoredExercise[] = [];
  private satisfiedMovementPatterns = new Set<string>();
  private myUpperBodyCount = 0;
  private myLowerBodyCount = 0;

  constructor(blockId: string, enableDebug: boolean = false) {
    super();
    this.blockId = blockId;
    this.enableDebug = enableDebug;
    
    if (enableDebug) {
      // Initialize constraint analysis for this block
      const allConstraints = this.getAllRequiredConstraints();
      constraintTracker.initBlock(blockId, allConstraints);
    }
  }

  private getAllRequiredConstraints(): string[] {
    const constraints: string[] = [];
    
    // Movement constraints
    if (this.movementConstraints) {
      Object.entries(this.movementConstraints).forEach(([pattern, required]) => {
        if (required) {
          constraints.push(`movement:${pattern}`);
        }
      });
    }
    
    // Muscle constraints
    if (this.muscleConstraints) {
      if (this.muscleConstraints.minUpperBody > 0) {
        constraints.push(`muscle:upper_body_min_${this.muscleConstraints.minUpperBody}`);
      }
      if (this.muscleConstraints.minLowerBody > 0) {
        constraints.push(`muscle:lower_body_min_${this.muscleConstraints.minLowerBody}`);
      }
    }
    
    return constraints;
  }

  setMovementConstraints(constraints: MovementConstraints): void {
    this.movementConstraints = constraints;
    
    if (this.enableDebug) {
      debugLogger.log('constraint_check', `Movement constraints set for ${this.blockId}`, {
        constraints
      });
    }
  }

  setMuscleConstraints(constraints: MuscleConstraints): void {
    this.muscleConstraints = constraints;
    
    if (this.enableDebug) {
      debugLogger.log('constraint_check', `Muscle constraints set for ${this.blockId}`, {
        constraints
      });
    }
  }

  private getMovementPatternGroup(pattern: string): string | null {
    // Map movement patterns to groups
    if (['squat', 'hinge'].includes(pattern)) return 'squat_hinge';
    if (['push', 'press'].includes(pattern)) return 'push';
    if (['pull', 'row'].includes(pattern)) return 'pull';
    if (pattern === 'lunge') return 'lunge';
    return null;
  }

  private isUpperBodyExercise(exercise: ScoredExercise): boolean {
    const upperBodyMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'];
    return upperBodyMuscles.includes(exercise.primaryMuscle);
  }

  private isLowerBodyExercise(exercise: ScoredExercise): boolean {
    const lowerBodyMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
    return lowerBodyMuscles.includes(exercise.primaryMuscle);
  }

  private getUnsatisfiedConstraintDetails(): string[] {
    const unsatisfied: string[] = [];
    
    // Check movement constraints
    if (this.movementConstraints) {
      Object.entries(this.movementConstraints).forEach(([pattern, required]) => {
        if (required && !this.satisfiedMovementPatterns.has(pattern)) {
          unsatisfied.push(`movement:${pattern}`);
        }
      });
    }
    
    // Check muscle constraints
    if (this.muscleConstraints) {
      if (this.myUpperBodyCount < this.muscleConstraints.minUpperBody) {
        unsatisfied.push(`muscle:upper_body_min_${this.muscleConstraints.minUpperBody}`);
      }
      if (this.myLowerBodyCount < this.muscleConstraints.minLowerBody) {
        unsatisfied.push(`muscle:lower_body_min_${this.muscleConstraints.minLowerBody}`);
      }
    }
    
    return unsatisfied;
  }

  wouldHelpSatisfyConstraints(exercise: ScoredExercise): boolean {
    // Check if this exercise would help satisfy any unsatisfied constraints
    if (!this.movementConstraints && !this.muscleConstraints) {
      return false;
    }
    
    // Check movement patterns
    if (this.movementConstraints && exercise.movementPattern) {
      const patternGroup = this.getMovementPatternGroup(exercise.movementPattern);
      if (patternGroup && !this.satisfiedMovementPatterns.has(patternGroup)) {
        const constraintKey = `require${patternGroup.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')}` as keyof MovementConstraints;
        if (this.movementConstraints[constraintKey]) {
          return true;
        }
      }
    }
    
    // Check muscle groups
    if (this.muscleConstraints) {
      if (this.isUpperBodyExercise(exercise) && this.myUpperBodyCount < this.muscleConstraints.minUpperBody) {
        return true;
      }
      if (this.isLowerBodyExercise(exercise) && this.myLowerBodyCount < this.muscleConstraints.minLowerBody) {
        return true;
      }
    }
    
    return false;
  }

  wouldHelpSatisfyConstraintsWithDebug(exercise: ScoredExercise): boolean {
    const helps = this.wouldHelpSatisfyConstraints(exercise);
    
    if (this.enableDebug) {
      const unsatisfiedBefore = this.getUnsatisfiedConstraintDetails();
      
      // Determine which constraint this exercise would help with
      let constraintHelped = 'none';
      let reason = 'does_not_help_constraints';
      
      if (helps) {
        // Check movement patterns
        const movementPattern = exercise.movementPattern;
        if (movementPattern) {
          const patternGroup = this.getMovementPatternGroup(movementPattern);
          if (patternGroup && !this.satisfiedMovementPatterns.has(patternGroup)) {
            constraintHelped = `movement:${patternGroup}`;
            reason = `satisfies_${patternGroup}_requirement`;
          }
        }
        
        // Check muscle groups
        if (this.muscleConstraints) {
          const isUpperBody = this.isUpperBodyExercise(exercise);
          const isLowerBody = this.isLowerBodyExercise(exercise);
          
          if (isUpperBody && this.myUpperBodyCount < this.muscleConstraints.minUpperBody) {
            constraintHelped = `muscle:upper_body`;
            reason = `helps_meet_upper_body_minimum`;
          } else if (isLowerBody && this.myLowerBodyCount < this.muscleConstraints.minLowerBody) {
            constraintHelped = `muscle:lower_body`;
            reason = `helps_meet_lower_body_minimum`;
          }
        }
      }
      
      constraintTracker.recordAttempt(
        this.blockId,
        exercise.name,
        constraintHelped,
        helps,
        reason
      );
      
      debugLogger.log('constraint_check', `Constraint check for ${exercise.name}`, {
        blockId: this.blockId,
        helps,
        constraintHelped,
        reason,
        exerciseDetails: {
          movementPattern: exercise.movementPattern,
          primaryMuscle: exercise.primaryMuscle,
          functionTags: exercise.functionTags
        }
      });
    }
    
    return helps;
  }

  addExercise(exercise: ScoredExercise): void {
    const unsatisfiedBefore = this.getUnsatisfiedConstraintDetails();
    
    // Update tracking
    this.selectedExercises.push(exercise);
    
    // Update movement pattern tracking
    if (exercise.movementPattern) {
      const patternGroup = this.getMovementPatternGroup(exercise.movementPattern);
      if (patternGroup) {
        this.satisfiedMovementPatterns.add(patternGroup);
      }
    }
    
    // Update muscle group tracking
    if (this.isUpperBodyExercise(exercise)) {
      this.myUpperBodyCount++;
    } else if (this.isLowerBodyExercise(exercise)) {
      this.myLowerBodyCount++;
    }
    
    // Call parent updateFromExercise to update base tracking
    super.updateFromExercise(exercise);
    
    if (this.enableDebug) {
      const unsatisfiedAfter = this.getUnsatisfiedConstraintDetails();
      
      debugLogger.log('constraint_check', `Exercise added to ${this.blockId}`, {
        exercise: exercise.name,
        constraintsSatisfiedBefore: this.getAllRequiredConstraints().length - unsatisfiedBefore.length,
        constraintsSatisfiedAfter: this.getAllRequiredConstraints().length - unsatisfiedAfter.length,
        newlySatisfied: unsatisfiedBefore.filter(c => !unsatisfiedAfter.includes(c))
      });
    }
  }

  areAllConstraintsSatisfied(): boolean {
    // Check movement constraints
    if (this.movementConstraints) {
      for (const [pattern, required] of Object.entries(this.movementConstraints)) {
        if (required && !this.satisfiedMovementPatterns.has(pattern)) {
          return false;
        }
      }
    }
    
    // Check muscle constraints
    if (this.muscleConstraints) {
      if (this.myUpperBodyCount < this.muscleConstraints.minUpperBody) {
        return false;
      }
      if (this.myLowerBodyCount < this.muscleConstraints.minLowerBody) {
        return false;
      }
    }
    
    const satisfied = true;
    
    if (this.enableDebug && satisfied) {
      debugLogger.log('constraint_check', `All constraints satisfied for ${this.blockId}`, {
        exerciseCount: this.selectedExercises.length,
        movementPatterns: Array.from(this.satisfiedMovementPatterns),
        upperBodyCount: this.myUpperBodyCount,
        lowerBodyCount: this.myLowerBodyCount
      });
    }
    
    return satisfied;
  }

  getConstraintSatisfactionReport(): {
    blockId: string;
    satisfied: boolean;
    details: {
      movement: { required: string[]; satisfied: string[]; missing: string[] };
      muscle: { 
        upperBody: { required: number; actual: number };
        lowerBody: { required: number; actual: number };
      };
    };
    exercises: string[];
  } {
    const movementRequired = Object.entries(this.movementConstraints || {})
      .filter(([_, required]) => required)
      .map(([pattern]) => pattern);
    
    const movementSatisfied = Array.from(this.satisfiedMovementPatterns);
    const movementMissing = movementRequired.filter(p => !movementSatisfied.includes(p));
    
    return {
      blockId: this.blockId,
      satisfied: this.areAllConstraintsSatisfied(),
      details: {
        movement: {
          required: movementRequired,
          satisfied: movementSatisfied as string[],
          missing: movementMissing
        },
        muscle: {
          upperBody: {
            required: this.muscleConstraints?.minUpperBody || 0,
            actual: this.myUpperBodyCount
          },
          lowerBody: {
            required: this.muscleConstraints?.minLowerBody || 0,
            actual: this.myLowerBodyCount
          }
        }
      },
      exercises: this.selectedExercises.map(ex => ex.name)
    };
  }
}