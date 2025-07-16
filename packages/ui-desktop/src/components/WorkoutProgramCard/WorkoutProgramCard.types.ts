import type { FeatureProps } from "@acme/ui-shared";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: string;
}

export interface ExerciseBlock {
  blockName: string;
  exercises: Exercise[];
}

export interface WorkoutProgramCardProps extends FeatureProps {
  title: string;
  week?: string;
  exercises?: Exercise[];
  exerciseBlocks?: ExerciseBlock[];
  onAddExercise?: () => void;
  onEditExercise?: (exerciseId: string) => void;
  className?: string;
}