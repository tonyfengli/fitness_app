export type EditContext = 
  | { type: 'workout'; workoutId: string }
  | { type: 'block'; workoutId: string; blockName: string }
  | { type: 'exercise'; workoutId: string; exerciseId: string; blockName: string; exerciseName: string };

export interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  context: EditContext | null;
  currentData?: any;
  isLoading?: boolean;
  availableExercises?: any[];
}