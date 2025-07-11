import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScoredExercise } from '../types/scoredExercise';
import type { FilterDebugData } from './debugToFile';

const ENHANCED_DEBUG_FILE = '/Users/tonyli/Desktop/fitness_app/enhanced-debug-state.json';
const WORKOUT_HISTORY_FILE = '/Users/tonyli/Desktop/fitness_app/workout-generation-history.json';

// Enhancement #1: Enhanced Filter State Tracking
export interface EnhancedFilterDebugData extends FilterDebugData {
  // Track why exercises were excluded
  exclusionReasons: {
    [exerciseId: string]: {
      name: string;
      reasons: string[];
    };
  };
  
  // Track constraint satisfaction progress
  constraintAnalysis: {
    [blockId: string]: {
      required: string[];
      satisfied: string[];
      unsatisfied: string[];
      attemptedExercises: Array<{
        name: string;
        constraint: string;
        selected: boolean;
        reason?: string;
      }>;
    };
  };
  
  // Score breakdown for each exercise
  scoreBreakdowns: {
    [exerciseId: string]: {
      name: string;
      baseScore: number;
      bonuses: Array<{ reason: string; value: number }>;
      penalties: Array<{ reason: string; value: number }>;
      finalScore: number;
    };
  };

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
}

// Helper class to track constraint satisfaction
export class ConstraintAnalysisTracker {
  private analysis: EnhancedFilterDebugData['constraintAnalysis'] = {};

  initBlock(blockId: string, requiredConstraints: string[]): void {
    this.analysis[blockId] = {
      required: requiredConstraints,
      satisfied: [],
      unsatisfied: [...requiredConstraints],
      attemptedExercises: []
    };
  }

  recordAttempt(blockId: string, exerciseName: string, constraint: string, selected: boolean, reason?: string): void {
    if (!this.analysis[blockId]) return;
    
    this.analysis[blockId].attemptedExercises.push({
      name: exerciseName,
      constraint,
      selected,
      reason
    });

    if (selected && this.analysis[blockId].unsatisfied.includes(constraint)) {
      this.analysis[blockId].satisfied.push(constraint);
      this.analysis[blockId].unsatisfied = this.analysis[blockId].unsatisfied.filter(c => c !== constraint);
    }
  }

  getAnalysis(): EnhancedFilterDebugData['constraintAnalysis'] {
    return this.analysis;
  }
}

// Helper class to track score breakdowns
export class ScoreBreakdownTracker {
  private breakdowns: EnhancedFilterDebugData['scoreBreakdowns'] = {};

  addBreakdown(
    exercise: ScoredExercise,
    baseScore: number,
    bonuses: Array<{ reason: string; value: number }>,
    penalties: Array<{ reason: string; value: number }>
  ): void {
    const totalBonus = bonuses.reduce((sum, b) => sum + b.value, 0);
    const totalPenalty = penalties.reduce((sum, p) => sum + p.value, 0);
    
    this.breakdowns[exercise.id] = {
      name: exercise.name,
      baseScore,
      bonuses,
      penalties,
      finalScore: baseScore + totalBonus - totalPenalty
    };
  }

  getBreakdowns(): EnhancedFilterDebugData['scoreBreakdowns'] {
    return this.breakdowns;
  }
}

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
export const scoreTracker = new ScoreBreakdownTracker();
export const debugLogger = new DebugLogger();