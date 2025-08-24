export interface ExerciseResources {
  [equipment: string]: number;
}

export interface FixedAssignment {
  exerciseId: string;
  clientId: string;
  round: number;
  resources: ExerciseResources;
  fixedReason: 'tier_priority' | 'singleton' | 'singleton_cascade' | 'shared_exercise' | 'last_exercise_auto_assign';
  singletonIteration?: number;
  warning?: string;
}

export interface AllowedSlotsResult {
  fixedAssignments: FixedAssignment[];
  exerciseOptions: Array<{
    exerciseId: string;
    clientId: string;
    allowedRounds: number[];
    tier: number;
    resources: ExerciseResources;
    placementIssue?: 'singleton_no_slots' | 'shared_no_slots';
  }>;
  roundCapacityUse: ExerciseResources[];
  clientUsedSlots: Record<string, number[]>;
}

export interface Phase2SelectionResult {
  placements: Array<[string, number]>;
}