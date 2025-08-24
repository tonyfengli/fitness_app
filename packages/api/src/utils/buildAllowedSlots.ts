/**
 * Build allowed slots for exercises based on tier priorities and equipment constraints
 */

import { ExerciseWithTier } from './exerciseTiers';
import { 
  ExerciseResources, 
  normalizeEquipmentToResources,
  isIndividuallyLegal,
  listIndividuallyLegalRounds,
  updateRoundCapacityUse
} from './equipmentConstraints';
import { EquipmentCapacityMap } from '../config/equipmentCapacity';
import { ClientRoundPlan } from './roundOrganization';

/**
 * Calculate equipment scarcity score for sorting
 * Lower capacity = lower score = higher priority
 * Bodyweight exercises (no equipment) get highest score to be processed last
 */
function getEquipmentScarcityScore(
  resources: ExerciseResources,
  capacityMap: EquipmentCapacityMap
): number {
  const equipmentKeys = Object.keys(resources);
  
  // Bodyweight exercises (no equipment) get highest score
  if (equipmentKeys.length === 0) {
    return Infinity;
  }
  
  // Find the scarcest equipment (lowest capacity)
  let lowestCapacity = Infinity;
  
  for (const equipment of equipmentKeys) {
    const capacity = (capacityMap as any)[equipment];
    if (capacity !== undefined && capacity < lowestCapacity) {
      lowestCapacity = capacity;
    }
  }
  
  return lowestCapacity;
}

/**
 * Get count of scarce equipment for tie-breaking
 * Counts equipment with capacity <= 3
 */
function getScarceEquipmentCount(
  resources: ExerciseResources,
  capacityMap: EquipmentCapacityMap
): number {
  const equipmentKeys = Object.keys(resources);
  let scarceCount = 0;
  
  for (const equipment of equipmentKeys) {
    const capacity = (capacityMap as any)[equipment];
    if (capacity !== undefined && capacity <= 3) {
      scarceCount++;
    }
  }
  
  return scarceCount;
}

export interface ExerciseWithResources extends ExerciseWithTier {
  resources: ExerciseResources;
}

export interface FixedAssignment {
  exerciseId: string;
  clientId: string;
  round: number;
  resources: ExerciseResources;
  fixedReason: 'tier_priority' | 'singleton' | 'singleton_cascade' | 'shared_exercise' | 'last_exercise_auto_assign';
  singletonIteration?: number;
  warning?: string;
}

export interface AllowedSlotsResult {
  fixedAssignments: FixedAssignment[];
  exerciseOptions: Array<{
    exerciseId: string;
    clientId: string;
    allowedRounds: number[];
    tier: number;
    resources: ExerciseResources;
    placementIssue?: 'singleton_no_slots' | 'shared_no_slots';
  }>;
  roundCapacityUse: ExerciseResources[];
  clientUsedSlots: Record<string, number[]>;
}

// Movement pattern categorization
const LOWER_BODY_PATTERNS = ['squat', 'lunge', 'hinge', 'leg_isolation'];
const UPPER_BODY_PATTERNS = ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_isolation', 'arm_isolation', 'carry'];
const CORE_PATTERN = 'core';

function isLowerBodyMovement(pattern: string | undefined): boolean {
  return !!pattern && LOWER_BODY_PATTERNS.includes(pattern.toLowerCase());
}

function isUpperBodyMovement(pattern: string | undefined): boolean {
  return !!pattern && UPPER_BODY_PATTERNS.includes(pattern.toLowerCase());
}

function isCoreMovement(pattern: string | undefined): boolean {
  return pattern?.toLowerCase() === CORE_PATTERN;
}

function isCapacityExercise(exercise: { functionTags?: string[] }): boolean {
  return exercise.functionTags?.includes('capacity') || false;
}

function isSimilarMovementPattern(pattern1: string | undefined, pattern2: string | undefined): boolean {
  if (!pattern1 || !pattern2) return false;
  
  // Both lower body or both upper body = similar
  return (isLowerBodyMovement(pattern1) && isLowerBodyMovement(pattern2)) ||
         (isUpperBodyMovement(pattern1) && isUpperBodyMovement(pattern2));
}

/**
 * Build allowed slots for all exercises
 * Phase 1: Pin each client's highest-tier exercise to Round 1
 * Phase 2: Assign shared exercises using cohort-based approach
 */
export function buildAllowedSlots(
  exercises: ExerciseWithTier[],
  clientPlans: ClientRoundPlan[],
  capacityMap: EquipmentCapacityMap,
  totalRounds: number
): AllowedSlotsResult {
  // Initialize tracking structures
  const fixedAssignments: FixedAssignment[] = [];
  const roundCapacityUse: ExerciseResources[] = Array(totalRounds).fill(null).map(() => ({}));
  const clientUsedSlots: Record<string, number[]> = {};
  
  // Initialize client used slots
  for (const plan of clientPlans) {
    clientUsedSlots[plan.clientId] = Array(totalRounds).fill(0);
  }
  
  // Convert exercises to include resources
  const exercisesWithResources: ExerciseWithResources[] = exercises.map(ex => ({
    ...ex,
    resources: normalizeEquipmentToResources(ex.equipment || [])
  }));
  
  // Track which exercises have been pinned (exerciseId + clientId combo)
  const pinnedExercises = new Set<string>();
  const getPinnedKey = (exerciseId: string, clientId: string) => `${exerciseId}:${clientId}`;
  
  // Phase 1: Pin each client's highest-tier exercise to Round 1
  const ROUND_ONE = 1;
  
  // Process each client
  for (const clientPlan of clientPlans) {
    const clientId = clientPlan.clientId;
    
    // Check if client can do exercises in Round 1
    const maxSlotsRound1 = clientPlan.bundleSkeleton?.[0] || 0;
    if (maxSlotsRound1 === 0) {
      continue;
    }
    
    // Get all exercises for this client
    const clientExercises = exercisesWithResources.filter(ex => ex.clientId === clientId);
    
    // Log if any capacity exercises are being excluded
    const capacityExercises = clientExercises.filter(ex => isCapacityExercise(ex));
    if (capacityExercises.length > 0) {
      console.log(`Client ${clientId} has ${capacityExercises.length} capacity exercises that will be excluded from Round 1`);
    }
    
    // Try to pin the best exercise for this client
    let exercisePinned = false;
    
    // Go through tiers in order: 1, 1.5, 2, 2.5, 3
    for (const tier of [1, 1.5, 2, 2.5, 3]) {
      if (exercisePinned) break;
      
      // Get all exercises of this tier, excluding capacity exercises
      const tierExercises = clientExercises.filter(ex => 
        ex.tier === tier && !isCapacityExercise(ex)
      );
      
      // Sort by equipment scarcity within the tier
      tierExercises.sort((a, b) => {
        const aScore = getEquipmentScarcityScore(a.resources, capacityMap);
        const bScore = getEquipmentScarcityScore(b.resources, capacityMap);
        if (aScore !== bScore) return aScore - bScore;
        return a.exerciseId.localeCompare(b.exerciseId);
      });
      
      // Try each exercise in this tier
      for (const exercise of tierExercises) {
        // Check if equipment is available
        let canPlace = true;
        
        for (const [equipment, needed] of Object.entries(exercise.resources)) {
          const currentUse = roundCapacityUse[0]?.[equipment] || 0;
          const capacity = capacityMap[equipment as keyof EquipmentCapacityMap] || 0;
          
          if (currentUse + needed > capacity) {
            canPlace = false;
            break;
          }
        }
        
        if (canPlace) {
          // Pin this exercise
          fixedAssignments.push({
            exerciseId: exercise.exerciseId,
            clientId: exercise.clientId,
            round: ROUND_ONE,
            resources: exercise.resources,
            fixedReason: 'tier_priority'
          });
          
          // Update capacity tracking
          for (const [equipment, needed] of Object.entries(exercise.resources)) {
            if (roundCapacityUse[0]) {
              roundCapacityUse[0][equipment] = (roundCapacityUse[0][equipment] || 0) + needed;
            }
          }
          
          // Mark as pinned
          pinnedExercises.add(getPinnedKey(exercise.exerciseId, exercise.clientId));
          clientUsedSlots[clientId] = clientUsedSlots[clientId] || Array(totalRounds).fill(0);
          const currentSlots = clientUsedSlots[clientId];
          currentSlots[0] = (currentSlots[0] || 0) + 1;
          
          exercisePinned = true;
          break;
        }
      }
    }
  }
  
  // Log Phase 1 results
  console.log('=== PHASE 1 RESULTS ===');
  console.log(`Total exercises pinned in Phase 1: ${pinnedExercises.size}`);
  fixedAssignments.forEach(fa => {
    console.log(`  - ${fa.clientId} R${fa.round}: ${fa.exerciseId} (${fa.fixedReason})`);
  });
  
  // Phase 2: Detect and assign shared exercises
  
  // Group exercises by exerciseId to find shared ones
  const exerciseGroups = new Map<string, ExerciseWithResources[]>();
  for (const exercise of exercisesWithResources) {
    if (!exerciseGroups.has(exercise.exerciseId)) {
      exerciseGroups.set(exercise.exerciseId, []);
    }
    exerciseGroups.get(exercise.exerciseId)!.push(exercise);
  }
  
  // Find shared exercises (2+ clients with same exercise)
  const sharedExerciseGroups = Array.from(exerciseGroups.entries())
    .filter(([_, group]) => group.length >= 2)
    .map(([exerciseId, group]) => ({
      exerciseId,
      clients: group,
      resources: group[0]?.resources || {}, // All should have same resources
      movementPattern: group[0]?.movementPattern,
      functionTags: group[0]?.functionTags,
      equipmentCount: Object.keys(group[0]?.resources || {}).length,
      equipmentScarcity: getEquipmentScarcityScore(group[0]?.resources || {}, capacityMap)
    }));
  
  // Sort shared exercises to maximize successful placements
  sharedExerciseGroups.sort((a, b) => {
    // 1. Prioritize core and capacity exercises (they target last round, so process together)
    const aIsLastRound = isCoreMovement(a.movementPattern) || isCapacityExercise(a);
    const bIsLastRound = isCoreMovement(b.movementPattern) || isCapacityExercise(b);
    if (aIsLastRound !== bIsLastRound) {
      return aIsLastRound ? -1 : 1; // Core/capacity exercises first
    }
    
    // 2. Within same movement type, prioritize by equipment constraints
    // Fewer equipment pieces = easier to place
    if (a.equipmentCount !== b.equipmentCount) {
      return a.equipmentCount - b.equipmentCount;
    }
    
    // 3. If same equipment count, prioritize less scarce equipment
    // Higher scarcity score = less scarce = easier to place
    if (a.equipmentScarcity !== b.equipmentScarcity) {
      return b.equipmentScarcity - a.equipmentScarcity;
    }
    
    // 4. Finally, prioritize exercises shared by more clients
    return b.clients.length - a.clients.length;
  });
  
  // Process each shared exercise group
  for (const sharedGroup of sharedExerciseGroups) {
    // Skip if any client already has this exercise pinned
    if (sharedGroup.clients.some(ex => pinnedExercises.has(getPinnedKey(ex.exerciseId, ex.clientId)))) {
      continue;
    }
    
    // Filter out clients who have no available slots in any round
    const availableClients = sharedGroup.clients.filter(client => {
      // Check if client has at least one round available
      for (let r = 1; r <= totalRounds; r++) {
        const roundIndex = r - 1;
        const clientPlan = clientPlans.find(p => p.clientId === client.clientId);
        const maxSlots = clientPlan?.bundleSkeleton?.[roundIndex] || 0;
        const usedSlots = clientUsedSlots[client.clientId]?.[roundIndex] || 0;
        if (usedSlots < maxSlots) return true; // Client has at least one slot available
      }
      return false; // Client has no slots available
    });
    
    // Skip if we don't have at least 2 clients who can participate
    if (availableClients.length < 2) {
      console.log(`Skipping shared exercise ${sharedGroup.exerciseId} - only ${availableClients.length} clients have available slots`);
      // Don't process as shared, but these exercises will be available for singleton processing
      continue;
    }
    
    // Update the sharedGroup to only include available clients
    sharedGroup.clients = availableClients;
    
    // Get R1 movement patterns for all participating clients
    const clientR1Movements = new Map<string, string>();
    for (const client of sharedGroup.clients) {
      const r1Assignment = fixedAssignments.find(
        a => a.clientId === client.clientId && a.round === 1
      );
      if (r1Assignment) {
        // Find the movement pattern for this R1 exercise
        const r1Exercise = exercisesWithResources.find(
          ex => ex.exerciseId === r1Assignment.exerciseId && ex.clientId === r1Assignment.clientId
        );
        if (r1Exercise?.movementPattern) {
          clientR1Movements.set(client.clientId, r1Exercise.movementPattern);
        }
      }
    }
    
    // Determine target round based on baseline rules
    let targetRound: number;
    if (isCoreMovement(sharedGroup.movementPattern) || isCapacityExercise(sharedGroup)) {
      // For core and capacity exercises, find the minimum last round among all participating clients
      // Note: Capacity exercises are excluded from Round 1 in Phase 1
      let minLastRound = totalRounds;
      for (const client of sharedGroup.clients) {
        const clientPlan = clientPlans.find(p => p.clientId === client.clientId);
        if (clientPlan?.bundleSkeleton) {
          // Find the last round this client participates in
          let clientLastRound = 0;
          for (let i = clientPlan.bundleSkeleton.length - 1; i >= 0; i--) {
            if ((clientPlan.bundleSkeleton[i] ?? 0) > 0) {
              clientLastRound = i + 1; // Convert to 1-based
              break;
            }
          }
          if (clientLastRound > 0 && clientLastRound < minLastRound) {
            minLastRound = clientLastRound;
          }
        }
      }
      targetRound = minLastRound; // Core and capacity exercises go to minimum last round
    } else {
      // Check if similar movement to any client's R1
      const hasSimilarToR1 = Array.from(clientR1Movements.values()).some(
        r1Pattern => isSimilarMovementPattern(sharedGroup.movementPattern, r1Pattern)
      );
      targetRound = hasSimilarToR1 ? 3 : 2;
    }
    
    // Calculate cohort size based on equipment constraints
    let limitingCapacity = Infinity;
    let limitingEquipment = '';
    
    for (const [equipment, needed] of Object.entries(sharedGroup.resources)) {
      const capacity = capacityMap[equipment as keyof EquipmentCapacityMap];
      if (capacity !== undefined && capacity < limitingCapacity) {
        limitingCapacity = capacity;
        limitingEquipment = equipment;
      }
    }
    
    // If no equipment (bodyweight), cohort size is unlimited
    const cohortSize = Object.keys(sharedGroup.resources).length === 0 
      ? sharedGroup.clients.length 
      : limitingCapacity;
    
    // Calculate number of cohorts needed
    const numCohorts = Math.ceil(sharedGroup.clients.length / cohortSize);
    
    // Assign cohorts to rounds
    let currentRound = targetRound;
    let cohortsAssigned = 0;
    const warningMessages: string[] = [];
    
    for (let cohortIndex = 0; cohortIndex < numCohorts; cohortIndex++) {
      // Get clients for this cohort
      const cohortStart = cohortIndex * cohortSize;
      const cohortEnd = Math.min(cohortStart + cohortSize, sharedGroup.clients.length);
      const cohortClients = sharedGroup.clients.slice(cohortStart, cohortEnd);
      
      // Try to find a round with capacity for this cohort
      let roundFound = false;
      let attemptedRound = currentRound;
      
      while (attemptedRound <= totalRounds && !roundFound) {
        const roundIndex = attemptedRound - 1;
        
        // Check if all clients in cohort can fit in this round
        let canPlaceCohort = true;
        
        // Check client slot availability
        for (const client of cohortClients) {
          const clientPlan = clientPlans.find(p => p.clientId === client.clientId);
          const maxSlots = clientPlan?.bundleSkeleton?.[roundIndex] || 0;
          const usedSlots = clientUsedSlots[client.clientId]?.[roundIndex] || 0;
          
          if (usedSlots >= maxSlots) {
            canPlaceCohort = false;
            break;
          }
        }
        
        // Check equipment capacity
        if (canPlaceCohort) {
          for (const [equipment, needed] of Object.entries(sharedGroup.resources)) {
            const currentUse = roundCapacityUse[roundIndex]?.[equipment] || 0;
            const capacity = capacityMap[equipment as keyof EquipmentCapacityMap] || 0;
            const totalNeeded = needed * cohortClients.length;
            
            if (currentUse + totalNeeded > capacity) {
              canPlaceCohort = false;
              break;
            }
          }
        }
        
        if (canPlaceCohort) {
          // Assign this cohort to this round
          for (const client of cohortClients) {
            fixedAssignments.push({
              exerciseId: client.exerciseId,
              clientId: client.clientId,
              round: attemptedRound,
              resources: client.resources,
              fixedReason: 'shared_exercise',
              warning: attemptedRound !== targetRound && cohortIndex === 0 
                ? `Moved from R${targetRound} to R${attemptedRound} due to client slot availability`
                : undefined
            });
            
            // Update tracking
            pinnedExercises.add(getPinnedKey(client.exerciseId, client.clientId));
            const clientSlots = clientUsedSlots[client.clientId];
            if (clientSlots && clientSlots[roundIndex] !== undefined) {
              clientSlots[roundIndex]++;
            }
            
            // Update capacity use
            for (const [equipment, needed] of Object.entries(client.resources)) {
              if (roundCapacityUse[roundIndex]) {
                roundCapacityUse[roundIndex][equipment] = 
                  (roundCapacityUse[roundIndex]?.[equipment] || 0) + needed;
              }
            }
          }
          
          roundFound = true;
          cohortsAssigned++;
          
          // If this wasn't the target round, add a warning
          if (attemptedRound !== targetRound && cohortIndex === 0) {
            warningMessages.push(
              `Shared exercise moved from R${targetRound} to R${attemptedRound} due to capacity`
            );
          }
        } else {
          attemptedRound++;
        }
      }
      
      // If we couldn't find a round, log warning but don't force assignment
      if (!roundFound && attemptedRound > totalRounds) {
        console.warn(
          `Could not place shared exercise ${sharedGroup.exerciseId} for cohort ${cohortIndex + 1}. ` +
          `Clients affected: ${cohortClients.map(c => c.clientId).join(', ')}`
        );
        // These clients will have this exercise available for LLM selection instead
      }
      
      // Update current round for next cohort
      currentRound = attemptedRound;
    }
    
    // Log warnings if any (these would be shown in UI)
    if (warningMessages.length > 0) {
      console.warn('Shared exercise assignment warnings:', warningMessages);
    }
  }
  
  // Log Phase 2 results
  console.log('=== PHASE 2 RESULTS ===');
  const phase2Assignments = fixedAssignments.filter(fa => fa.fixedReason === 'shared_exercise');
  console.log(`Total exercises pinned in Phase 2: ${phase2Assignments.length}`);
  phase2Assignments.forEach(fa => {
    console.log(`  - ${fa.clientId} R${fa.round}: ${fa.exerciseId} (${fa.fixedReason})`);
  });
  console.log(`Total pinned after Phase 2: ${pinnedExercises.size}`);
  
  // Track exercises that failed placement
  const failedPlacements = new Map<string, 'singleton_no_slots' | 'shared_no_slots'>();
  
  // Phase 3: Process singleton exercises (equipment with capacity = 1)
  
  // Find remaining exercises that use singleton equipment
  const remainingExercises = exercisesWithResources.filter(ex => !pinnedExercises.has(getPinnedKey(ex.exerciseId, ex.clientId)));
  
  console.log('=== PHASE 3: SINGLETON EXERCISE DETECTION ===');
  console.log(`Total remaining exercises: ${remainingExercises.length}`);
  
  // Log all remaining exercises with their equipment
  console.log('Remaining exercises:');
  remainingExercises.forEach(ex => {
    console.log(`  - ${ex.name || ex.exerciseId} (${ex.clientId}) - Equipment: ${JSON.stringify(ex.resources)}, Tier: ${ex.tier}`);
  });
  
  // Log equipment capacities for singleton equipment
  const singletonEquipment = Object.entries(capacityMap).filter(([_, cap]) => cap === 1);
  console.log('Singleton equipment (capacity = 1):', singletonEquipment.map(([eq, cap]) => `${eq}:${cap}`).join(', '));
  
  // Group by equipment that has capacity = 1
  const singletonExercises = remainingExercises.filter(exercise => {
    // Check if any equipment used has capacity = 1
    const hasSingletonEquipment = Object.entries(exercise.resources).some(([equipment, _]) => {
      const capacity = capacityMap[equipment as keyof EquipmentCapacityMap];
      return capacity === 1;
    });
    
    if (hasSingletonEquipment) {
      console.log(`Found singleton exercise: ${exercise.name || exercise.exerciseId} (${exercise.clientId}) - Equipment: ${JSON.stringify(exercise.resources)}`);
    }
    
    return hasSingletonEquipment;
  });
  
  console.log(`Total singleton exercises found: ${singletonExercises.length}`);
  
  
  // Sort singleton exercises by tier and equipment scarcity
  singletonExercises.sort((a, b) => {
    // Sort by tier first (lower tier = higher priority)
    if (a.tier !== b.tier) return a.tier - b.tier;
    
    // Then by equipment scarcity
    const aScore = getEquipmentScarcityScore(a.resources, capacityMap);
    const bScore = getEquipmentScarcityScore(b.resources, capacityMap);
    if (aScore !== bScore) return aScore - bScore;
    
    // Finally by exerciseId for consistency
    return a.exerciseId.localeCompare(b.exerciseId);
  });
  
  // Process each singleton exercise
  for (const exercise of singletonExercises) {
    // Skip if already pinned
    if (pinnedExercises.has(getPinnedKey(exercise.exerciseId, exercise.clientId))) {
      continue;
    }
    
    // Get client's R1 movement pattern
    const r1Assignment = fixedAssignments.find(
      a => a.clientId === exercise.clientId && a.round === 1
    );
    let r1MovementPattern: string | undefined;
    if (r1Assignment) {
      const r1Exercise = exercisesWithResources.find(
        ex => ex.exerciseId === r1Assignment.exerciseId && ex.clientId === r1Assignment.clientId
      );
      r1MovementPattern = r1Exercise?.movementPattern;
    }
    
    // Determine target round based on baseline rules
    let targetRound: number;
    if (isCoreMovement(exercise.movementPattern)) {
      targetRound = 5; // Core exercises go to R5
    } else if (r1MovementPattern && isSimilarMovementPattern(exercise.movementPattern, r1MovementPattern)) {
      targetRound = 3; // Similar movement to R1 goes to R3
    } else {
      targetRound = 2; // Different movement from R1 goes to R2
    }
    
    // Try to place in target round or next available
    let placed = false;
    for (let round = targetRound; round <= totalRounds && !placed; round++) {
      const roundIndex = round - 1;
      
      // Check client slot availability
      const clientPlan = clientPlans.find(p => p.clientId === exercise.clientId);
      const maxSlots = clientPlan?.bundleSkeleton?.[roundIndex] || 0;
      const usedSlots = clientUsedSlots[exercise.clientId]?.[roundIndex] || 0;
      
      if (usedSlots >= maxSlots) continue;
      
      // Check equipment capacity
      let canPlace = true;
      for (const [equipment, needed] of Object.entries(exercise.resources)) {
        const currentUse = roundCapacityUse[roundIndex]?.[equipment] || 0;
        const capacity = capacityMap[equipment as keyof EquipmentCapacityMap] || 0;
        
        if (currentUse + needed > capacity) {
          canPlace = false;
          break;
        }
      }
      
      if (canPlace) {
        // Place the singleton exercise
        fixedAssignments.push({
          exerciseId: exercise.exerciseId,
          clientId: exercise.clientId,
          round: round,
          resources: exercise.resources,
          fixedReason: 'singleton',
          warning: round !== targetRound 
            ? `Moved from R${targetRound} to R${round} due to availability`
            : undefined
        });
        
        // Update tracking
        pinnedExercises.add(getPinnedKey(exercise.exerciseId, exercise.clientId));
        const exerciseClientSlots = clientUsedSlots[exercise.clientId];
        if (exerciseClientSlots && exerciseClientSlots[roundIndex] !== undefined) {
          exerciseClientSlots[roundIndex]++;
        }
        
        // Update capacity use
        for (const [equipment, needed] of Object.entries(exercise.resources)) {
          if (roundCapacityUse[roundIndex]) {
            roundCapacityUse[roundIndex][equipment] = 
              (roundCapacityUse[roundIndex]?.[equipment] || 0) + needed;
          }
        }
        
        placed = true;
      }
    }
    
    if (!placed) {
      console.warn(
        `Could not place singleton exercise ${exercise.name || exercise.exerciseId} for client ${exercise.clientId}. ` +
        `Equipment constraints too restrictive.`
      );
      // Track this failed placement
      failedPlacements.set(getPinnedKey(exercise.exerciseId, exercise.clientId), 'singleton_no_slots');
    }
  }
  
  // Update remaining exercises to exclude processed singletons
  const finalRemainingExercises = exercisesWithResources.filter(ex => !pinnedExercises.has(getPinnedKey(ex.exerciseId, ex.clientId)));
  const exerciseOptions = finalRemainingExercises.map(exercise => {
    // Calculate allowed rounds based on client slots and capacity
    const allowedRounds: number[] = [];
    const clientPlan = clientPlans.find(p => p.clientId === exercise.clientId);
    
    for (let round = 1; round <= totalRounds; round++) {
      const roundIndex = round - 1;
      const maxSlots = clientPlan?.bundleSkeleton?.[roundIndex] || 0;
      const usedSlots = clientUsedSlots[exercise.clientId]?.[roundIndex] || 0;
      
      // Check client has slot
      if (usedSlots >= maxSlots) continue;
      
      // Check equipment capacity
      let hasCapacity = true;
      for (const [equipment, needed] of Object.entries(exercise.resources)) {
        const currentUse = roundCapacityUse[roundIndex]?.[equipment] || 0;
        const capacity = capacityMap[equipment as keyof EquipmentCapacityMap] || 0;
        
        if (currentUse + needed > capacity) {
          hasCapacity = false;
          break;
        }
      }
      
      if (hasCapacity) {
        allowedRounds.push(round);
      }
    }
    
    const key = getPinnedKey(exercise.exerciseId, exercise.clientId);
    const placementIssue = failedPlacements.get(key);
    
    return {
      exerciseId: exercise.exerciseId,
      clientId: exercise.clientId,
      allowedRounds: allowedRounds.length > 0 ? allowedRounds : [1], // Fallback to R1 if no rounds available
      tier: exercise.tier,
      resources: exercise.resources,
      ...(placementIssue && { placementIssue })
    };
  });
  
  // Phase 4: Last Exercise Auto-Assignment
  // If a client has exactly 1 unassigned exercise and only 1 available slot, auto-assign it
  console.log('=== PHASE 4: LAST EXERCISE AUTO-ASSIGNMENT ===');
  
  // Group remaining exercises by client
  const clientRemainingExercises = new Map<string, ExerciseWithResources[]>();
  for (const exercise of finalRemainingExercises) {
    if (!clientRemainingExercises.has(exercise.clientId)) {
      clientRemainingExercises.set(exercise.clientId, []);
    }
    clientRemainingExercises.get(exercise.clientId)!.push(exercise);
  }
  
  // Check each client
  for (const [clientId, remainingExercises] of clientRemainingExercises) {
    // Only process if client has exactly 1 exercise left
    if (remainingExercises.length !== 1) {
      continue;
    }
    
    const exercise = remainingExercises[0];
    const clientPlan = clientPlans.find(p => p.clientId === clientId);
    if (!clientPlan) continue;
    
    // Count available slots for this client
    const availableSlots: number[] = [];
    for (let round = 1; round <= totalRounds; round++) {
      const roundIndex = round - 1;
      const maxSlots = clientPlan.bundleSkeleton?.[roundIndex] || 0;
      const usedSlots = clientUsedSlots[clientId]?.[roundIndex] || 0;
      
      if (usedSlots < maxSlots) {
        availableSlots.push(round);
      }
    }
    
    // If exactly 1 slot available, auto-assign
    if (availableSlots.length === 1 && exercise) {
      const targetRound = availableSlots[0]!;
      const roundIndex = targetRound - 1;
      
      console.log(`Client ${clientId} has 1 exercise (${exercise.name || exercise.exerciseId}) and 1 slot (R${targetRound}) - auto-assigning`);
      
      // Create fixed assignment (ignoring capacity constraints)
      fixedAssignments.push({
        exerciseId: exercise.exerciseId,
        clientId: exercise.clientId,
        round: targetRound,
        resources: exercise.resources,
        fixedReason: 'last_exercise_auto_assign',
        warning: 'Auto-assigned last exercise to only available slot (capacity constraints ignored)'
      });
      
      // Update tracking
      pinnedExercises.add(getPinnedKey(exercise.exerciseId, exercise.clientId));
      if (clientUsedSlots[clientId]?.[roundIndex] !== undefined) {
        clientUsedSlots[clientId]![roundIndex]++;
      }
      
      // Update capacity use (even though we're ignoring constraints, we still track usage)
      for (const [equipment, needed] of Object.entries(exercise.resources)) {
        if (roundCapacityUse[roundIndex]) {
          roundCapacityUse[roundIndex][equipment] = 
            (roundCapacityUse[roundIndex]?.[equipment] || 0) + needed;
        }
      }
      
      // Remove from exerciseOptions
      const optionIndex = exerciseOptions.findIndex(
        opt => opt.exerciseId === exercise.exerciseId && opt.clientId === exercise.clientId
      );
      if (optionIndex >= 0) {
        exerciseOptions.splice(optionIndex, 1);
      }
    }
  }
  
  // Log Phase 4 results
  const phase4Assignments = fixedAssignments.filter(fa => fa.fixedReason === 'last_exercise_auto_assign');
  console.log(`Total exercises auto-assigned in Phase 4: ${phase4Assignments.length}`);
  phase4Assignments.forEach(fa => {
    console.log(`  - ${fa.clientId} R${fa.round}: ${fa.exerciseId} (${fa.fixedReason})`);
  });
  
  return {
    fixedAssignments,
    exerciseOptions,
    roundCapacityUse,
    clientUsedSlots
  };
}