/**
 * Circuit Training Configuration Types
 * These types define the structure of circuit training session configuration
 */

export interface CircuitConfig {
  type: 'circuit';
  config: {
    rounds: number;              // Number of rounds (e.g., 3)
    exercisesPerRound: number;   // Number of exercises per round (e.g., 6)
    workDuration: number;        // Work duration in seconds (e.g., 45)
    restDuration: number;        // Rest duration between exercises in seconds (e.g., 15)
    restBetweenRounds: number;   // Rest duration between rounds in seconds (e.g., 60)
  };
  // Metadata
  lastUpdated?: string;  // ISO date string
  updatedBy?: string;    // User ID of who last updated
}

// Template config can be circuit or other types
export type TemplateConfig = CircuitConfig | { type: string; [key: string]: any };

// Validation constants
export const CIRCUIT_CONFIG_LIMITS = {
  rounds: { min: 1, max: 10 },
  exercisesPerRound: { min: 1, max: 20 },
  workDuration: { min: 10, max: 300 },      // 10 seconds to 5 minutes
  restDuration: { min: 5, max: 120 },       // 5 seconds to 2 minutes  
  restBetweenRounds: { min: 10, max: 300 }  // 10 seconds to 5 minutes
} as const;

// Default circuit configuration
export const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  type: 'circuit',
  config: {
    rounds: 3,
    exercisesPerRound: 6,
    workDuration: 45,
    restDuration: 15,
    restBetweenRounds: 60
  }
};