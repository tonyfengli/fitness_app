// Types for the workout generation modal

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  functionTags?: string[];
  score?: number;
  fatigueProfile?: string;
  movementPattern?: string;
  modality?: string;
  isSelectedBlockA?: boolean;
  isSelectedBlockB?: boolean;
  isSelectedBlockC?: boolean;
  isSelectedBlockD?: boolean;
}

export interface FilteredExercisesResult {
  exercises: Exercise[];
  blocks: {
    blockA: Exercise[];
    blockB: Exercise[];
    blockC: Exercise[];
    blockD: Exercise[];
  };
  timing?: {
    database: number;
    filtering: number;
    total: number;
  };
}

export interface WorkoutParameters {
  sessionGoal: "strength" | "stability" | "";
  intensity: "low" | "moderate" | "high" | "";
  template: "standard" | "circuit" | "full_body" | "";
  includeExercises: string[];
  avoidExercises: string[];
  muscleTarget: string[];
  muscleLessen: string[];
  avoidJoints: string[];
}

export interface SessionVolume {
  minSets: number;
  maxSets: number;
  reasoning: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export type TagColor = "indigo" | "red" | "green" | "yellow";

export interface BlockConfig {
  id: string;
  name: string;
  functionTags: string[];
  colorScheme: {
    container: string;
    header: string;
    selected: string;
    score: string;
    label: string;
  };
}
