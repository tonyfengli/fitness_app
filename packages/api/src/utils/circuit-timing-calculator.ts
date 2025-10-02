/**
 * Circuit Timing Calculator
 * Calculates precise timing for circuit workouts including track coverage
 */

import type { CircuitConfig, RoundTemplate } from "@acme/db";

export interface RoundTiming {
  roundNumber: number;
  startTimeMs: number; // When round starts (including countdown)
  countdownStartMs: number; // When 6-second countdown begins
  workStartMs: number; // When actual work begins (after countdown)
  endTimeMs: number; // When round ends (before rest between rounds)
  totalDurationMs: number; // Total round duration including countdown
  exerciseCount: number;
}

export interface TrackCoverage {
  trackId: string;
  startTimeMs: number; // When track starts playing
  endTimeMs: number; // When track would naturally end
  effectiveDurationMs: number; // Actual playable duration considering hypeTimestamp
  coversFullRound: boolean;
  coverageEndMs: number; // Where in the workout timeline the track ends
}

export interface CircuitTimingResult {
  rounds: RoundTiming[];
  totalWorkoutDurationMs: number;
  totalWorkTimeMs: number;
  totalRestTimeMs: number;
}

/**
 * Calculate the effective duration of a track considering hype timestamp offset
 */
export function getEffectiveTrackDuration(
  trackDurationMs: number,
  hypeTimestamp?: number | null
): number {
  if (!hypeTimestamp) {
    return trackDurationMs;
  }
  
  // Track starts 5 seconds before hype moment
  const offsetMs = Math.max(0, (hypeTimestamp - 5) * 1000);
  const effectiveDuration = trackDurationMs - offsetMs;
  
  
  return effectiveDuration;
}

/**
 * Calculate timing for all rounds in a circuit workout
 */
export function calculateCircuitTiming(
  config: CircuitConfig["config"],
  totalRounds: number
): CircuitTimingResult {

  const rounds: RoundTiming[] = [];
  let currentTimeMs = 0;
  let totalWorkTimeMs = 0;
  let totalRestTimeMs = 0;
  
  const restBetweenRoundsMs = config.restBetweenRounds * 1000;
  const countdownDurationMs = 6000; // 6 seconds (5, 4, 3, 2, 1, GO!)
  
  // totalRounds passed in already accounts for repeats from the service layer
  const effectiveRounds = totalRounds;
  
  for (let i = 0; i < effectiveRounds; i++) {
    // For repeat rounds, calculate the base round number
    const baseRounds = config.repeatRounds ? effectiveRounds / 2 : effectiveRounds;
    const roundNumber = config.repeatRounds ? (i % baseRounds) + 1 : i + 1;
    const isRepeat = config.repeatRounds && i >= baseRounds;
    
    // Get the round template for this round
    const roundTemplate = config.roundTemplates?.[roundNumber - 1];
    if (!roundTemplate) {
      throw new Error(`No round template found for round ${roundNumber}`);
    }
    
    // Round starts with countdown
    const countdownStartMs = currentTimeMs;
    const workStartMs = countdownStartMs + countdownDurationMs;
    
    // Calculate round duration based on template type
    let exerciseDurationMs = 0;
    const template = roundTemplate.template;
    
    if (template.type === 'circuit_round') {
      // Circuit uses work/rest intervals
      const workDurationMs = template.workDuration * 1000;
      const restDurationMs = template.restDuration * 1000;
      exerciseDurationMs = 
        (template.exercisesPerRound * workDurationMs) + 
        ((template.exercisesPerRound - 1) * restDurationMs);
      
      // Update totals
      totalWorkTimeMs += template.exercisesPerRound * workDurationMs;
      totalRestTimeMs += (template.exercisesPerRound - 1) * restDurationMs;
    } else if (template.type === 'stations_round') {
      // Stations also use work/rest intervals (from circuit_round in same session)
      // Find a circuit_round template to get work/rest durations
      const circuitTemplate = config.roundTemplates?.find(rt => rt.template.type === 'circuit_round');
      if (!circuitTemplate || circuitTemplate.template.type !== 'circuit_round') {
        throw new Error('Stations round requires a circuit_round template for work/rest durations');
      }
      
      const workDurationMs = circuitTemplate.template.workDuration * 1000;
      const restDurationMs = circuitTemplate.template.restDuration * 1000;
      exerciseDurationMs = 
        (template.exercisesPerRound * workDurationMs) + 
        ((template.exercisesPerRound - 1) * restDurationMs);
      
      // Update totals
      totalWorkTimeMs += template.exercisesPerRound * workDurationMs;
      totalRestTimeMs += (template.exercisesPerRound - 1) * restDurationMs;
    } else if (template.type === 'amrap_round') {
      // AMRAP is continuous work
      // Find a circuit_round template to get work duration for total time calculation
      const circuitTemplate = config.roundTemplates?.find(rt => rt.template.type === 'circuit_round');
      if (!circuitTemplate || circuitTemplate.template.type !== 'circuit_round') {
        throw new Error('AMRAP round requires a circuit_round template for duration reference');
      }
      
      const workDurationMs = circuitTemplate.template.workDuration * 1000;
      exerciseDurationMs = template.exercisesPerRound * workDurationMs;
      
      // Update totals (all work, no rest within round)
      totalWorkTimeMs += exerciseDurationMs;
    } else if (template.type === 'warmup_cooldown_round') {
      // Warmup/Cooldown uses work/rest intervals
      const workDurationMs = template.workDuration * 1000;
      const restDurationMs = template.restDuration * 1000;
      exerciseDurationMs = 
        (template.exercisesPerRound * workDurationMs) + 
        ((template.exercisesPerRound - 1) * restDurationMs);
      
      // Update totals
      totalWorkTimeMs += template.exercisesPerRound * workDurationMs;
      totalRestTimeMs += (template.exercisesPerRound - 1) * restDurationMs;
    }
    
    const totalRoundDurationMs = countdownDurationMs + exerciseDurationMs;
    const endTimeMs = countdownStartMs + totalRoundDurationMs;
    
    const roundInfo = {
      roundNumber: isRepeat ? roundNumber : roundNumber,
      startTimeMs: countdownStartMs,
      countdownStartMs,
      workStartMs,
      endTimeMs,
      totalDurationMs: totalRoundDurationMs,
      exerciseCount: template.exercisesPerRound,
    };
    
    
    rounds.push(roundInfo);
    
    // Add rest between rounds (except after last round)
    currentTimeMs = endTimeMs;
    if (i < effectiveRounds - 1) {
      currentTimeMs += restBetweenRoundsMs;
      totalRestTimeMs += restBetweenRoundsMs;
    }
  }
  
  return {
    rounds,
    totalWorkoutDurationMs: currentTimeMs,
    totalWorkTimeMs,
    totalRestTimeMs,
  };
}

/**
 * Check if a track can cover a full round
 */
export function canTrackCoverRound(
  trackDurationMs: number,
  roundTiming: RoundTiming,
  hypeTimestamp?: number | null
): TrackCoverage {
  const effectiveDurationMs = getEffectiveTrackDuration(trackDurationMs, hypeTimestamp);
  const roundDurationFromCountdown = roundTiming.totalDurationMs;
  
  const coverage = {
    trackId: '', // Will be set by caller
    startTimeMs: roundTiming.countdownStartMs,
    endTimeMs: roundTiming.countdownStartMs + trackDurationMs,
    effectiveDurationMs,
    coversFullRound: effectiveDurationMs >= roundDurationFromCountdown,
    coverageEndMs: Math.min(
      roundTiming.countdownStartMs + effectiveDurationMs,
      roundTiming.endTimeMs
    ),
  };
  
  
  return coverage;
}

/**
 * Calculate when to trigger the second track based on coverage
 */
export function getSecondTrackTriggerPoint(
  firstTrackCoverage: TrackCoverage,
  roundTiming: RoundTiming,
  config: CircuitConfig["config"],
  roundNumber: number
): { triggerTimeMs: number; triggerType: 'bridge' | 'rest' } {
  if (firstTrackCoverage.coversFullRound) {
    // First track covers full round, second track starts at rest between rounds
    return {
      triggerTimeMs: roundTiming.endTimeMs,
      triggerType: 'rest',
    };
  } else {
    // Get the round template
    const roundTemplate = config.roundTemplates?.[roundNumber - 1];
    if (!roundTemplate) {
      throw new Error(`No round template found for round ${roundNumber}`);
    }
    
    const template = roundTemplate.template;
    let workDurationMs = 0;
    let restDurationMs = 0;
    
    if (template.type === 'circuit_round') {
      workDurationMs = template.workDuration * 1000;
      restDurationMs = template.restDuration * 1000;
    } else if (template.type === 'stations_round' || template.type === 'amrap_round') {
      // Find circuit_round template for durations
      const circuitTemplate = config.roundTemplates?.find(rt => rt.template.type === 'circuit_round');
      if (!circuitTemplate || circuitTemplate.template.type !== 'circuit_round') {
        throw new Error('Non-circuit rounds require a circuit_round template for duration reference');
      }
      workDurationMs = circuitTemplate.template.workDuration * 1000;
      restDurationMs = circuitTemplate.template.restDuration * 1000;
    }
    
    // First track doesn't cover full round, trigger during last exercise
    const lastExerciseStartMs = 
      roundTiming.workStartMs + 
      ((template.exercisesPerRound - 1) * workDurationMs) +
      ((template.exercisesPerRound - 1) * restDurationMs);
    
    
    return {
      triggerTimeMs: lastExerciseStartMs,
      triggerType: 'bridge',
    };
  }
}