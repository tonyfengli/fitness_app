import type { CircuitConfig } from '@acme/db';

// Design tokens
export const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#5de1ff',
    accent2: '#5de1ff',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    chip: 999,
  },
};

// Exercise type with nested structure for stations
export interface CircuitExercise {
  id: string;
  sessionId: string;
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  equipment: string[];
  isShared: boolean;
  sharedWithClients: string[] | null;
  selectionSource: string;
  groupName: string | null;
  orderIndex: number;
  stationIndex?: number | null;
  custom_exercise?: any;
  repsPlanned?: number | null;
  stationExercises?: CircuitExercise[]; // For stations rounds
  roundName?: string;
}

// Round data structure
export interface RoundData {
  roundName: string;
  exercises: CircuitExercise[];
}

// Round timing configuration
export interface RoundTiming {
  workTime: number;
  restTime: number;
  exerciseCount: number;
  repeatTimes: number;
}

// Helper function
export const formatTime = (seconds: number): string => {
  if (seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};