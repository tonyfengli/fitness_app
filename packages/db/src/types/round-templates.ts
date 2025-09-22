/**
 * Round Template Types
 * These types define different workout round structures
 */

// Base round template interface
export interface BaseRoundTemplate {
  type: string;
  exercisesPerRound: number;
}

// Circuit round - traditional work/rest intervals
export interface CircuitRoundTemplate extends BaseRoundTemplate {
  type: 'circuit_round';
  workDuration: number;        // Work duration in seconds
  restDuration: number;        // Rest duration between exercises in seconds
  repeatTimes?: number;        // Number of times to repeat the round (default: 1)
}

// Stations round - work at each station for a set duration
export interface StationsRoundTemplate extends BaseRoundTemplate {
  type: 'stations_round';
  workDuration: number;        // Work duration in seconds
  restDuration: number;        // Rest duration between exercises in seconds
  repeatTimes?: number;        // Number of times to repeat the round (default: 1)
}

// AMRAP round - As Many Rounds As Possible
export interface AMRAPRoundTemplate extends BaseRoundTemplate {
  type: 'amrap_round';
}

// Warmup/Cooldown round - Simple timed exercises
export interface WarmupCooldownRoundTemplate extends BaseRoundTemplate {
  type: 'warmup_cooldown_round';
  position: 'warmup' | 'cooldown';
  workDuration: number;        // Work duration in seconds
  restDuration: number;        // Rest duration between exercises in seconds
}

// Future round types (commented out for now)
// export interface EMOMRoundTemplate extends BaseRoundTemplate {
//   type: 'emom_round';
//   minuteDuration: number;     // Duration per minute (usually 60)
//   repsPerMinute?: number;     // Optional rep target
// }

// Union type for all round templates
export type RoundTemplate = CircuitRoundTemplate | StationsRoundTemplate | AMRAPRoundTemplate | WarmupCooldownRoundTemplate; // | EMOMRoundTemplate;

// Round configuration with template
export interface RoundConfig {
  roundNumber: number;
  template: RoundTemplate;
}