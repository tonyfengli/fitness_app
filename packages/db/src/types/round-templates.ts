/**
 * Round Template Types
 * These types define different workout round structures
 */

// Music trigger configuration for a specific phase
export interface MusicTrigger {
  enabled: boolean;                    // Toggle on/off
  trackId?: string;                    // Optional specific track ID, else random from energy pool
  trackName?: string;                  // Track name for display purposes
  useBuildup?: boolean;                // Start at buildup point before the drop
  energy?: 'low' | 'medium' | 'high';  // Energy level (defaults based on phase type)
  repeatOnAllSets?: boolean;           // If true, trigger fires on every set (not just first)
  naturalEnding?: boolean;             // If true, seek so music ends naturally with round end
}

// Music configuration for a round
export interface RoundMusicConfig {
  roundPreview?: MusicTrigger;         // Trigger when round preview starts
  exercises?: MusicTrigger[];          // Per-exercise triggers (index matches exercise index)
  rests?: MusicTrigger[];              // Per-rest triggers (index matches rest index)
  setBreaks?: MusicTrigger[];          // Per-set-break triggers (index matches set transition)
}

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
  restBetweenSets?: number;    // Rest duration between sets/repeats (only when repeatTimes > 1)
}

// Station circuit configuration for individual stations
export interface StationCircuitConfig {
  workDuration: number;        // Work duration in seconds for this station
  restDuration: number;        // Rest duration between sets in this station
  sets: number;                // Number of sets within this station
}

// Stations round - work at each station for a set duration
export interface StationsRoundTemplate extends BaseRoundTemplate {
  type: 'stations_round';
  workDuration: number;        // Work duration in seconds
  restDuration: number;        // Rest duration between exercises in seconds
  repeatTimes?: number;        // Number of times to repeat the round (default: 1)
  restBetweenSets?: number;    // Rest duration between sets/repeats (only when repeatTimes > 1)
  stationCircuits?: {          // Optional circuit configurations for individual stations
    [stationIndex: number]: StationCircuitConfig;
  };
}

// AMRAP round - As Many Rounds As Possible
export interface AMRAPRoundTemplate extends BaseRoundTemplate {
  type: 'amrap_round';
}


// Future round types (commented out for now)
// export interface EMOMRoundTemplate extends BaseRoundTemplate {
//   type: 'emom_round';
//   minuteDuration: number;     // Duration per minute (usually 60)
//   repsPerMinute?: number;     // Optional rep target
// }

// Union type for all round templates
export type RoundTemplate = CircuitRoundTemplate | StationsRoundTemplate | AMRAPRoundTemplate; // | EMOMRoundTemplate;

// Round configuration with template
export interface RoundConfig {
  roundNumber: number;
  template: RoundTemplate;
  music?: RoundMusicConfig;            // Optional music configuration for this round
}