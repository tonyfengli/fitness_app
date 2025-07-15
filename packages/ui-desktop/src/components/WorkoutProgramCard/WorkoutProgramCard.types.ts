import type { FeatureProps } from "@acme/ui-shared";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: string;
}

export interface WorkoutProgramCardProps extends FeatureProps {
  title: string;
  week?: string;
  exercises: Exercise[];
  onAddExercise?: () => void;
  onEditExercise?: (exerciseId: string) => void;
  className?: string;
}