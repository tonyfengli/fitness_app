import type { FeatureProps } from "@acme/ui-shared";

export interface Exercise {
  id: string; // This is now the workoutExerciseId for deletion operations
  exerciseId?: string; // The actual exercise ID (optional for backward compatibility)
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
  onAddExercise?: (blockName: string) => void;
  onEditExercise?: (exerciseId: string, exerciseName: string, blockName: string) => void;
  onEditWorkout?: () => void;
  onEditBlock?: (blockName: string) => void;
  onDeleteExercise?: (exerciseId: string, blockName: string) => void;
  onDeleteWorkout?: () => void;
  onDuplicateWorkout?: () => void;
  onDeleteBlock?: (blockName: string) => void;
  onMoveExercise?: (exerciseId: string, direction: 'up' | 'down') => void;
  movingExerciseId?: string | null;
  isDeleting?: boolean;
  deletingExerciseId?: string | null;
  deletingBlockName?: string | null;
  className?: string;
}