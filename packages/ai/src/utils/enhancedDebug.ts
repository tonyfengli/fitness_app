import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScoredExercise } from '../types/scoredExercise';
import type { FilterDebugData } from './debugToFile';

const ENHANCED_DEBUG_FILE = '/Users/tonyli/Desktop/fitness_app/enhanced-debug-state.json';
const WORKOUT_HISTORY_FILE = '/Users/tonyli/Desktop/fitness_app/workout-generation-history.json';

// Enhancement #1: Enhanced Filter State Tracking
export interface EnhancedFilterDebugData extends FilterDebugData {
  // Track why exercises were excluded
  exclusionReasons: Record<string, {
      name: string;
      reasons: string[];
    }>;
  
  // Track constraint satisfaction progress
  constraintAnalysis: Record<string, {
      required: string[];
      satisfied: string[];
      unsatisfied: string[];
      attemptedExercises: {
        name: string;
        constraint: string;
        selected: boolean;
        reason?: string;
      }[];
    }>;
  
  // Score breakdown for each exercise
  scoreBreakdowns: Record<string, {
      name: string;
      baseScore: number;
      bonuses: { reason: string; value: number }[];
      penalties: { reason: string; value: number }[];
      finalScore: number;
    }>;

  // Debug mode logs (Enhancement #8)
  debugLog?: DebugLogEntry[];
}

// Enhancement #2: Workout Generation History
export interface WorkoutGenerationLog {
  sessionId: string;
  timestamp: string;
  filters: FilterDebugData['filters'];
  results: {
    template: string;
    exerciseCount: number;
    constraintsSatisfied: boolean;
    generationTime: number;
    blockCounts: {
      blockA: number;
      blockB: number;
      blockC: number;
      blockD: number;
    };
  };
  userFeedback?: {
    rating?: number;
    swappedExercises?: string[];
    completionRate?: number;
    notes?: string;
  };
}

// Enhancement #8: Real-time Debugging Mode
export interface DebugLogEntry {
  step: number;
  timestamp: string;
  phase: 'filtering' | 'scoring' | 'organizing' | 'constraint_check' | 'selection';
  action: string;
  details: any;
  exercisesAffected?: number;
  performanceMs?: number;
}

// Helper class to track exclusion reasons during filtering
export class ExclusionTracker {
  private exclusions: EnhancedFilterDebugData['exclusionReasons'] = {};

  addExclusion(exercise: ScoredExercise, reason: string): void {
    if (!this.exclusions[exercise.id]) {
      this.exclusions[exercise.id] = {
        name: exercise.name,
        reasons: []
      };
    }
    const exclusion = this.exclusions[exercise.id];
    if (exclusion && !exclusion.reasons.includes(reason)) {
      exclusion.reasons.push(reason);
    }
  }

  getExclusions(): EnhancedFilterDebugData['exclusionReasons'] {
    return this.exclusions;
  }

  clear(): void {
    this.exclusions = {};
  }
}

// Helper class to track score breakdowns
export class ScoreTracker {
  private scoreBreakdowns: EnhancedFilterDebugData['scoreBreakdowns'] = {};

  addScoreBreakdown(exercise: ScoredExercise, breakdown: any): void {
    this.scoreBreakdowns[exercise.id] = {
      name: exercise.name,
      baseScore: breakdown.base || 5.0,
      bonuses: [],
      penalties: [],
      finalScore: exercise.score
    };

    const scoreBreakdown = this.scoreBreakdowns[exercise.id];
    if (!scoreBreakdown) return;

    // Add muscle target bonus
    if (breakdown.muscleTargetBonus > 0) {
      scoreBreakdown.bonuses.push({
        reason: 'Muscle Target Match',
        value: breakdown.muscleTargetBonus
      });
    }

    // Add muscle lessen penalty
    if (breakdown.muscleLessenPenalty < 0) {
      scoreBreakdown.penalties.push({
        reason: 'Muscle De-emphasis',
        value: breakdown.muscleLessenPenalty
      });
    }

    // Add intensity adjustment
    if (breakdown.intensityAdjustment !== 0) {
      if (breakdown.intensityAdjustment > 0) {
        scoreBreakdown.bonuses.push({
          reason: 'Intensity Match',
          value: breakdown.intensityAdjustment
        });
      } else {
        scoreBreakdown.penalties.push({
          reason: 'Intensity Mismatch',
          value: breakdown.intensityAdjustment
        });
      }
    }

    // Add include boost
    if (breakdown.includeExerciseBoost > 0) {
      scoreBreakdown.bonuses.push({
        reason: 'Included Exercise Boost',
        value: breakdown.includeExerciseBoost
      });
    }
  }

  getScoreBreakdowns(): EnhancedFilterDebugData['scoreBreakdowns'] {
    return this.scoreBreakdowns;
  }

  clear(): void {
    this.scoreBreakdowns = {};
  }
}

// Helper class to track constraint analysis
export class ConstraintAnalysisTracker {
  private constraints: EnhancedFilterDebugData['constraintAnalysis'] = {};

  initBlock(blockName: string, required: string[]): void {
    this.constraints[blockName] = {
      required,
      satisfied: [],
      unsatisfied: [...required],
      attemptedExercises: []
    };
  }

  recordAttempt(blockName: string, exerciseName: string, constraint: string, selected: boolean, reason?: string): void {
    if (!this.constraints[blockName]) return;
    
    this.constraints[blockName].attemptedExercises.push({
      name: exerciseName,
      constraint,
      selected,
      reason
    });

    if (selected && this.constraints[blockName].unsatisfied.includes(constraint)) {
      this.constraints[blockName].satisfied.push(constraint);
      this.constraints[blockName].unsatisfied = this.constraints[blockName].unsatisfied.filter(c => c !== constraint);
    }
  }

  getConstraintAnalysis(): EnhancedFilterDebugData['constraintAnalysis'] {
    return this.constraints;
  }

  clear(): void {
    this.constraints = {};
  }
}

// Score breakdown tracking removed - enhanced scoring no longer supported
// To track score breakdowns, add this functionality to the regular scoring system

// Real-time debug logger (Enhancement #8)
export class DebugLogger {
  private logs: DebugLogEntry[] = [];
  private stepCounter = 0;
  private enabled = false;

  enable(): void {
    this.enabled = true;
    this.logs = [];
    this.stepCounter = 0;
  }

  disable(): void {
    this.enabled = false;
  }

  log(phase: DebugLogEntry['phase'], action: string, details: any, exercisesAffected?: number): void {
    if (!this.enabled) return;

    const startTime = performance.now();
    
    this.logs.push({
      step: ++this.stepCounter,
      timestamp: new Date().toISOString(),
      phase,
      action,
      details,
      exercisesAffected,
      performanceMs: 0 // Will be updated by logPerformance
    });
  }

  logPerformance(stepNumber: number, duration: number): void {
    const log = this.logs.find(l => l.step === stepNumber);
    if (log) {
      log.performanceMs = duration;
    }
  }

  getLogs(): DebugLogEntry[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
    this.stepCounter = 0;
  }
}

// Save enhanced debug data
export function saveEnhancedDebugData(data: EnhancedFilterDebugData): void {
  try {
    fs.writeFileSync(ENHANCED_DEBUG_FILE, JSON.stringify(data, null, 2));
    console.log(`📊 Enhanced debug data saved to: ${ENHANCED_DEBUG_FILE}`);
  } catch (error) {
    console.error('Failed to save enhanced debug data:', error);
  }
}

// Read enhanced debug data
export function readEnhancedDebugData(): EnhancedFilterDebugData | null {
  try {
    if (fs.existsSync(ENHANCED_DEBUG_FILE)) {
      const data = fs.readFileSync(ENHANCED_DEBUG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read enhanced debug data:', error);
  }
  return null;
}

// Workout history functions (Enhancement #2)
export function saveWorkoutGenerationLog(log: WorkoutGenerationLog): void {
  try {
    let history: WorkoutGenerationLog[] = [];
    
    // Read existing history
    if (fs.existsSync(WORKOUT_HISTORY_FILE)) {
      const data = fs.readFileSync(WORKOUT_HISTORY_FILE, 'utf-8');
      history = JSON.parse(data);
    }
    
    // Add new log (keep last 100 entries)
    history.unshift(log);
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    
    // Save updated history
    fs.writeFileSync(WORKOUT_HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log(`📚 Workout generation log saved. Total history: ${history.length} entries`);
  } catch (error) {
    console.error('Failed to save workout generation log:', error);
  }
}

export function readWorkoutGenerationHistory(): WorkoutGenerationLog[] {
  try {
    if (fs.existsSync(WORKOUT_HISTORY_FILE)) {
      const data = fs.readFileSync(WORKOUT_HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read workout generation history:', error);
  }
  return [];
}

// Create a singleton instance for easy access
export const exclusionTracker = new ExclusionTracker();
export const constraintTracker = new ConstraintAnalysisTracker();
export const scoreTracker = new ScoreTracker();
export const debugLogger = new DebugLogger();