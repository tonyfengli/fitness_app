import type { ClientContext, GroupBlockBlueprint } from '../../types';

export interface WorkoutSection {
  name: string;
  description?: string;
  exerciseCount: { min: number; max: number };
  setGuidance?: string;
}

export interface WorkoutStructure {
  sections: WorkoutSection[];
  totalExerciseLimit?: number;
}

export interface Equipment {
  barbells: number;
  benches: number;
  cable_machine: number;
  row_machine: number;
  ab_wheel: number;
  bands: number;
  bosu_ball: number;
  kettlebells: number;
  landmine: number;
  swiss_ball: number;
  deadlift_stations: number;
  medicine_balls: number;
  dumbbells: string;
}

export interface DeterministicAssignment {
  clientId: string;
  clientName: string;
  exercise: string;
  equipment: string[];
  reason?: 'client_request' | 'muscle_target';
}

export interface GroupWorkoutConfig {
  clients: ClientContext[];
  equipment: Equipment;
  blueprint: GroupBlockBlueprint[];
  deterministicAssignments?: Record<string, DeterministicAssignment[]>;
  templateType?: string;
}

export interface PromptConfig {
  // Existing individual workout options
  includeExamples?: boolean;
  emphasizeRequestedExercises?: boolean;
  strictExerciseLimit?: boolean;
  workoutStructure?: WorkoutStructure;
  customSections?: {
    role?: string;
    rules?: string;
    context?: string;
    constraints?: string;
    outputFormat?: string;
    examples?: string;
    instructions?: string;
  };
  
  // New group workout options
  workoutType?: 'individual' | 'group';
  groupConfig?: GroupWorkoutConfig;
}