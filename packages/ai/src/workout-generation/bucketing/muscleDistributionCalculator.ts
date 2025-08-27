/**
 * Muscle Distribution Calculator
 * 
 * Generates deterministic muscle distribution options for LLM to follow
 * when selecting exercises for targeted workouts.
 */

export interface DistributionInput {
  totalExercises: number;
  preAssignedMuscles: string[]; // Primary muscles of pre-assigned exercises
  targetMuscles: string[]; // Client's muscle targets
}

export interface MuscleDistribution {
  [muscle: string]: number;
}

export interface DistributionOutput {
  options: MuscleDistribution[]; // 1-2 distribution options
}

/**
 * Calculate how many exercises are needed for each muscle target
 * Returns 1-2 distribution options for the LLM to choose from
 */
export function calculateMuscleDistribution(
  input: DistributionInput
): DistributionOutput {
  const { totalExercises, preAssignedMuscles, targetMuscles } = input;
  
  // Calculate remaining slots after pre-assignments
  const remainingSlots = totalExercises - preAssignedMuscles.length;
  
  // Count current exercises per muscle
  const currentPerMuscle = new Map<string, number>();
  for (const muscle of targetMuscles) {
    currentPerMuscle.set(muscle, 0);
  }
  
  // Count pre-assigned exercises by primary muscle
  for (const muscle of preAssignedMuscles) {
    const normalizedMuscle = muscle.toLowerCase();
    if (currentPerMuscle.has(normalizedMuscle)) {
      currentPerMuscle.set(
        normalizedMuscle,
        currentPerMuscle.get(normalizedMuscle)! + 1
      );
    }
  }
  
  // Identify uncovered muscles
  const uncoveredMuscles: string[] = [];
  const coveredMuscles: string[] = [];
  
  for (const [muscle, count] of currentPerMuscle) {
    if (count === 0) {
      uncoveredMuscles.push(muscle);
    } else {
      coveredMuscles.push(muscle);
    }
  }
  
  // Edge case: no remaining slots
  if (remainingSlots <= 0) {
    return { options: [{}] };
  }
  
  // Edge case: more uncovered muscles than remaining slots
  if (uncoveredMuscles.length > remainingSlots) {
    // Can only cover some muscles, return single option
    const distribution: MuscleDistribution = {};
    for (let i = 0; i < remainingSlots && i < uncoveredMuscles.length; i++) {
      const muscle = uncoveredMuscles[i];
      if (muscle) {
        distribution[muscle] = 1;
      }
    }
    return { options: [distribution] };
  }
  
  // Generate distribution options
  const options: MuscleDistribution[] = [];
  
  // Calculate base slots per muscle after covering uncovered ones
  const slotsAfterCoverage = remainingSlots - uncoveredMuscles.length;
  const allMuscles = targetMuscles.map(m => m.toLowerCase());
  
  // Option A: Balanced distribution
  const optionA = generateBalancedDistribution(
    allMuscles,
    currentPerMuscle,
    remainingSlots
  );
  options.push(optionA);
  
  // Option B: Alternative distribution (if meaningful alternative exists)
  if (slotsAfterCoverage > 0 && targetMuscles.length > 1) {
    const optionB = generateAlternativeDistribution(
      allMuscles,
      currentPerMuscle,
      remainingSlots,
      optionA
    );
    
    // Only add Option B if it's different from Option A
    if (!areDistributionsEqual(optionA, optionB)) {
      options.push(optionB);
    }
  }
  
  return { options };
}

/**
 * Generate a balanced distribution
 */
function generateBalancedDistribution(
  targetMuscles: string[],
  currentPerMuscle: Map<string, number>,
  remainingSlots: number
): MuscleDistribution {
  const distribution: MuscleDistribution = {};
  let slotsLeft = remainingSlots;
  
  // First pass: ensure uncovered muscles get at least 1
  for (const muscle of targetMuscles) {
    if (currentPerMuscle.get(muscle) === 0 && slotsLeft > 0) {
      distribution[muscle] = 1;
      slotsLeft--;
    }
  }
  
  // Second pass: distribute remaining slots to maintain balance
  while (slotsLeft > 0) {
    let minTotal = Infinity;
    let targetMuscle = "";
    
    // Find muscle with lowest total count
    for (const muscle of targetMuscles) {
      const current = currentPerMuscle.get(muscle) || 0;
      const distributed = distribution[muscle] || 0;
      const total = current + distributed;
      
      // Check max limit (3-4 depending on number of targets)
      const maxPerMuscle = targetMuscles.length <= 2 ? 4 : 3;
      
      if (total < minTotal && total < maxPerMuscle) {
        minTotal = total;
        targetMuscle = muscle;
      }
    }
    
    if (targetMuscle) {
      distribution[targetMuscle] = (distribution[targetMuscle] || 0) + 1;
      slotsLeft--;
    } else {
      // All muscles at max
      break;
    }
  }
  
  return distribution;
}

/**
 * Generate an alternative distribution
 */
function generateAlternativeDistribution(
  targetMuscles: string[],
  currentPerMuscle: Map<string, number>,
  remainingSlots: number,
  balancedOption: MuscleDistribution
): MuscleDistribution {
  const distribution: MuscleDistribution = {};
  
  // First ensure uncovered muscles get at least 1
  for (const muscle of targetMuscles) {
    if (currentPerMuscle.get(muscle) === 0) {
      distribution[muscle] = 1;
      remainingSlots--;
    }
  }
  
  // For alternative, favor different muscles than balanced option
  // Find muscle that got the most in balanced option
  let maxMuscle = "";
  let maxCount = 0;
  for (const [muscle, count] of Object.entries(balancedOption)) {
    if (count > maxCount) {
      maxCount = count;
      maxMuscle = muscle;
    }
  }
  
  // Distribute remaining slots to other muscles first
  const otherMuscles = targetMuscles.filter(m => m !== maxMuscle);
  
  while (remainingSlots > 0) {
    // Distribute to other muscles evenly
    for (const muscle of otherMuscles) {
      if (remainingSlots > 0) {
        const currentTotal = currentPerMuscle.get(muscle)! + (distribution[muscle] || 0);
        // Respect max 3 per muscle (4 for edge case)
        const maxPerMuscle = targetMuscles.length <= 2 ? 4 : 3;
        if (currentTotal < maxPerMuscle) {
          distribution[muscle] = (distribution[muscle] || 0) + 1;
          remainingSlots--;
        }
      }
    }
    
    // If other muscles are maxed out, give to the initially favored muscle
    if (remainingSlots > 0) {
      const currentTotal = currentPerMuscle.get(maxMuscle)! + (distribution[maxMuscle] || 0);
      const maxPerMuscle = targetMuscles.length <= 2 ? 4 : 3;
      if (currentTotal < maxPerMuscle) {
        distribution[maxMuscle] = (distribution[maxMuscle] || 0) + 1;
        remainingSlots--;
      } else {
        // All muscles maxed out
        break;
      }
    }
  }
  
  return distribution;
}

/**
 * Check if two distributions are equal
 */
function areDistributionsEqual(
  dist1: MuscleDistribution,
  dist2: MuscleDistribution
): boolean {
  const keys1 = Object.keys(dist1).sort();
  const keys2 = Object.keys(dist2).sort();
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (let i = 0; i < keys1.length; i++) {
    const key1 = keys1[i];
    const key2 = keys2[i];
    if (key1 && key2 && (key1 !== key2 || dist1[key1] !== dist2[key2])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Format distribution options for display
 */
export function formatDistributionOptions(
  options: MuscleDistribution[]
): string[] {
  return options.map(option => {
    const parts = Object.entries(option)
      .map(([muscle, count]) => `${count} ${muscle}`)
      .join(", ");
    return `Select: ${parts}`;
  });
}