export interface ClientRoundPlan {
  clientId: string;
  totalExercises: number;
  roundsParticipating: number;
  supersetsNeeded: number;
  dropOffAfterRound: number | null;
  bundleSkeleton?: number[];
  supersetRounds?: number[];
}

export interface RoundOrganizationResult {
  majorityRounds: number;
  clientExerciseCounts: Array<{
    clientId: string;
    count: number;
  }>;
  perClientPlan: ClientRoundPlan[];
}

/**
 * Calculate the median of an array of numbers
 */
function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.ceil((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * Find the majority (mode) in an array. If no clear majority, return null.
 */
function findMajority(numbers: number[]): number | null {
  const frequency: Record<number, number> = {};
  let maxFreq = 0;
  let mode: number | null = null;
  
  for (const num of numbers) {
    frequency[num] = (frequency[num] || 0) + 1;
    if (frequency[num] > maxFreq) {
      maxFreq = frequency[num];
      mode = num;
    }
  }
  
  // Check if there's a clear majority (appears more than once and more than other values)
  const modes = Object.entries(frequency).filter(([_, freq]) => freq === maxFreq);
  if (modes.length === 1 && maxFreq > 1) {
    return mode;
  }
  
  return null;
}

/**
 * Calculate bundle skeleton for a single client
 */
function calculateClientBundleSkeleton(
  plan: ClientRoundPlan,
  majorityRounds: number
): { bundleSkeleton: number[]; supersetRounds: number[] } {
  // Initialize skeleton with base fill
  const skeleton: number[] = new Array(majorityRounds).fill(0);
  
  // Fill active rounds with 1s
  for (let i = 0; i < plan.roundsParticipating; i++) {
    skeleton[i] = 1;
  }
  
  // If no supersets needed, we're done
  if (plan.supersetsNeeded === 0) {
    return { bundleSkeleton: skeleton, supersetRounds: [] };
  }
  
  // Build eligible rounds (excluding Round 1, only active rounds)
  const eligible: number[] = [];
  for (let round = 2; round <= plan.roundsParticipating; round++) {
    eligible.push(round);
  }
  
  const n = eligible.length;
  const k = plan.supersetsNeeded;
  
  // Calculate ideal positions using even spacing
  const idealPositions: number[] = [];
  for (let j = 1; j <= k; j++) {
    const pos = Math.round(j * (n + 1) / (k + 1));
    // Clamp to valid range [1, n]
    const clampedPos = Math.max(1, Math.min(n, pos));
    idealPositions.push(clampedPos);
  }
  
  // Map to actual round numbers
  const candidateRounds = idealPositions.map(pos => eligible[pos - 1]);
  
  // Place supersets with back-to-back prevention
  const supersetRounds: number[] = [];
  const usedRounds = new Set<number>();
  
  for (const candidate of candidateRounds) {
    // Check if this would create back-to-back supersets
    const wouldBeBackToBack = 
      usedRounds.has(candidate - 1) || 
      usedRounds.has(candidate + 1);
    
    if (!wouldBeBackToBack) {
      // Safe to place here
      usedRounds.add(candidate);
      supersetRounds.push(candidate);
    } else {
      // Find alternative placement
      let placed = false;
      
      // Try later rounds first (preference)
      for (let round = plan.roundsParticipating; round >= 2; round--) {
        if (!usedRounds.has(round) && 
            !usedRounds.has(round - 1) && 
            !usedRounds.has(round + 1)) {
          usedRounds.add(round);
          supersetRounds.push(round);
          placed = true;
          break;
        }
      }
      
      // If no later round works, try earlier rounds
      if (!placed) {
        for (let round = 2; round <= plan.roundsParticipating; round++) {
          if (!usedRounds.has(round)) {
            usedRounds.add(round);
            supersetRounds.push(round);
            break;
          }
        }
      }
    }
  }
  
  // Update skeleton with supersets
  for (const round of supersetRounds) {
    skeleton[round - 1] = 2;
  }
  
  // Sort superset rounds for consistent output
  supersetRounds.sort((a, b) => a - b);
  
  return { bundleSkeleton: skeleton, supersetRounds };
}

/**
 * Calculate bundle skeletons for all clients
 */
export function calculateBundleSkeletons(
  roundOrganization: RoundOrganizationResult
): RoundOrganizationResult {
  const updatedPlans = roundOrganization.perClientPlan.map(plan => {
    const { bundleSkeleton, supersetRounds } = calculateClientBundleSkeleton(
      plan,
      roundOrganization.majorityRounds
    );
    
    return {
      ...plan,
      bundleSkeleton,
      supersetRounds
    };
  });
  
  return {
    ...roundOrganization,
    perClientPlan: updatedPlans
  };
}

/**
 * Calculate round organization for group workouts
 */
export function calculateRoundOrganization(
  clientData: Array<{ clientId: string; exerciseCount: number }>
): RoundOrganizationResult {
  const exerciseCounts = clientData.map(c => c.exerciseCount);
  
  // Determine majority rounds
  const majority = findMajority(exerciseCounts);
  const majorityRounds = majority !== null ? majority : calculateMedian(exerciseCounts);
  
  // Calculate per-client plans
  const perClientPlan: ClientRoundPlan[] = clientData.map(client => {
    const { clientId, exerciseCount } = client;
    
    // Clients with fewer exercises than majority rounds participate in fewer rounds
    const roundsParticipating = Math.min(exerciseCount, majorityRounds);
    
    // Calculate supersets needed
    // If exercises > rounds, we need supersets
    // Max 2 exercises per round, no triple supersets allowed
    let supersetsNeeded = 0;
    if (exerciseCount > majorityRounds) {
      // We need to fit exerciseCount exercises into majorityRounds rounds
      // With max 2 per round, we can handle up to 2 * majorityRounds exercises
      const maxExercisesWeCanHandle = 2 * majorityRounds;
      
      if (exerciseCount > maxExercisesWeCanHandle) {
        throw new Error(
          `Client ${clientId} has ${exerciseCount} exercises but can only handle ${maxExercisesWeCanHandle} ` +
          `exercises in ${majorityRounds} rounds with max 2 exercises per round. No triple supersets allowed.`
        );
      }
      
      // Number of rounds that need supersets
      supersetsNeeded = exerciseCount - majorityRounds;
    }
    
    // Drop off calculation
    const dropOffAfterRound = roundsParticipating < majorityRounds 
      ? roundsParticipating + 1  // First round they miss
      : null;
    
    return {
      clientId,
      totalExercises: exerciseCount,
      roundsParticipating,
      supersetsNeeded,
      dropOffAfterRound
    };
  });
  
  return {
    majorityRounds,
    clientExerciseCounts: clientData.map(c => ({
      clientId: c.clientId,
      count: c.exerciseCount
    })),
    perClientPlan
  };
}