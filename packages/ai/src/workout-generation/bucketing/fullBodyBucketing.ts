/**
 * Bucketing logic specifically for Full Body With Finisher workout type
 */

import type { ScoredExercise } from '../../types/scoredExercise';
import type { ClientContext } from '../../types/clientContext';
import { WorkoutType, BUCKET_CONFIGS } from '../../types/clientTypes';
import { analyzeConstraints, getRemainingNeeds } from '../utils/constraintAnalyzer';
import type { PreAssignedExercise } from '../../types/standardBlueprint';

export interface BucketingResult {
  exercises: ScoredExercise[];
  bucketAssignments: {
    [exerciseId: string]: {
      bucketType: 'movement_pattern' | 'functional' | 'flex';
      constraint: string;
      tiedCount?: number; // Track ties for UI display
    };
  };
}

/**
 * Select exercise with tie-breaking for movement pattern
 */
function selectWithTieBreaking(
  candidates: ScoredExercise[],
  pattern: string
): { exercise: ScoredExercise; tiedCount?: number } | null {
  if (candidates.length === 0) return null;
  
  // Find highest score
  const highestScore = Math.max(...candidates.map(ex => ex.score));
  
  // Get all exercises with highest score
  const tied = candidates.filter(ex => ex.score === highestScore);
  
  if (tied.length === 0) return null;
  
  // Randomly select from tied exercises
  const randomIndex = Math.floor(Math.random() * tied.length);
  const selected = tied[randomIndex];
  
  if (!selected) return null;
  
  return {
    exercise: selected,
    tiedCount: tied.length > 1 ? tied.length : undefined
  };
}

/**
 * Apply bucketing logic for Full Body With Finisher
 * Fills remaining exercise slots after pre-assignments
 */
export function applyFullBodyBucketing(
  availableExercises: ScoredExercise[],
  preAssigned: PreAssignedExercise[],
  client: ClientContext,
  workoutType: WorkoutType,
  favoriteIds: string[] = []
): BucketingResult {
  // Only process Full Body With Finisher
  if (workoutType !== WorkoutType.FULL_BODY_WITH_FINISHER) {
    return {
      exercises: [],
      bucketAssignments: {}
    };
  }

  const selected: ScoredExercise[] = [];
  const bucketAssignments: BucketingResult['bucketAssignments'] = {};
  const usedIds = new Set<string>();
  
  // Get pre-assigned exercises
  const preAssignedExercises = preAssigned.map(p => p.exercise);
  
  // Analyze what constraints are already fulfilled
  const analysis = analyzeConstraints(preAssignedExercises, client, workoutType);
  const remainingNeeds = getRemainingNeeds(analysis);
  
  console.log('🪣 Bucketing for', client.name, {
    preAssigned: preAssignedExercises.length,
    remainingMovementPatterns: remainingNeeds.movementPatterns,
    remainingFunctional: remainingNeeds.functionalRequirements,
    totalRemaining: remainingNeeds.totalExercises
  });
  
  // Phase 1: Fill remaining movement patterns (excluding favorites)
  for (const pattern of remainingNeeds.movementPatterns) {
    // Get non-favorite candidates for this pattern
    const candidates = availableExercises.filter(ex => 
      !usedIds.has(ex.id) && 
      !favoriteIds.includes(ex.id) && // Exclude favorites
      ex.movementPattern?.toLowerCase() === pattern.toLowerCase()
    );
    
    const result = selectWithTieBreaking(candidates, pattern);
    
    if (result) {
      selected.push(result.exercise);
      usedIds.add(result.exercise.id);
      bucketAssignments[result.exercise.id] = {
        bucketType: 'movement_pattern',
        constraint: pattern,
        tiedCount: result.tiedCount
      };
    } else {
      console.warn(`⚠️ No non-favorite exercise found for movement pattern: ${pattern}`);
    }
  }
  
  console.log(`  ✓ Selected ${selected.length} exercises for movement patterns`);
  
  // Phase 2: Fill muscle_target constraint
  // First, check how many muscle_target exercises we already have from pre-assigned and movement patterns
  const updatedAnalysis = analyzeConstraints([...preAssignedExercises, ...selected], client, workoutType);
  const currentMuscleTargetCount = updatedAnalysis.functionalRequirements.muscle_target?.current || 0;
  const requiredMuscleTargetCount = updatedAnalysis.functionalRequirements.muscle_target?.required || 0;
  const muscleTargetNeeded = Math.max(0, requiredMuscleTargetCount - currentMuscleTargetCount);
  
  // Debug: Show which exercises already count towards muscle_target
  const existingMuscleTargets = [...preAssignedExercises, ...selected].filter(ex => {
    const targets = client.muscle_target || [];
    return targets.some(muscle => 
      ex.primaryMuscle?.toLowerCase() === muscle.toLowerCase()
    );
  });
  
  console.log(`  Muscle target status: ${currentMuscleTargetCount}/${requiredMuscleTargetCount} (need ${muscleTargetNeeded} more)`);
  console.log(`  Existing muscle target exercises:`, existingMuscleTargets.map(ex => 
    `${ex.name} (${ex.primaryMuscle})`
  ));
  
  if (muscleTargetNeeded > 0 && client.muscle_target && client.muscle_target.length > 0) {
    const targetMuscles = client.muscle_target;
    
    // Count how many of each target muscle we already have
    const muscleCountMap = new Map<string, number>();
    for (const muscle of targetMuscles) {
      const count = existingMuscleTargets.filter(ex => 
        ex.primaryMuscle?.toLowerCase() === muscle.toLowerCase()
      ).length;
      muscleCountMap.set(muscle.toLowerCase(), count);
    }
    
    console.log(`  Current muscle counts:`, Array.from(muscleCountMap.entries()));
    
    // Determine how many more we need for each muscle to reach equal distribution
    const targetPerMuscle = 2; // For 2 muscles, we want 2 of each (total 4)
    let distribution: { muscle: string; count: number }[] = [];
    
    for (const muscle of targetMuscles) {
      const currentCount = muscleCountMap.get(muscle.toLowerCase()) || 0;
      const needed = Math.max(0, targetPerMuscle - currentCount);
      if (needed > 0) {
        distribution.push({ muscle, count: needed });
      }
    }
    
    console.log(`  Muscle target distribution needed:`, distribution);
    
    // Select exercises for each target muscle
    for (const { muscle, count } of distribution) {
      // Get candidates for this specific muscle (including favorites)
      const muscleCandidates = availableExercises.filter(ex => 
        !usedIds.has(ex.id) && 
        ex.primaryMuscle?.toLowerCase() === muscle.toLowerCase()
      );
      
      console.log(`  Finding ${count} exercises for ${muscle}: ${muscleCandidates.length} candidates`);
      
      // Select with tie-breaking
      let selectedForMuscle = 0;
      while (selectedForMuscle < count && muscleCandidates.some(ex => !usedIds.has(ex.id))) {
        const remainingCandidates = muscleCandidates.filter(ex => !usedIds.has(ex.id));
        const result = selectWithTieBreaking(remainingCandidates, muscle);
        
        if (result) {
          selected.push(result.exercise);
          usedIds.add(result.exercise.id);
          bucketAssignments[result.exercise.id] = {
            bucketType: 'functional',
            constraint: 'muscle_target',
            tiedCount: result.tiedCount
          };
          selectedForMuscle++;
        } else {
          console.warn(`⚠️ Could not find enough exercises for muscle target: ${muscle} (got ${selectedForMuscle}/${count})`);
          break;
        }
      }
    }
  }
  
  console.log(`  ✓ Total selected: ${selected.length} exercises`);
  
  // Phase 3: Fill capacity constraint
  const updatedAnalysis2 = analyzeConstraints([...preAssignedExercises, ...selected], client, workoutType);
  const currentCapacityCount = updatedAnalysis2.functionalRequirements.capacity?.current || 0;
  const requiredCapacityCount = updatedAnalysis2.functionalRequirements.capacity?.required || 0;
  const capacityNeeded = Math.max(0, requiredCapacityCount - currentCapacityCount);
  
  console.log(`  Capacity status: ${currentCapacityCount}/${requiredCapacityCount} (need ${capacityNeeded} more)`);
  
  if (capacityNeeded > 0) {
    // Get capacity exercises (excluding favorites)
    const capacityCandidates = availableExercises.filter(ex => 
      !usedIds.has(ex.id) && 
      !favoriteIds.includes(ex.id) && // Exclude favorites
      ex.functionTags?.includes('capacity')
    );
    
    console.log(`  Finding ${capacityNeeded} capacity exercises: ${capacityCandidates.length} candidates`);
    
    // Select with tie-breaking
    const result = selectWithTieBreaking(capacityCandidates, 'capacity');
    
    if (result) {
      selected.push(result.exercise);
      usedIds.add(result.exercise.id);
      bucketAssignments[result.exercise.id] = {
        bucketType: 'functional',
        constraint: 'capacity',
        tiedCount: result.tiedCount
      };
      console.log(`  ✓ Selected capacity exercise: ${result.exercise.name}`);
    } else {
      console.warn(`  ⚠️ Could not find capacity exercise`);
    }
  }
  
  // Phase 4: Fill remaining slots with favorites to reach 13 total bucketed exercises
  const targetBucketedExercises = 13; // We want exactly 13 bucketed exercises
  const remainingSlots = targetBucketedExercises - selected.length;
  
  console.log(`  Flex slots: ${selected.length}/${targetBucketedExercises} bucketed (need ${remainingSlots} more)`);
  
  if (remainingSlots > 0) {
    // Get favorite exercises that haven't been used yet
    const unusedFavorites = availableExercises.filter(ex => 
      !usedIds.has(ex.id) && 
      favoriteIds.includes(ex.id) &&
      !preAssignedExercises.some(pre => pre.id === ex.id) // Not already pre-assigned
    );
    
    console.log(`  Finding ${remainingSlots} favorite exercises for flex slots: ${unusedFavorites.length} candidates`);
    
    // Sort by score and select with tie-breaking
    unusedFavorites.sort((a, b) => b.score - a.score);
    
    let selectedFlex = 0;
    while (selectedFlex < remainingSlots && unusedFavorites.some(ex => !usedIds.has(ex.id))) {
      const remainingCandidates = unusedFavorites.filter(ex => !usedIds.has(ex.id));
      const result = selectWithTieBreaking(remainingCandidates, 'flex');
      
      if (result) {
        selected.push(result.exercise);
        usedIds.add(result.exercise.id);
        bucketAssignments[result.exercise.id] = {
          bucketType: 'flex',
          constraint: 'flex (favorite)',
          tiedCount: result.tiedCount
        };
        selectedFlex++;
        console.log(`  ✓ Selected favorite for flex: ${result.exercise.name}`);
      } else {
        break;
      }
    }
    
    // If we still need more exercises and no favorites left, fill with highest scoring non-favorites
    if (selectedFlex < remainingSlots) {
      const remainingNeeded = remainingSlots - selectedFlex;
      console.log(`  Still need ${remainingNeeded} more exercises, selecting from non-favorites`);
      
      const nonFavorites = availableExercises.filter(ex => 
        !usedIds.has(ex.id) && 
        !favoriteIds.includes(ex.id)
      );
      
      nonFavorites.sort((a, b) => b.score - a.score);
      
      let selectedNonFav = 0;
      while (selectedNonFav < remainingNeeded && nonFavorites.some(ex => !usedIds.has(ex.id))) {
        const remainingCandidates = nonFavorites.filter(ex => !usedIds.has(ex.id));
        const result = selectWithTieBreaking(remainingCandidates, 'flex');
        
        if (result) {
          selected.push(result.exercise);
          usedIds.add(result.exercise.id);
          bucketAssignments[result.exercise.id] = {
            bucketType: 'flex',
            constraint: 'flex',
            tiedCount: result.tiedCount
          };
          selectedNonFav++;
          console.log(`  ✓ Selected non-favorite for flex: ${result.exercise.name}`);
        } else {
          break;
        }
      }
    }
  }
  
  console.log(`  ✓ Bucketed ${selected.length} exercises for ${client.name} (${preAssignedExercises.length} pre-assigned + ${selected.length} bucketed = ${preAssignedExercises.length + selected.length} total)`);
  
  return {
    exercises: selected,
    bucketAssignments
  };
}