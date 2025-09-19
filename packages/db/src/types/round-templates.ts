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
}

// Future round types (commented out for now)
// export interface AMRAPRoundTemplate extends BaseRoundTemplate {
//   type: 'amrap_round';
//   duration: number;           // Total round duration in seconds
// }

// export interface EMOMRoundTemplate extends BaseRoundTemplate {
//   type: 'emom_round';
//   minuteDuration: number;     // Duration per minute (usually 60)
//   repsPerMinute?: number;     // Optional rep target
// }

// Union type for all round templates
export type RoundTemplate = CircuitRoundTemplate; // | AMRAPRoundTemplate | EMOMRoundTemplate;

// Round configuration with template
export interface RoundConfig {
  roundNumber: number;
  template: RoundTemplate;
}