/**
 * Equipment Constraints Unit
 * Pure functions for checking equipment capacity and client slot availability
 */

import { EquipmentCapacityMap } from '../config/equipmentCapacity';

export interface ExerciseResources {
  [resourceKey: string]: number;
}

export interface LegalityCheckResult {
  ok: boolean;
  reason?: 'CLIENT_SLOT' | 'CAPACITY';
  shortfall?: Array<{
    key: string;
    need: number;
    have: number;
    cap: number;
  }>;
}

/**
 * Normalize exercise equipment array to resource map
 * Examples:
 * ["dumbbells"] → { dumbbells: 1 }
 * ["dumbbells", "bench"] → { dumbbells: 1, bench: 1 }
 * ["platform", "barbell"] → { barbell: 1 } (platform is unmetered)
 */
export function normalizeEquipmentToResources(equipment: string[]): ExerciseResources {
  const resources: ExerciseResources = {};
  
  for (const item of equipment) {
    const normalized = item.toLowerCase();
    
    // Skip platform as it's unmetered
    if (normalized === 'platform') {
      continue;
    }
    
    // Default to 1 unit per equipment type
    resources[normalized] = 1;
  }
  
  return resources;
}

/**
 * Check if client has available slot in the round
 * @param maxSlots - Maximum slots from skeleton (0, 1, or 2)
 * @param usedSlots - Already used slots from fixed assignments
 * @returns true if client can add another exercise
 */
export function isClientSlotAvailable(maxSlots: number, usedSlots: number): boolean {
  return usedSlots < maxSlots;
}

/**
 * Check if resources fit within round's capacity
 * @param resources - Equipment needed by the exercise
 * @param roundCapacityUse - Current usage in the round
 * @param capacityMap - Gym's equipment limits
 * @returns true if all resources fit
 */
export function hasCapacityFor(
  resources: ExerciseResources,
  roundCapacityUse: ExerciseResources,
  capacityMap: EquipmentCapacityMap
): boolean {
  // Empty resources (bodyweight/core) always pass
  if (Object.keys(resources).length === 0) {
    return true;
  }

  // Check each required resource
  for (const [key, need] of Object.entries(resources)) {
    const currentUse = roundCapacityUse[key] || 0;
    const capacity = (capacityMap as any)[key];
    
    // If key not in capacity map, treat as unlimited
    if (capacity === undefined) {
      continue;
    }
    
    // If capacity is 0, this equipment is not available
    if (capacity === 0) {
      return false;
    }
    
    // Check if adding this exercise would exceed capacity
    if (currentUse + need > capacity) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if an exercise can legally be placed in a specific round
 * @param exercise - Exercise with resources
 * @param round - 1-based round number
 * @param clientMaxSlots - Max slots per round for this client
 * @param clientUsedSlots - Used slots per round for this client
 * @param roundCapacityUse - Equipment usage per round
 * @param capacityMap - Gym equipment limits
 */
export function isIndividuallyLegal(
  exercise: { resources: ExerciseResources },
  round: number,
  clientMaxSlots: number[],
  clientUsedSlots: number[],
  roundCapacityUse: ExerciseResources[],
  capacityMap: EquipmentCapacityMap
): LegalityCheckResult {
  const roundIndex = round - 1; // Convert to 0-based
  
  // Check client slot availability
  const maxSlots = clientMaxSlots[roundIndex] || 0;
  const usedSlots = clientUsedSlots[roundIndex] || 0;
  
  if (!isClientSlotAvailable(maxSlots, usedSlots)) {
    return {
      ok: false,
      reason: 'CLIENT_SLOT'
    };
  }
  
  // Check equipment capacity
  const currentRoundUse = roundCapacityUse[roundIndex] || {};
  
  if (!hasCapacityFor(exercise.resources, currentRoundUse, capacityMap)) {
    // Calculate shortfall details
    const shortfall: LegalityCheckResult['shortfall'] = [];
    
    for (const [key, need] of Object.entries(exercise.resources)) {
      const currentUse = currentRoundUse[key] || 0;
      const capacity = (capacityMap as any)[key] || Infinity;
      
      if (capacity !== Infinity && currentUse + need > capacity) {
        shortfall.push({
          key,
          need,
          have: capacity - currentUse,
          cap: capacity
        });
      }
    }
    
    return {
      ok: false,
      reason: 'CAPACITY',
      shortfall
    };
  }
  
  return { ok: true };
}

/**
 * List all rounds where an exercise can legally be placed
 * @param exercise - Exercise with resources
 * @param rounds - Array of 1-based round numbers to check
 * @param clientMaxSlots - Max slots per round for this client
 * @param clientUsedSlots - Used slots per round for this client
 * @param roundCapacityUse - Equipment usage per round
 * @param capacityMap - Gym equipment limits
 * @returns Array of 1-based round numbers where placement is legal
 */
export function listIndividuallyLegalRounds(
  exercise: { resources: ExerciseResources },
  rounds: number[],
  clientMaxSlots: number[],
  clientUsedSlots: number[],
  roundCapacityUse: ExerciseResources[],
  capacityMap: EquipmentCapacityMap
): number[] {
  const legalRounds: number[] = [];
  
  for (const round of rounds) {
    const result = isIndividuallyLegal(
      exercise,
      round,
      clientMaxSlots,
      clientUsedSlots,
      roundCapacityUse,
      capacityMap
    );
    
    if (result.ok) {
      legalRounds.push(round);
    }
  }
  
  return legalRounds;
}

/**
 * Update round capacity usage after assigning an exercise
 * Returns a new object, doesn't mutate the input
 */
export function updateRoundCapacityUse(
  currentUse: ExerciseResources,
  exerciseResources: ExerciseResources
): ExerciseResources {
  const updated = { ...currentUse };
  
  for (const [key, units] of Object.entries(exerciseResources)) {
    updated[key] = (updated[key] || 0) + units;
  }
  
  return updated;
}