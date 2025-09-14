/**
 * Circuit Timing Calculator
 * Calculates precise timing for circuit workouts including track coverage
 */

import type { CircuitConfig } from "@acme/validators/training-session";

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
  return trackDurationMs - offsetMs;
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
  
  const workDurationMs = config.workDuration * 1000;
  const restDurationMs = config.restDuration * 1000;
  const restBetweenRoundsMs = config.restBetweenRounds * 1000;
  const countdownDurationMs = 6000; // 6 seconds (5, 4, 3, 2, 1, GO!)
  
  // totalRounds passed in already accounts for repeats from the service layer
  const effectiveRounds = totalRounds;
  
  for (let i = 0; i < effectiveRounds; i++) {
    // For repeat rounds, calculate the base round number
    const baseRounds = config.repeatRounds ? effectiveRounds / 2 : effectiveRounds;
    const roundNumber = config.repeatRounds ? (i % baseRounds) + 1 : i + 1;
    const isRepeat = config.repeatRounds && i >= baseRounds;
    
    // Round starts with countdown
    const countdownStartMs = currentTimeMs;
    const workStartMs = countdownStartMs + countdownDurationMs;
    
    // Calculate round duration (excluding rest between rounds)
    const exerciseDurationMs = 
      (config.exercisesPerRound * workDurationMs) + 
      ((config.exercisesPerRound - 1) * restDurationMs);
    
    const totalRoundDurationMs = countdownDurationMs + exerciseDurationMs;
    const endTimeMs = countdownStartMs + totalRoundDurationMs;
    
    rounds.push({
      roundNumber: isRepeat ? roundNumber : roundNumber,
      startTimeMs: countdownStartMs,
      countdownStartMs,
      workStartMs,
      endTimeMs,
      totalDurationMs: totalRoundDurationMs,
      exerciseCount: config.exercisesPerRound,
    });
    
    // Add rest between rounds (except after last round)
    currentTimeMs = endTimeMs;
    if (i < effectiveRounds - 1) {
      currentTimeMs += restBetweenRoundsMs;
    }
  }
  
  // Calculate totals
  const totalWorkTimeMs = effectiveRounds * config.exercisesPerRound * workDurationMs;
  const totalRestTimeMs = 
    (effectiveRounds * (config.exercisesPerRound - 1) * restDurationMs) + // Rest between exercises
    ((effectiveRounds - 1) * restBetweenRoundsMs); // Rest between rounds
  
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
  
  return {
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
}

/**
 * Calculate when to trigger the second track based on coverage
 */
export function getSecondTrackTriggerPoint(
  firstTrackCoverage: TrackCoverage,
  roundTiming: RoundTiming,
  config: CircuitConfig["config"]
): { triggerTimeMs: number; triggerType: 'bridge' | 'rest' } {
  if (firstTrackCoverage.coversFullRound) {
    // First track covers full round, second track starts at rest between rounds
    return {
      triggerTimeMs: roundTiming.endTimeMs,
      triggerType: 'rest',
    };
  } else {
    // First track doesn't cover full round, trigger during last exercise
    const lastExerciseStartMs = 
      roundTiming.workStartMs + 
      ((config.exercisesPerRound - 1) * (config.workDuration * 1000)) +
      ((config.exercisesPerRound - 1) * (config.restDuration * 1000));
    
    return {
      triggerTimeMs: lastExerciseStartMs,
      triggerType: 'bridge',
    };
  }
}