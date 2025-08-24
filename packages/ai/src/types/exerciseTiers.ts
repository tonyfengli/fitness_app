export interface ExerciseWithTier {
  exerciseId: string;
  clientId: string;
  name?: string;
  tier: number;
  movementPattern?: string;
  primaryMuscle?: string;
  functionTags?: string[];
  equipment?: string[];
  modality?: string;
  fatigueProfile?: string;
}