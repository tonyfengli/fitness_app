import React from 'react';
import { useWorkoutActions, useWorkoutBlocks, useExerciseSelection } from '../index';

// Example usage of workout action hooks
// The 'api' prop would come from your platform-specific implementation
// e.g., from Next.js: import { api } from '~/utils/api';
// e.g., from React Native: import { api } from '~/lib/api';
export function WorkoutActionsExample({ 
  workoutId, 
  api 
}: { 
  workoutId: string;
  api: any; // Platform-specific TRPC API object
}) {
  // Initialize workout actions with toast support
  const {
    deleteExercise,
    reorderExercise,
    deleteBlock,
    deleteWorkout,
    replaceExercise,
    addExercise,
    duplicateWorkout,
    workout,
    isLoading,
    getActionState,
  } = useWorkoutActions({
    workoutId,
    api,
    toast: {
      showToast: (message, type) => {
        console.log(`[${type.toUpperCase()}] ${message}`);
      },
    },
    onDeleteWorkoutSuccess: () => {
      console.log('Navigating back after workout deletion...');
    },
    onDuplicateSuccess: (newWorkoutId) => {
      console.log(`Navigating to duplicated workout: ${newWorkoutId}`);
    },
  });

  // Use workout blocks helper
  const {
    blocks,
    availableBlockNames,
    nextBlockName,
    workoutStats,
    canReorderExercise,
  } = useWorkoutBlocks(workout);

  // Use exercise selection for adding/replacing
  const {
    exercises,
    searchQuery,
    setSearchQuery,
    selectExercise,
    selectedExercise,
  } = useExerciseSelection(api, {
    onSelect: (exercise) => {
      console.log('Selected exercise:', exercise.name);
    },
  });

  // Example: Delete an exercise
  const handleDeleteExercise = async (exerciseId: string, exerciseName: string) => {
    await deleteExercise(exerciseId, exerciseName);
  };

  // Example: Reorder exercise
  const handleMoveExercise = async (
    exerciseId: string,
    direction: 'up' | 'down',
    exerciseName: string
  ) => {
    if (canReorderExercise(exerciseId, direction)) {
      await reorderExercise(exerciseId, direction, exerciseName);
    }
  };

  // Example: Delete a block
  const handleDeleteBlock = async (blockName: string) => {
    const block = blocks.find((b) => b.name === blockName);
    if (block?.canDelete) {
      await deleteBlock(blockName);
    }
  };

  // Example: Add exercise to workout
  const handleAddExercise = async () => {
    if (selectedExercise) {
      await addExercise(
        selectedExercise.id,
        nextBlockName,
        'end',
        3,
        {
          name: selectedExercise.name,
          primaryMuscle: selectedExercise.primaryMuscle,
          equipment: selectedExercise.equipment || [],
        }
      );
    }
  };

  // Example: Replace exercise
  const handleReplaceExercise = async (
    currentExerciseId: string,
    newExerciseId: string
  ) => {
    const newExercise = exercises.find((ex) => ex.id === newExerciseId);
    if (newExercise) {
      await replaceExercise(
        currentExerciseId,
        newExerciseId,
        {
          name: newExercise.name,
          primaryMuscle: newExercise.primaryMuscle,
          equipment: newExercise.equipment || [],
        }
      );
    }
  };

  // Example: Duplicate workout
  const handleDuplicateWorkout = async () => {
    await duplicateWorkout(undefined, 'Duplicated for template');
  };

  // Check specific action states
  const isDeletingWorkout = getActionState('delete-workout').status === 'pending';
  const isDuplicating = getActionState('duplicate-workout').status === 'pending';

  return (
    <div>
      <h2>Workout Actions Example</h2>
      
      {/* Loading state */}
      {isLoading && <p>Processing...</p>}
      
      {/* Workout stats */}
      <div>
        <h3>Workout Statistics</h3>
        <p>Total Exercises: {workoutStats.totalExercises}</p>
        <p>Total Sets: {workoutStats.totalSets}</p>
        <p>Total Blocks: {workoutStats.totalBlocks}</p>
        <p>Muscle Groups: {workoutStats.muscleGroups.join(', ')}</p>
      </div>

      {/* Blocks */}
      <div>
        <h3>Workout Blocks</h3>
        {blocks.map((block) => (
          <div key={block.name}>
            <h4>
              {block.name} ({block.exercises.length} exercises, {block.totalSets} sets)
            </h4>
            
            {/* Block actions */}
            {block.canDelete && (
              <button onClick={() => handleDeleteBlock(block.name)}>
                Delete Block
              </button>
            )}

            {/* Exercise list */}
            {block.exercises.map((exercise, index) => (
              <div key={exercise.id}>
                <span>{exercise.exercise.name}</span>
                
                {/* Exercise actions */}
                <button
                  onClick={() =>
                    handleDeleteExercise(exercise.id, exercise.exercise.name)
                  }
                >
                  Delete
                </button>
                
                {canReorderExercise(exercise.id, 'up') && (
                  <button
                    onClick={() =>
                      handleMoveExercise(exercise.id, 'up', exercise.exercise.name)
                    }
                  >
                    Move Up
                  </button>
                )}
                
                {canReorderExercise(exercise.id, 'down') && (
                  <button
                    onClick={() =>
                      handleMoveExercise(exercise.id, 'down', exercise.exercise.name)
                    }
                  >
                    Move Down
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add exercise */}
      <div>
        <h3>Add Exercise</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises..."
        />
        
        <select onChange={(e) => selectExercise(exercises.find(ex => ex.id === e.target.value)!)}>
          <option value="">Select an exercise</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        
        {selectedExercise && (
          <button onClick={handleAddExercise}>
            Add {selectedExercise.name} to {nextBlockName}
          </button>
        )}
      </div>

      {/* Workout actions */}
      <div>
        <h3>Workout Actions</h3>
        <button onClick={handleDuplicateWorkout} disabled={isDuplicating}>
          {isDuplicating ? 'Duplicating...' : 'Duplicate Workout'}
        </button>
        
        <button onClick={() => deleteWorkout()} disabled={isDeletingWorkout}>
          {isDeletingWorkout ? 'Deleting...' : 'Delete Workout'}
        </button>
      </div>
    </div>
  );
}