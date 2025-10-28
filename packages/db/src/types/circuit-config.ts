/**
 * Circuit Training Configuration Types
 * These types define the structure of circuit training session configuration
 */

import type { RoundConfig } from './round-templates';

// Legacy config structure (for backward compatibility reference)
export interface LegacyCircuitConfig {
  type: 'circuit';
  config: {
    rounds: number;
    exercisesPerRound: number;
    workDuration: number;
    restDuration: number;
    restBetweenRounds: number;
    repeatRounds?: boolean;
    spotifyDeviceId?: string;
    spotifyDeviceName?: string;
  };
  lastUpdated?: string;
  updatedBy?: string;
}

// New circuit config with round templates
export interface CircuitConfig {
  type: 'circuit';
  config: {
    rounds: number;              // Total number of rounds
    restBetweenRounds: number;   // Rest duration between rounds in seconds
    repeatRounds?: boolean;      // Whether to repeat the entire circuit
    roundTemplates: RoundConfig[]; // Array of round configurations
    // Spotify integration
    spotifyDeviceId?: string;
    spotifyDeviceName?: string;
    // Template workout support
    sourceWorkoutId?: string;    // ID of the workout to use as template
    // Legacy fields (optional for backward compatibility)
    exercisesPerRound?: number;
    workDuration?: number;
    restDuration?: number;
  };
  // Metadata
  lastUpdated?: string;
  updatedBy?: string;
}

// Template config can be circuit or other types
export type TemplateConfig = CircuitConfig | { type: string; [key: string]: any };

// Validation constants
export const CIRCUIT_CONFIG_LIMITS = {
  rounds: { min: 1, max: 10 },
  exercisesPerRound: { min: 1, max: 20 },
  workDuration: { min: 1 },                 // Minimum 1 second, no maximum
  restDuration: { min: 5, max: 120 },       // 5 seconds to 2 minutes  
  restBetweenRounds: { min: 10, max: 300 }  // 10 seconds to 5 minutes
} as const;

// Helper to create default round templates
export function createDefaultRoundTemplates(
  rounds: number,
  exercisesPerRound: number,
  workDuration: number,
  restDuration: number
): RoundConfig[] {
  return Array.from({ length: rounds }, (_, i) => ({
    roundNumber: i + 1,
    template: {
      type: 'circuit_round' as const,
      exercisesPerRound,
      workDuration,
      restDuration,
    }
  }));
}

// Default circuit configuration with round templates
export const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  type: 'circuit',
  config: {
    rounds: 3,
    restBetweenRounds: 60,
    repeatRounds: false,
    roundTemplates: createDefaultRoundTemplates(3, 6, 45, 15),
    // Legacy fields for backward compatibility
    exercisesPerRound: 6,
    workDuration: 45,
    restDuration: 15,
  }
};

// Helper to migrate from legacy to new format
export function migrateToRoundTemplates(config: LegacyCircuitConfig | CircuitConfig): CircuitConfig {
  // If already has roundTemplates, return as-is
  if ('roundTemplates' in config.config && config.config.roundTemplates) {
    return config as CircuitConfig;
  }
  
  // Otherwise, convert from legacy format
  const { rounds, exercisesPerRound, workDuration, restDuration, ...rest } = config.config;
  
  return {
    ...config,
    config: {
      ...rest,
      rounds,
      roundTemplates: createDefaultRoundTemplates(
        rounds,
        exercisesPerRound || 6,
        workDuration || 45,
        restDuration || 15
      ),
      // Keep legacy fields for compatibility
      exercisesPerRound,
      workDuration,
      restDuration,
    },
  };
}