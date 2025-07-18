import { useState } from "react";
import type { EditContext, ExerciseBlock } from "@acme/ui-desktop";

interface ModalState<T = any> {
  isOpen: boolean;
  data: T | null;
}

interface DeleteWorkoutData {
  workoutId: string;
  workoutDate: string;
}

interface DeleteExerciseData {
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
}

interface DeleteBlockData {
  workoutId: string;
  blockName: string;
}

interface EditModalData {
  context: EditContext | null;
  currentData: any;
}

interface DuplicateWorkoutData {
  id: string;
  exerciseBlocks: ExerciseBlock[];
}

interface AddExerciseData {
  workoutId: string;
  blockName: string;
}

interface ModalsState {
  deleteWorkout: ModalState<DeleteWorkoutData>;
  deleteExercise: ModalState<DeleteExerciseData>;
  deleteBlock: ModalState<DeleteBlockData>;
  edit: ModalState<EditModalData>;
  duplicate: ModalState<DuplicateWorkoutData>;
  addExercise: ModalState<AddExerciseData>;
  newWorkout: ModalState<void>;
}

export function useModalState() {
  const [modals, setModals] = useState<ModalsState>({
    deleteWorkout: { isOpen: false, data: null },
    deleteExercise: { isOpen: false, data: null },
    deleteBlock: { isOpen: false, data: null },
    edit: { isOpen: false, data: null },
    duplicate: { isOpen: false, data: null },
    addExercise: { isOpen: false, data: null },
    newWorkout: { isOpen: false, data: null }
  });

  const openModal = <K extends keyof ModalsState>(
    type: K,
    data?: ModalsState[K]['data']
  ) => {
    setModals(prev => ({
      ...prev,
      [type]: { isOpen: true, data: data || null }
    }));
  };

  const closeModal = <K extends keyof ModalsState>(type: K) => {
    setModals(prev => ({
      ...prev,
      [type]: { isOpen: false, data: null }
    }));
  };

  const updateModalData = <K extends keyof ModalsState>(
    type: K,
    data: ModalsState[K]['data']
  ) => {
    setModals(prev => ({
      ...prev,
      [type]: { ...prev[type], data }
    }));
  };

  return { 
    modals, 
    openModal, 
    closeModal, 
    updateModalData,
    // Convenience getters
    deleteWorkoutModal: modals.deleteWorkout,
    deleteExerciseModal: modals.deleteExercise,
    deleteBlockModal: modals.deleteBlock,
    editModal: modals.edit,
    duplicateModal: modals.duplicate,
    addExerciseModal: modals.addExercise,
    newWorkoutModal: modals.newWorkout
  };
}