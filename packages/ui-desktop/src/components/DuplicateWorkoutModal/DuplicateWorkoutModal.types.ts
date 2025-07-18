export interface Exercise {
  id: string;
  name: string;
  sets: number;
}

export interface ExerciseBlock {
  blockName: string;
  exercises: Exercise[];
}

export interface WorkoutData {
  id: string;
  exerciseBlocks: ExerciseBlock[];
}

export interface DuplicateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workoutData?: WorkoutData;
  isLoading?: boolean;
}