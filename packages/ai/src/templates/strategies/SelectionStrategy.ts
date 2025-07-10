import type { PenalizedExercise, BlockConfig } from "../types/blockConfig";
import { ConstraintTracker } from "../utils/ConstraintTracker";
import { randomSelect, weightedRandomSelect } from "../../utils/exerciseSelection";

export interface SelectionStrategy {
  select(
    candidates: PenalizedExercise[], 
    config: BlockConfig, 
    isFullBody: boolean
  ): PenalizedExercise[];
}

export class DeterministicSelection implements SelectionStrategy {
  select(
    candidates: PenalizedExercise[], 
    config: BlockConfig,
    isFullBody: boolean
  ): PenalizedExercise[] {
    const selected: PenalizedExercise[] = [];
    const tracker = new ConstraintTracker();
    
    // Sort by score (highest first)
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
    
    // Phase 1: Select exercises that satisfy constraints
    for (const candidate of sortedCandidates) {
      if (selected.length >= config.maxExercises) break;
      
      // Skip if constraints are already satisfied
      if (tracker.isSatisfied(config.constraints, isFullBody)) break;
      
      // Check if this exercise helps meet any constraints
      const neededConstraints = tracker.getNeededConstraints(candidate, config.constraints, isFullBody);
      
      if (neededConstraints.length > 0) {
        selected.push(candidate);
        const satisfiedConstraints = tracker.updateFromExercise(candidate);
        
        this.logSelection(candidate, config.name, 'constraint satisfaction', satisfiedConstraints);
      }
    }
    
    // Phase 2: Fill remaining slots with highest scoring exercises
    const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
    const slotsToFill = config.maxExercises - selected.length;
    
    for (let i = 0; i < slotsToFill && i < remaining.length; i++) {
      const exercise = remaining[i];
      if (!exercise) continue;
      
      selected.push(exercise);
      tracker.updateFromExercise(exercise);
      
      this.logSelection(exercise, config.name, 'high score');
    }
    
    this.logConstraintStatus(config, tracker, isFullBody);
    
    return selected;
  }
  
  private logSelection(
    exercise: PenalizedExercise, 
    blockName: string, 
    reason: string, 
    constraints?: string[]
  ): void {
    const scoreInfo = exercise.originalScore 
      ? `Score: ${exercise.score} (original: ${exercise.originalScore}, -${exercise.appliedPenalty ?? 0} penalty)`
      : `Score: ${exercise.score}`;
    
    const constraintInfo = constraints?.length ? ` [${constraints.join(', ')}]` : '';
    
    console.log(
      `✅ Selected for ${blockName}: ${exercise.name} - ${scoreInfo}, ` +
      `Reason: ${reason}${constraintInfo}, Pattern: ${exercise.movementPattern}, ` +
      `Muscle: ${exercise.primaryMuscle}`
    );
  }
  
  private logConstraintStatus(config: BlockConfig, tracker: ConstraintTracker, _isFullBody: boolean): void {
    console.log(`📊 ${config.name} constraints: ${tracker.getStatus()}`);
  }
}

export class RandomizedSelection implements SelectionStrategy {
  select(
    candidates: PenalizedExercise[], 
    config: BlockConfig,
    isFullBody: boolean
  ): PenalizedExercise[] {
    const selected: PenalizedExercise[] = [];
    const tracker = new ConstraintTracker();
    
    // Sort by score (highest first)
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
    
    // Phase 1: Constraint satisfaction with randomness for tied scores
    while (!tracker.isSatisfied(config.constraints, isFullBody) && selected.length < config.maxExercises) {
      // Find exercises that can satisfy unmet constraints
      const constraintCandidates = sortedCandidates.filter(ex => {
        if (selected.includes(ex)) return false;
        
        const neededConstraints = tracker.getNeededConstraints(ex, config.constraints, isFullBody);
        return neededConstraints.length > 0;
      });
      
      if (constraintCandidates.length === 0) break;
      
      // Find the highest score among constraint candidates
      const highestScore = constraintCandidates[0]?.score ?? 0;
      const topTiedCandidates = constraintCandidates.filter(ex => ex.score === highestScore);
      
      // Randomly select from tied highest scorers
      const selectedExercise = randomSelect(topTiedCandidates);
      if (!selectedExercise) break;
      
      selected.push(selectedExercise);
      const satisfiedConstraints = tracker.updateFromExercise(selectedExercise);
      
      this.logSelection(selectedExercise, config.name, 'constraint satisfaction', satisfiedConstraints);
    }
    
    // Phase 2: Fill remaining slots with weighted random selection
    if (selected.length < config.maxExercises) {
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      const slotsToFill = config.maxExercises - selected.length;
      
      // Use linear weighting for more variety
      const randomSelected = weightedRandomSelect(remaining, slotsToFill, (score) => score);
      
      for (const exercise of randomSelected) {
        selected.push(exercise);
        tracker.updateFromExercise(exercise);
        
        this.logSelection(exercise, config.name, 'weighted random selection');
      }
    }
    
    this.logConstraintStatus(config, tracker, isFullBody);
    
    return selected;
  }
  
  private logSelection(
    exercise: PenalizedExercise, 
    blockName: string, 
    reason: string, 
    constraints?: string[]
  ): void {
    const scoreInfo = exercise.originalScore 
      ? `Score: ${exercise.score} (original: ${exercise.originalScore}, -${exercise.appliedPenalty ?? 0} penalty)`
      : `Score: ${exercise.score}`;
    
    const constraintInfo = constraints?.length ? ` [${constraints.join(', ')}]` : '';
    
    console.log(
      `✅ Selected for ${blockName}: ${exercise.name} - ${scoreInfo}, ` +
      `Reason: ${reason}${constraintInfo}, Pattern: ${exercise.movementPattern}, ` +
      `Muscle: ${exercise.primaryMuscle}`
    );
  }
  
  private logConstraintStatus(config: BlockConfig, tracker: ConstraintTracker, _isFullBody: boolean): void {
    console.log(`📊 ${config.name} constraints: ${tracker.getStatus()}`);
  }
}