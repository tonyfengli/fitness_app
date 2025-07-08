import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";

// Movement pattern categories for constraints
const SQUAT_HINGE_PATTERNS = ['squat', 'hinge'];
const PUSH_PATTERNS = ['horizontal_push', 'vertical_push'];
const PULL_PATTERNS = ['horizontal_pull', 'vertical_pull'];

// Muscle group categories
const LOWER_BODY_MUSCLES = ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors'];
const UPPER_BODY_MUSCLES = ['chest', 'lats', 'biceps', 'triceps', 'delts', 'shoulders', 'traps', 'upper_back'];

export class FullBodyRoutineTemplateHandler implements TemplateHandler {
  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ FullBodyRoutineTemplateHandler organizing exercises into blocks');
    
    // Get Block A selections first
    const blockA = this.getTop6WithConstraints(exercises, 'primary_strength');
    
    // Create a set of Block A exercise IDs for quick lookup
    const blockAIds = new Set(blockA.map(ex => ex.id));
    
    // Get Block B selections with penalty for exercises already in Block A
    const blockB = this.getTop6WithConstraints(exercises, 'secondary_strength', blockAIds);
    
    // Create a set of Block B exercise IDs for quick lookup
    const blockBIds = new Set(blockB.map(ex => ex.id));
    
    // Get Block C selections with penalty for exercises already in Block B
    const blockC = this.getTop6WithConstraints(exercises, 'accessory', blockBIds);
    
    return {
      blockA,
      blockB,
      blockC,
      
      // Block D: Combined core and capacity exercises sorted by score
      blockD: this.getCombinedCoreAndCapacity(exercises),
    };
  }
  
  private getExercisesByTag(exercises: ScoredExercise[], functionTag: string): ScoredExercise[] {
    // Filter exercises that have the specified function tag
    const filtered = exercises.filter(exercise => 
      exercise.functionTags && exercise.functionTags.includes(functionTag)
    );
    
    // Sort by score (highest first)
    return filtered.sort((a, b) => b.score - a.score);
  }
  
  private getCombinedCoreAndCapacity(exercises: ScoredExercise[]): ScoredExercise[] {
    // Use constraint-based selection for Block D
    return this.getTop6WithFunctionTagConstraints(exercises);
  }
  
  private getTop6WithConstraints(exercises: ScoredExercise[], functionTag: string, penalizeIds?: Set<string>): ScoredExercise[] {
    // Filter exercises that have the specified function tag
    const candidates = exercises.filter(exercise => 
      exercise.functionTags && exercise.functionTags.includes(functionTag)
    );
    
    // Apply penalty to exercises already selected in previous blocks
    const adjustedCandidates = candidates.map(exercise => {
      if (penalizeIds && penalizeIds.has(exercise.id)) {
        // Apply -2.0 penalty for exercises already selected
        const previousBlock = functionTag === 'secondary_strength' ? 'Block A' : 'Block B';
        console.log(`📉 Applying -2.0 penalty to ${exercise.name} for ${functionTag} (already selected in ${previousBlock})`);
        return {
          ...exercise,
          score: Math.max(0, exercise.score - 2.0), // Ensure score doesn't go negative
          originalScore: exercise.score, // Keep track of original score for logging
        };
      }
      return exercise;
    });
    
    // Sort by adjusted score (highest first)
    const sortedCandidates = [...adjustedCandidates].sort((a, b) => b.score - a.score);
    
    if (sortedCandidates.length === 0) return [];
    
    let selected: ScoredExercise[] = [];
    
    // Track what we've satisfied
    let hasSquatHinge = false;
    let hasPush = false;
    let hasPull = false;
    let lowerBodyCount = 0;
    let upperBodyCount = 0;
    
    // Helper functions
    const satisfiesSquatHinge = (ex: ScoredExercise) => 
      ex.movementPattern && SQUAT_HINGE_PATTERNS.includes(ex.movementPattern);
    const satisfiesPush = (ex: ScoredExercise) => 
      ex.movementPattern && PUSH_PATTERNS.includes(ex.movementPattern);
    const satisfiesPull = (ex: ScoredExercise) => 
      ex.movementPattern && PULL_PATTERNS.includes(ex.movementPattern);
    const isLowerBody = (ex: ScoredExercise) => 
      LOWER_BODY_MUSCLES.includes(ex.primaryMuscle);
    const isUpperBody = (ex: ScoredExercise) => 
      UPPER_BODY_MUSCLES.includes(ex.primaryMuscle);
    
    // Check if all minimum constraints are met
    const allConstraintsMet = () => {
      return hasSquatHinge && hasPush && hasPull && lowerBodyCount >= 2 && upperBodyCount >= 2;
    };
    
    // Calculate priority for constraint satisfaction
    const getConstraintPriority = (exercise: ScoredExercise) => {
      // If all constraints are met, no priority needed
      if (allConstraintsMet()) return 0;
      
      let priority = 0;
      
      // High priority for movement patterns we're missing
      if (!hasSquatHinge && satisfiesSquatHinge(exercise)) priority += 3;
      if (!hasPush && satisfiesPush(exercise)) priority += 3;
      if (!hasPull && satisfiesPull(exercise)) priority += 3;
      
      // Medium priority for body part minimums we haven't met
      if (lowerBodyCount < 2 && isLowerBody(exercise)) priority += 2;
      if (upperBodyCount < 2 && isUpperBody(exercise)) priority += 2;
      
      return priority;
    };
    
    // Selection algorithm: Prioritize constraints until met, then go by score
    for (const candidate of sortedCandidates) {
      if (selected.length >= 6) break;
      
      const priority = getConstraintPriority(candidate);
      
      // Select if it helps meet constraints
      if (priority > 0) {
        selected.push(candidate);
        
        // Update tracking
        if (satisfiesSquatHinge(candidate)) hasSquatHinge = true;
        if (satisfiesPush(candidate)) hasPush = true;
        if (satisfiesPull(candidate)) hasPull = true;
        if (isLowerBody(candidate)) lowerBodyCount++;
        else if (isUpperBody(candidate)) upperBodyCount++;
        
        const scoreInfo = (candidate as any).originalScore 
          ? `Score: ${candidate.score} (original: ${(candidate as any).originalScore}, -2.0 penalty)`
          : `Score: ${candidate.score}`;
        console.log(`✅ Selected for ${functionTag}: ${candidate.name} - ${scoreInfo}, Reason: constraint priority: ${priority}, Pattern: ${candidate.movementPattern}, Muscle: ${candidate.primaryMuscle}`);
      }
    }
    
    // After constraints are met, fill remaining slots with highest scoring exercises
    if (selected.length < 6 && allConstraintsMet()) {
      // Get exercises not yet selected
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      
      // Take the highest scoring ones to fill up to 6
      const slotsToFill = 6 - selected.length;
      const highestScoring = remaining.slice(0, slotsToFill);
      
      for (const candidate of highestScoring) {
        selected.push(candidate);
        
        // Update tracking
        if (satisfiesSquatHinge(candidate)) hasSquatHinge = true;
        if (satisfiesPush(candidate)) hasPush = true;
        if (satisfiesPull(candidate)) hasPull = true;
        if (isLowerBody(candidate)) lowerBodyCount++;
        else if (isUpperBody(candidate)) upperBodyCount++;
        
        const scoreInfo = (candidate as any).originalScore 
          ? `Score: ${candidate.score} (original: ${(candidate as any).originalScore}, -2.0 penalty)`
          : `Score: ${candidate.score}`;
        console.log(`✅ Selected for ${functionTag}: ${candidate.name} - ${scoreInfo}, Reason: high score (constraints already met), Pattern: ${candidate.movementPattern}, Muscle: ${candidate.primaryMuscle}`);
      }
    }
    
    // If we still need more exercises (constraints couldn't be fully met)
    if (selected.length < 6) {
      // Get exercises not yet selected
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      
      // Take the highest scoring ones to fill up to 6
      const slotsToFill = 6 - selected.length;
      const highestScoring = remaining.slice(0, slotsToFill);
      
      for (const candidate of highestScoring) {
        selected.push(candidate);
        
        // Update tracking
        if (satisfiesSquatHinge(candidate)) hasSquatHinge = true;
        if (satisfiesPush(candidate)) hasPush = true;
        if (satisfiesPull(candidate)) hasPull = true;
        if (isLowerBody(candidate)) lowerBodyCount++;
        else if (isUpperBody(candidate)) upperBodyCount++;
        
        const scoreInfo = (candidate as any).originalScore 
          ? `Score: ${candidate.score} (original: ${(candidate as any).originalScore}, -2.0 penalty)`
          : `Score: ${candidate.score}`;
        console.log(`⚠️ Selected for ${functionTag} (constraints not fully met): ${candidate.name} - ${scoreInfo}, Pattern: ${candidate.movementPattern}, Muscle: ${candidate.primaryMuscle}`);
      }
    }
    
    // Log constraint satisfaction
    console.log(`📊 ${functionTag} constraints check:
      - Squat/Hinge: ${hasSquatHinge ? '✅' : '❌'}
      - Push: ${hasPush ? '✅' : '❌'}
      - Pull: ${hasPull ? '✅' : '❌'}
      - Lower Body (${lowerBodyCount}/2): ${lowerBodyCount >= 2 ? '✅' : '❌'}
      - Upper Body (${upperBodyCount}/2): ${upperBodyCount >= 2 ? '✅' : '❌'}
    `);
    
    // Safety check - ensure we never return more than 6
    if (selected.length > 6) {
      console.warn(`⚠️ WARNING: Selected ${selected.length} exercises for ${functionTag}, limiting to 6`);
      selected = selected.slice(0, 6);
    }
    
    console.log(`📌 Final selection for ${functionTag}: ${selected.length} exercises`);
    selected.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. ${ex.name} (${ex.score})`);
    });
    
    return selected;
  }
  
  private getTop6WithFunctionTagConstraints(exercises: ScoredExercise[]): ScoredExercise[] {
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
      return coreCount >= 3 && capacityCount >= 3;
    };
    
    // Calculate priority for constraint satisfaction
    const getConstraintPriority = (exercise: ScoredExercise) => {
      // If all constraints are met, no priority needed
      if (constraintsMet()) return 0;
      
      let priority = 0;
      
      // High priority for function tags we need more of
      if (coreCount < 3 && isCore(exercise)) priority += 3;
      if (capacityCount < 3 && isCapacity(exercise)) priority += 3;
      
      return priority;
    };
    
    // Selection algorithm: Prioritize constraints until met, then go by score
    for (const candidate of sortedCandidates) {
      if (selected.length >= 6) break;
      
      const priority = getConstraintPriority(candidate);
      
      // Select if it helps meet constraints
      if (priority > 0) {
        selected.push(candidate);
        
        // Update tracking
        if (isCore(candidate)) coreCount++;
        if (isCapacity(candidate)) capacityCount++;
        
        console.log(`✅ Selected for Block D: ${candidate.name} - Score: ${candidate.score}, Reason: constraint priority: ${priority}, Tags: ${candidate.functionTags?.join(', ')}`);
      }
    }
    
    // After constraints are met (or attempted), fill remaining slots with highest scoring exercises
    if (selected.length < 6) {
      // Get exercises not yet selected
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      
      // Take the highest scoring ones to fill up to 6
      const slotsToFill = 6 - selected.length;
      const highestScoring = remaining.slice(0, slotsToFill);
      
      for (const candidate of highestScoring) {
        selected.push(candidate);
        
        // Update tracking
        if (isCore(candidate)) coreCount++;
        if (isCapacity(candidate)) capacityCount++;
        
        console.log(`✅ Selected for Block D: ${candidate.name} - Score: ${candidate.score}, Reason: high score (constraints ${constraintsMet() ? 'met' : 'not fully met'}), Tags: ${candidate.functionTags?.join(', ')}`);
      }
    }
    
    // Log constraint satisfaction
    console.log(`📊 Block D constraints check:
      - Core (min 3): ${coreCount} ${coreCount >= 3 ? '✅' : '❌'}
      - Capacity (min 3): ${capacityCount} ${capacityCount >= 3 ? '✅' : '❌'}
    `);
    
    console.log(`📌 Final selection for Block D: ${selected.length} exercises`);
    selected.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. ${ex.name} (${ex.score}) - ${ex.functionTags?.join(', ')}`);
    });
    
    return selected;
  }
}