import type { ScoredExercise } from "../../types/scoredExercise";
import type { BlockConstraints } from "../types/blockConfig";
import { MOVEMENT_PATTERNS, MUSCLE_GROUPS } from "../types/blockConfig";

export class ConstraintTracker {
  // Movement tracking
  private hasSquatHinge = false;
  private hasPush = false;
  private hasPull = false;
  private hasLunge = false;
  
  // Muscle group tracking
  private lowerBodyCount = 0;
  private upperBodyCount = 0;
  
  // Function tag tracking
  private coreCount = 0;
  private capacityCount = 0;
  
  // Track what constraints were satisfied by each exercise
  private exerciseConstraints = new Map<string, string[]>();

  updateFromExercise(exercise: ScoredExercise): string[] {
    const satisfiedConstraints: string[] = [];
    
    // Check movement patterns
    if (exercise.movementPattern) {
      if (MOVEMENT_PATTERNS.SQUAT_HINGE.includes(exercise.movementPattern as any)) {
        if (!this.hasSquatHinge) {
          this.hasSquatHinge = true;
          satisfiedConstraints.push('squat/hinge');
        }
      }
      if (MOVEMENT_PATTERNS.PUSH.includes(exercise.movementPattern as any)) {
        if (!this.hasPush) {
          this.hasPush = true;
          satisfiedConstraints.push('push');
        }
      }
      if (MOVEMENT_PATTERNS.PULL.includes(exercise.movementPattern as any)) {
        if (!this.hasPull) {
          this.hasPull = true;
          satisfiedConstraints.push('pull');
        }
      }
      if (exercise.movementPattern === 'lunge') {
        if (!this.hasLunge) {
          this.hasLunge = true;
          satisfiedConstraints.push('lunge');
        }
      }
    }
    
    // Check muscle groups
    if (MUSCLE_GROUPS.LOWER_BODY.includes(exercise.primaryMuscle as any)) {
      this.lowerBodyCount++;
      if (this.lowerBodyCount <= 2) {
        satisfiedConstraints.push('lower body');
      }
    } else if (MUSCLE_GROUPS.UPPER_BODY.includes(exercise.primaryMuscle as any)) {
      this.upperBodyCount++;
      if (this.upperBodyCount <= 2) {
        satisfiedConstraints.push('upper body');
      }
    }
    
    // Check function tags
    if (exercise.functionTags) {
      if (exercise.functionTags.includes('core')) {
        this.coreCount++;
        if (this.coreCount <= 1) {
          satisfiedConstraints.push('core');
        }
      }
      if (exercise.functionTags.includes('capacity')) {
        this.capacityCount++;
        if (this.capacityCount <= 2) {
          satisfiedConstraints.push('capacity');
        }
      }
    }
    
    this.exerciseConstraints.set(exercise.id, satisfiedConstraints);
    return satisfiedConstraints;
  }

  isSatisfied(constraints: BlockConstraints, isFullBody: boolean): boolean {
    // Check movement constraints
    const { movements, muscles, functionTags } = constraints;
    
    const movementsSatisfied = 
      (!movements.requireSquatHinge || this.hasSquatHinge) &&
      (!movements.requirePush || this.hasPush) &&
      (!movements.requirePull || this.hasPull) &&
      (!movements.requireLunge || this.hasLunge);
    
    // Check muscle constraints (only if full body)
    const musclesSatisfied = !isFullBody || !muscles || (
      this.lowerBodyCount >= (muscles.minLowerBody || 0) &&
      this.upperBodyCount >= (muscles.minUpperBody || 0)
    );
    
    // Check function tag constraints
    const functionTagsSatisfied = !functionTags || (
      this.coreCount >= (functionTags.minCore || 0) &&
      this.capacityCount >= (functionTags.minCapacity || 0)
    );
    
    return movementsSatisfied && musclesSatisfied && functionTagsSatisfied;
  }

  getNeededConstraints(exercise: ScoredExercise, constraints: BlockConstraints, isFullBody: boolean): string[] {
    const needed: string[] = [];
    const { movements, muscles, functionTags } = constraints;
    
    // Check movement patterns
    if (exercise.movementPattern) {
      if (movements.requireSquatHinge && !this.hasSquatHinge && 
          MOVEMENT_PATTERNS.SQUAT_HINGE.includes(exercise.movementPattern as any)) {
        needed.push('squat/hinge');
      }
      if (movements.requirePush && !this.hasPush && 
          MOVEMENT_PATTERNS.PUSH.includes(exercise.movementPattern as any)) {
        needed.push('push');
      }
      if (movements.requirePull && !this.hasPull && 
          MOVEMENT_PATTERNS.PULL.includes(exercise.movementPattern as any)) {
        needed.push('pull');
      }
      if (movements.requireLunge && !this.hasLunge && exercise.movementPattern === 'lunge') {
        needed.push('lunge');
      }
    }
    
    // Check muscle groups (only if full body)
    if (isFullBody && muscles) {
      if (this.lowerBodyCount < muscles.minLowerBody && 
          MUSCLE_GROUPS.LOWER_BODY.includes(exercise.primaryMuscle as any)) {
        needed.push('lower body');
      }
      if (this.upperBodyCount < muscles.minUpperBody && 
          MUSCLE_GROUPS.UPPER_BODY.includes(exercise.primaryMuscle as any)) {
        needed.push('upper body');
      }
    }
    
    // Check function tags
    if (functionTags && exercise.functionTags) {
      if (functionTags.minCore && this.coreCount < functionTags.minCore && 
          exercise.functionTags.includes('core')) {
        needed.push('core');
      }
      if (functionTags.minCapacity && this.capacityCount < functionTags.minCapacity && 
          exercise.functionTags.includes('capacity')) {
        needed.push('capacity');
      }
    }
    
    return needed;
  }

  getStatus(): string {
    const parts: string[] = [];
    if (this.hasSquatHinge) parts.push('squat/hinge');
    if (this.hasPush) parts.push('push');
    if (this.hasPull) parts.push('pull');
    if (this.hasLunge) parts.push('lunge');
    if (this.lowerBodyCount > 0) parts.push(`lower(${this.lowerBodyCount})`);
    if (this.upperBodyCount > 0) parts.push(`upper(${this.upperBodyCount})`);
    if (this.coreCount > 0) parts.push(`core(${this.coreCount})`);
    if (this.capacityCount > 0) parts.push(`capacity(${this.capacityCount})`);
    return parts.join(', ');
  }
}