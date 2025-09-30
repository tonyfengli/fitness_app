/**
 * Type definitions for circuit workouts
 */

export interface WorkoutSelection {
  id: string;
  sessionId: string;
  clientId: string;
  exerciseId: string | null;
  exerciseName: string;
  groupName: string;
  orderIndex: number;
  stationIndex: number | null;
  isShared: boolean;
  custom_exercise: CustomExercise | null;
  repsPlanned: number | null;
  selectionSource: string | null;
  sharedWithClients: string[] | null;
  equipment?: string[];
}

export interface CustomExercise {
  customName: string;
  originalExerciseId?: string;
}

export interface ProcessedExercise {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  orderIndex: number;
  custom_exercise: CustomExercise | null;
  repsPlanned: number | null;
  stationExercises?: {
    id: string;
    exerciseId: string;
    exerciseName: string;
  }[];
}

export interface RoundData {
  roundName: string;
  exercises: ProcessedExercise[];
  isRepeat?: boolean;
  roundType?: 'circuit_round' | 'stations_round' | 'amrap_round' | 'emom_round';
}

export interface CircuitTimingInfo {
  rounds: {
    roundNumber: number;
    countdownStartMs: number;
    workStartMs: number;
    endTimeMs: number;
    totalDurationMs: number;
  }[];
  totalWorkoutDurationMs: number;
  totalWorkTimeMs: number;
  totalRestTimeMs: number;
}

export interface ExerciseSwapPayload {
  sessionId: string;
  exerciseId?: string; // For specific exercise swap
  roundName?: string; // For circuit swap
  exerciseIndex?: number; // orderIndex for circuit swap
  originalExerciseId?: string | null;
  newExerciseId: string | null;
  customName?: string;
  reason: string;
  swappedBy: string;
}

export interface AddExercisePayload {
  sessionId: string;
  roundName: string;
  targetStationIndex?: number; // For adding to existing station
  newExerciseId: string | null;
  customName?: string;
}

export interface MirrorSwapInfo {
  originalRound: string;
  mirrorRound: string;
  mirrorExercise: ProcessedExercise;
  selectedExercise: ProcessedExercise;
  selectedReplacement: string;
  selectedExerciseIndex: number;
}