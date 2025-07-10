import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";
import { randomSelect, weightedRandomSelect } from "../utils/exerciseSelection";

// Movement pattern categories for constraints
export const SQUAT_HINGE_PATTERNS = ['squat', 'hinge'];
export const PUSH_PATTERNS = ['horizontal_push', 'vertical_push'];
export const PULL_PATTERNS = ['horizontal_pull', 'vertical_pull'];

/**
 * Base class for template handlers with shared functionality
 */
export abstract class BaseTemplateHandler implements TemplateHandler {
  abstract organize(exercises: ScoredExercise[]): OrganizedExercises;
  
  /**
   * Get exercises filtered by a specific function tag and sorted by score
   */
  protected getExercisesByTag(exercises: ScoredExercise[], functionTag: string): ScoredExercise[] {
    // Filter exercises that have the specified function tag
    const filtered = exercises.filter(exercise => 
      exercise.functionTags && exercise.functionTags.includes(functionTag)
    );
    
    // Sort by score (highest first)
    return filtered.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Get combined core and capacity exercises using constraint-based selection
   */
  protected getCombinedCoreAndCapacity(exercises: ScoredExercise[]): ScoredExercise[] {
    // Use constraint-based selection for Block D
    return this.getTop6WithFunctionTagConstraints(exercises);
  }
  
  /**
   * Constraint-based selection for Block D exercises (core and capacity)
   * Ensures minimum of 1 core and 2 capacity exercises
   */
  protected getTop6WithFunctionTagConstraints(exercises: ScoredExercise[]): ScoredExercise[] {
    // Filter exercises that have either 'core' or 'capacity' function tags
    const candidates = exercises.filter(exercise => 
      exercise.functionTags && 
      (exercise.functionTags.includes('core') || exercise.functionTags.includes('capacity'))
    );
    
    // Sort by score (highest first)
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
    
    if (sortedCandidates.length === 0) return [];
    
    let selected: ScoredExercise[] = [];
    
    // Track what we've satisfied
    let coreCount = 0;
    let capacityCount = 0;
    
    // Helper functions
    const isCore = (ex: ScoredExercise) => ex.functionTags?.includes('core');
    const isCapacity = (ex: ScoredExercise) => ex.functionTags?.includes('capacity');
    
    // Check if minimum constraints are met
    const constraintsMet = () => {
      return coreCount >= 1 && capacityCount >= 2;
    };
    
    // Phase 1: Constraint satisfaction with randomness for tied highest scores
    while (!constraintsMet() && selected.length < 6) {
      // Find exercises that can satisfy unmet constraints
      const constraintCandidates = sortedCandidates.filter(ex => {
        if (selected.includes(ex)) return false;
        
        return (coreCount < 1 && isCore(ex)) ||
               (capacityCount < 2 && isCapacity(ex));
      });
      
      if (constraintCandidates.length === 0) break;
      
      // Find the highest score among constraint candidates
      const highestScore = constraintCandidates[0]?.score ?? 0;
      const topTiedCandidates = constraintCandidates.filter(ex => ex.score === highestScore);
      
      // Randomly select from tied highest scorers
      const selectedExercise = randomSelect(topTiedCandidates);
      if (!selectedExercise) break;
      
      selected.push(selectedExercise);
      
      // Update tracking
      if (isCore(selectedExercise)) coreCount++;
      if (isCapacity(selectedExercise)) capacityCount++;
      
      const tags = [];
      if (isCore(selectedExercise)) tags.push('core');
      if (isCapacity(selectedExercise)) tags.push('capacity');
      
      console.log(`✅ Selected for Block D: ${selectedExercise.name} - Score: ${selectedExercise.score}, Reason: constraint satisfaction [${tags.join(', ')}], Tags: ${selectedExercise.functionTags?.join(', ')}`);
    }
    
    // Phase 2: Fill remaining slots with weighted random selection
    if (selected.length < 6) {
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      const slotsToFill = 6 - selected.length;
      
      // Use linear weighting instead of quadratic for more variety
      const randomSelected = weightedRandomSelect(remaining, slotsToFill, (score) => score);
      
      for (const exercise of randomSelected) {
        selected.push(exercise);
        
        // Update tracking
        if (isCore(exercise)) coreCount++;
        if (isCapacity(exercise)) capacityCount++;
        
        console.log(`✅ Selected for Block D: ${exercise.name} - Score: ${exercise.score}, Reason: weighted random selection, Tags: ${exercise.functionTags?.join(', ')}`);
      }
    }
    
    // Log constraint satisfaction
    console.log(`📊 Block D constraints check:
      - Core (min 1): ${coreCount} ${coreCount >= 1 ? '✅' : '❌'}
      - Capacity (min 2): ${capacityCount} ${capacityCount >= 2 ? '✅' : '❌'}
    `);
    
    console.log(`📌 Final selection for Block D: ${selected.length} exercises`);
    selected.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. ${ex.name} (${ex.score}) - ${ex.functionTags?.join(', ')}`);
    });
    
    return selected;
  }
}