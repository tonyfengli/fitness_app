export interface Exercise {
  id: string;
  name: string;
  primaryMuscle?: string;
  movementPattern?: string;
}

export interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string, sets: number) => void;
  blockName: string;
  exercises: Exercise[];
}