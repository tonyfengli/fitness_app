import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";
import { randomSelect, weightedRandomSelect } from "../utils/exerciseSelection";

// Movement pattern categories for constraints
const SQUAT_HINGE_PATTERNS = ['squat', 'hinge'];
const PUSH_PATTERNS = ['horizontal_push', 'vertical_push'];
const PULL_PATTERNS = ['horizontal_pull', 'vertical_pull'];

export class WorkoutTemplateHandler implements TemplateHandler {
  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ WorkoutTemplateHandler organizing exercises into blocks');
    
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
        const previousBlock = functionTag === 'secondary_strength' ? 'Block A' : 
                            functionTag === 'accessory' ? 'Block B' : 'previous block';
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
    
    // Track what we've satisfied (only movement patterns, no body part constraints)
    let hasSquatHinge = false;
    let hasPush = false;
    let hasPull = false;
    let hasLunge = false; // Add lunge tracking for Block B
    
    // Helper functions
    const satisfiesSquatHinge = (ex: ScoredExercise) => 
      ex.movementPattern && SQUAT_HINGE_PATTERNS.includes(ex.movementPattern);
    const satisfiesPush = (ex: ScoredExercise) => 
      ex.movementPattern && PUSH_PATTERNS.includes(ex.movementPattern);
    const satisfiesPull = (ex: ScoredExercise) => 
      ex.movementPattern && PULL_PATTERNS.includes(ex.movementPattern);
    const satisfiesLunge = (ex: ScoredExercise) => 
      ex.movementPattern === 'lunge';
    
    // Check if all minimum constraints are met
    const allConstraintsMet = () => {
      const lungeRequired = functionTag === 'secondary_strength';
      return hasSquatHinge && hasPush && hasPull && (!lungeRequired || hasLunge);
    };
    
    // For Block A, use original deterministic selection
    if (functionTag === 'primary_strength') {
      // Original logic for Block A - no randomness
      for (const candidate of sortedCandidates) {
        if (selected.length >= 5) break;
        
        // Check if it helps meet constraints
        if (!allConstraintsMet()) {
          const satisfiesNeeded = 
            (!hasSquatHinge && satisfiesSquatHinge(candidate)) ||
            (!hasPush && satisfiesPush(candidate)) ||
            (!hasPull && satisfiesPull(candidate));
          
          if (satisfiesNeeded) {
            selected.push(candidate);
            
            // Update tracking
            if (satisfiesSquatHinge(candidate)) hasSquatHinge = true;
            if (satisfiesPush(candidate)) hasPush = true;
            if (satisfiesPull(candidate)) hasPull = true;
            
            const scoreInfo = (candidate as any).originalScore 
              ? `Score: ${candidate.score} (original: ${(candidate as any).originalScore}, -2.0 penalty)`
              : `Score: ${candidate.score}`;
            console.log(`✅ Selected for ${functionTag}: ${candidate.name} - ${scoreInfo}, Reason: constraint satisfaction, Pattern: ${candidate.movementPattern}`);
            continue;
          }
        }
      }
      
      // Fill remaining slots with highest scoring
      const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
      const slotsToFill = 5 - selected.length;
      
      for (let i = 0; i < slotsToFill && i < remaining.length; i++) {
        const exercise = remaining[i];
        if (!exercise) continue;
        selected.push(exercise);
        console.log(`✅ Selected for ${functionTag}: ${exercise.name} - Score: ${exercise.score}, Reason: high score`);
      }
    } else {
      // New selection logic for Blocks B and C with randomness
      const lungeRequired = functionTag === 'secondary_strength';
      const maxSlots = functionTag === 'secondary_strength' || functionTag === 'accessory' ? 8 : 6;
      
      // Phase 1: Constraint satisfaction with randomness for tied highest scores
      while (!allConstraintsMet() && selected.length < maxSlots) {
        // Find exercises that can satisfy unmet constraints
        const constraintCandidates = sortedCandidates.filter(ex => {
          if (selected.includes(ex)) return false;
          
          return (!hasSquatHinge && satisfiesSquatHinge(ex)) ||
                 (!hasPush && satisfiesPush(ex)) ||
                 (!hasPull && satisfiesPull(ex)) ||
                 (lungeRequired && !hasLunge && satisfiesLunge(ex));
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
        if (satisfiesSquatHinge(selectedExercise)) hasSquatHinge = true;
        if (satisfiesPush(selectedExercise)) hasPush = true;
        if (satisfiesPull(selectedExercise)) hasPull = true;
        if (satisfiesLunge(selectedExercise)) hasLunge = true;
        
        const scoreInfo = (selectedExercise as any).originalScore 
          ? `Score: ${selectedExercise.score} (original: ${(selectedExercise as any).originalScore}, -2.0 penalty)`
          : `Score: ${selectedExercise.score}`;
        
        const constraints = [];
        if (satisfiesSquatHinge(selectedExercise)) constraints.push('squat/hinge');
        if (satisfiesPush(selectedExercise)) constraints.push('push');
        if (satisfiesPull(selectedExercise)) constraints.push('pull');
        if (satisfiesLunge(selectedExercise)) constraints.push('lunge');
        
        console.log(`✅ Selected for ${functionTag}: ${selectedExercise.name} - ${scoreInfo}, Reason: constraint satisfaction [${constraints.join(', ')}], Pattern: ${selectedExercise.movementPattern}`);
      }
      
      // Phase 2: Fill remaining slots with weighted random selection
      if (selected.length < maxSlots) {
        const remaining = sortedCandidates.filter(ex => !selected.includes(ex));
        const slotsToFill = maxSlots - selected.length;
        
        // Use linear weighting instead of quadratic for more variety
        const randomSelected = weightedRandomSelect(remaining, slotsToFill, (score) => score);
        
        for (const exercise of randomSelected) {
          selected.push(exercise);
          
          const scoreInfo = (exercise as any).originalScore 
            ? `Score: ${exercise.score} (original: ${(exercise as any).originalScore}, -2.0 penalty)`
            : `Score: ${exercise.score}`;
          console.log(`✅ Selected for ${functionTag}: ${exercise.name} - ${scoreInfo}, Reason: weighted random selection, Pattern: ${exercise.movementPattern}`);
        }
      }
    }
    
    // Log constraint satisfaction (only movement patterns, no body part requirements)
    const lungeRequired = functionTag === 'secondary_strength';
    console.log(`📊 ${functionTag} constraints check:
      - Squat/Hinge: ${hasSquatHinge ? '✅' : '❌'}
      - Push: ${hasPush ? '✅' : '❌'}
      - Pull: ${hasPull ? '✅' : '❌'}${lungeRequired ? `\n      - Lunge: ${hasLunge ? '✅' : '❌'}` : ''}
    `);
    
    // Safety check - ensure we never return more than max
    const maxForBlock = functionTag === 'primary_strength' ? 5 : 
                       (functionTag === 'secondary_strength' || functionTag === 'accessory') ? 8 : 6;
    if (selected.length > maxForBlock) {
      console.warn(`⚠️ WARNING: Selected ${selected.length} exercises for ${functionTag}, limiting to ${maxForBlock}`);
      selected = selected.slice(0, maxForBlock);
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