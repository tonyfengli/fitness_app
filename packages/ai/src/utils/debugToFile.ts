import * as fs from 'node:fs';
import * as path from 'node:path';

const DEBUG_FILE = '/Users/tonyli/Desktop/fitness_app/current-filter-state.json';

export interface FilterDebugData {
  timestamp: string;
  filters: {
    clientName: string;
    strengthCapacity: string;
    skillCapacity: string;
    intensity: string;
    muscleTarget: string[];
    muscleLessen: string[];
    avoidJoints: string[];
    includeExercises: string[];
    avoidExercises: string[];
    sessionGoal?: string;
    isFullBody: boolean;
  };
  results: {
    totalExercises: number;
    blockA: { count: number; exercises: Array<{ id: string; name: string; score: number }> };
    blockB: { count: number; exercises: Array<{ id: string; name: string; score: number }> };
    blockC: { count: number; exercises: Array<{ id: string; name: string; score: number }> };
    blockD: { count: number; exercises: Array<{ id: string; name: string; score: number }> };
  };
}

export function saveFilterDebugData(data: FilterDebugData): void {
  try {
    console.log(`📝 Attempting to save filter debug data to: ${DEBUG_FILE}`);
    // Write to a file that Claude can read
    fs.writeFileSync(DEBUG_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Filter debug data saved successfully to: ${DEBUG_FILE}`);
  } catch (error) {
    console.error('❌ Failed to save debug data:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      code: (error as any).code,
      path: DEBUG_FILE
    });
  }
}

export function readFilterDebugData(): FilterDebugData | null {
  try {
    if (fs.existsSync(DEBUG_FILE)) {
      const data = fs.readFileSync(DEBUG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read debug data:', error);
  }
  return null;
}