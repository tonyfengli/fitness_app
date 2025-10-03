/**
 * Utility functions for working with circuit rounds
 */

export type RoundType = 'circuit_round' | 'stations_round' | 'amrap_round' | 'emom_round';

export interface RoundTemplate {
  roundNumber: number;
  template: {
    type: RoundType;
    workDuration?: number;
    restDuration?: number;
    exercisesPerRound?: number;
    totalDuration?: number;
  };
}

export interface CircuitConfig {
  config?: {
    roundTemplates?: RoundTemplate[];
    repeatRounds?: boolean;
  };
}

/**
 * Extract round number from round name
 */
export function getRoundNumber(roundName: string): number {
  return parseInt(roundName.match(/\d+/)?.[0] || '1');
}

/**
 * Get the round template for a given round
 */
export function getRoundTemplate(
  roundName: string, 
  circuitConfig: CircuitConfig | null | undefined
): RoundTemplate | undefined {
  if (!circuitConfig?.config?.roundTemplates) return undefined;
  
  const roundNumber = getRoundNumber(roundName);
  return circuitConfig.config.roundTemplates.find(
    rt => rt.roundNumber === roundNumber
  );
}

/**
 * Get the type of a round
 */
export function getRoundType(
  roundName: string, 
  circuitConfig: CircuitConfig | null | undefined
): RoundType {
  const template = getRoundTemplate(roundName, circuitConfig);
  return template?.template?.type || 'circuit_round';
}

/**
 * Check if a round is a stations round
 */
export function isStationsRound(
  roundName: string, 
  circuitConfig: CircuitConfig | null | undefined
): boolean {
  return getRoundType(roundName, circuitConfig) === 'stations_round';
}

/**
 * Check if a round is an AMRAP round
 */
export function isAmrapRound(
  roundName: string, 
  circuitConfig: CircuitConfig | null | undefined
): boolean {
  return getRoundType(roundName, circuitConfig) === 'amrap_round';
}

/**
 * Check if circuit has repeat rounds enabled
 */
export function hasRepeatRounds(circuitConfig: CircuitConfig | null | undefined): boolean {
  return circuitConfig?.config?.repeatRounds || false;
}

/**
 * Get the mirror round name for a base round
 */
export function getMirrorRoundName(
  roundName: string,
  totalRounds: number,
  circuitConfig: CircuitConfig | null | undefined
): string | null {
  if (!hasRepeatRounds(circuitConfig)) return null;
  
  const baseRoundCount = Math.floor(totalRounds / 2);
  const roundNumber = getRoundNumber(roundName);
  
  if (roundNumber <= baseRoundCount) {
    const mirrorNumber = roundNumber + baseRoundCount;
    return `Round ${mirrorNumber}`;
  }
  
  return null;
}