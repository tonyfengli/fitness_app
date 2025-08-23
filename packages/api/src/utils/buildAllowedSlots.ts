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
  fixedReason: 'tier_priority' | 'singleton' | 'singleton_cascade' | 'shared_exercise';
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
    
    // Try to pin the best exercise for this client
    let exercisePinned = false;
    
    // Go through tiers in order: 1, 1.5, 2, 3
    for (const tier of [1, 1.5, 2, 3]) {
      if (exercisePinned) break;
      
      // Get all exercises of this tier
      const tierExercises = clientExercises.filter(ex => ex.tier === tier);
      
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
          const currentUse = roundCapacityUse[0][equipment] || 0;
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
            roundCapacityUse[0][equipment] = (roundCapacityUse[0][equipment] || 0) + needed;
          }
          
          // Mark as pinned
          pinnedExercises.add(getPinnedKey(exercise.exerciseId, exercise.clientId));
          clientUsedSlots[clientId] = clientUsedSlots[clientId] || Array(totalRounds).fill(0);
          clientUsedSlots[clientId][0]++;
          
          exercisePinned = true;
          break;
        }
      }
    }
  }
  
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
      resources: group[0].resources, // All should have same resources
      movementPattern: group[0].movementPattern,
      equipmentCount: Object.keys(group[0].resources).length,
      equipmentScarcity: getEquipmentScarcityScore(group[0].resources, capacityMap)
    }));
  
  // Sort shared exercises to maximize successful placements
  sharedExerciseGroups.sort((a, b) => {
    // 1. Prioritize core exercises (they all target R5, so process together)
    const aIsCore = isCoreMovement(a.movementPattern);
    const bIsCore = isCoreMovement(b.movementPattern);
    if (aIsCore !== bIsCore) {
      return aIsCore ? -1 : 1; // Core exercises first
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
    if (isCoreMovement(sharedGroup.movementPattern)) {
      targetRound = 5; // Core exercises go to R5
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
            const currentUse = roundCapacityUse[roundIndex][equipment] || 0;
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
            clientUsedSlots[client.clientId][roundIndex]++;
            
            // Update capacity use
            for (const [equipment, needed] of Object.entries(client.resources)) {
              roundCapacityUse[roundIndex][equipment] = 
                (roundCapacityUse[roundIndex][equipment] || 0) + needed;
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
  
  // Process remaining exercises that aren't shared or pinned
  const remainingExercises = exercisesWithResources.filter(ex => !pinnedExercises.has(getPinnedKey(ex.exerciseId, ex.clientId)));
  const exerciseOptions = remainingExercises.map(exercise => {
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
        const currentUse = roundCapacityUse[roundIndex][equipment] || 0;
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
    
    return {
      exerciseId: exercise.exerciseId,
      clientId: exercise.clientId,
      allowedRounds: allowedRounds.length > 0 ? allowedRounds : [1], // Fallback to R1 if no rounds available
      tier: exercise.tier,
      resources: exercise.resources
    };
  });
  
  return {
    fixedAssignments,
    exerciseOptions,
    roundCapacityUse,
    clientUsedSlots
  };
}