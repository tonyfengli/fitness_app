/**
 * Equipment capacity configuration per business
 * Maps business IDs to their gym equipment limits
 * 
 * Each capacity represents the number of concurrent slots available per round
 * All capacities reset at the beginning of each round
 */

export interface EquipmentCapacityMap {
  dumbbells: number;
  bench: number;
  barbell: number;
  cable_machine: number;
  back_machine: number;
  landmine: number;
  pull_up_bar: number;
  bands: number;
  bosu_ball: number;
  swiss_ball: number;
  kettlebell: number;
  ab_wheel: number;
  box: number;
  trx: number;
  platform: number;
}

// Default capacity for businesses without specific configuration
const DEFAULT_CAPACITY: EquipmentCapacityMap = {
  dumbbells: 10,
  bench: 3,
  barbell: 3,
  cable_machine: 2,
  back_machine: 1,
  landmine: 1,
  pull_up_bar: 2,
  bands: 5,
  bosu_ball: 1,
  swiss_ball: 1,
  kettlebell: 3,
  ab_wheel: 1,
  box: 3,
  trx: 1,
  platform: 2,
};

// Business-specific capacity configurations
const BUSINESS_CAPACITIES: Record<string, EquipmentCapacityMap> = {
  // Test Business
  "94c48ca8-603d-46fb-98a4-880b6f611b99": {
    dumbbells: 10,
    bench: 3,
    barbell: 3,
    cable_machine: 2,
    back_machine: 1,
    landmine: 1,
    pull_up_bar: 2,
    bands: 5,
    bosu_ball: 1,
    swiss_ball: 1,
    kettlebell: 3,
    ab_wheel: 1,
    box: 3,
    trx: 1,
    platform: 2,
  },
  
  // Tony Gym
  "d33b41e2-f700-4a08-9489-cb6e3daa7f20": {
    dumbbells: 10,
    bench: 3,
    barbell: 3,
    cable_machine: 2,
    back_machine: 1,
    landmine: 1,
    pull_up_bar: 2,
    bands: 5,
    bosu_ball: 1,
    swiss_ball: 1,
    kettlebell: 3,
    ab_wheel: 1,
    box: 3,
    trx: 1,
    platform: 2,
  },
  
  // Add more businesses as needed
};

/**
 * Get equipment capacity for a specific business
 * Falls back to default capacity if business not configured
 */
export function getBusinessEquipmentCapacity(businessId: string): EquipmentCapacityMap {
  return BUSINESS_CAPACITIES[businessId] || DEFAULT_CAPACITY;
}

/**
 * Check if a business has custom equipment configuration
 */
export function hasCustomEquipmentCapacity(businessId: string): boolean {
  return businessId in BUSINESS_CAPACITIES;
}

/**
 * Get all configured business IDs
 */
export function getConfiguredBusinessIds(): string[] {
  return Object.keys(BUSINESS_CAPACITIES);
}