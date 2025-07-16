'use client';

import { useMemo } from 'react';
import type { WorkoutDetail, WorkoutExercise } from './useOptimisticWorkout';

interface Block {
  name: string;
  exercises: WorkoutExercise[];
  totalSets: number;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function useWorkoutBlocks(workout?: WorkoutDetail) {
  const blocks = useMemo(() => {
    if (!workout?.exercises || workout.exercises.length === 0) {
      return [];
    }

    // Group exercises by block
    const blockMap = workout.exercises.reduce((acc, exercise) => {
      const blockName = exercise.groupName || 'Block A';
      if (!acc[blockName]) {
        acc[blockName] = [];
      }
      acc[blockName].push(exercise);
      return acc;
    }, {} as Record<string, WorkoutExercise[]>);

    // Get unique block names and sort them
    const blockNames = Object.keys(blockMap).sort();

    // Convert to block objects with metadata
    return blockNames.map((name, index) => {
      const exercises = blockMap[name].sort((a, b) => a.orderIndex - b.orderIndex);
      const totalSets = exercises.reduce((sum, ex) => sum + ex.setsCompleted, 0);

      return {
        name,
        exercises,
        totalSets,
        canDelete: blockNames.length > 1, // Can't delete the only block
        canMoveUp: index > 0,
        canMoveDown: index < blockNames.length - 1,
      } as Block;
    });
  }, [workout]);

  // Get available block names for adding exercises
  const availableBlockNames = useMemo(() => {
    const existingNames = blocks.map((b) => b.name);
    const allPossibleNames = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E'];
    
    // Find the next available block name that doesn't exist
    const nextAvailable = allPossibleNames.find(name => !existingNames.includes(name));
    
    // Include existing names and next available name
    if (nextAvailable) {
      return [...existingNames, nextAvailable];
    }
    
    // If all standard names are used, generate a new one
    const nextLetter = String.fromCharCode(65 + existingNames.length);
    return [...existingNames, `Block ${nextLetter}`];
  }, [blocks]);

  // Get next block name for new exercises
  const nextBlockName = useMemo(() => {
    const allPossibleNames = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E'];
    const existingNames = blocks.map((b) => b.name);
    
    for (const name of allPossibleNames) {
      if (!existingNames.includes(name)) {
        return name;
      }
    }
    
    // If all standard names are used, generate a new one
    return `Block ${String.fromCharCode(65 + existingNames.length)}`;
  }, [blocks]);

  // Calculate workout statistics
  const workoutStats = useMemo(() => {
    const totalExercises = workout?.exercises.length || 0;
    const totalSets = workout?.exercises.reduce(
      (sum, ex) => sum + ex.setsCompleted,
      0
    ) || 0;
    
    const muscleGroups = new Set<string>();
    const equipment = new Set<string>();
    
    workout?.exercises.forEach((ex) => {
      muscleGroups.add(ex.exercise.primaryMuscle);
      ex.exercise.secondaryMuscles?.forEach((muscle) => muscleGroups.add(muscle));
      ex.exercise.equipment?.forEach((eq) => equipment.add(eq));
    });

    return {
      totalExercises,
      totalSets,
      totalBlocks: blocks.length,
      muscleGroups: Array.from(muscleGroups),
      equipment: Array.from(equipment),
    };
  }, [workout, blocks]);

  // Check if exercises can be reordered
  const canReorderExercise = (exerciseId: string, direction: 'up' | 'down') => {
    const exercise = workout?.exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return false;

    const block = blocks.find((b) => b.name === exercise.groupName);
    if (!block) return false;

    const exerciseIndex = block.exercises.findIndex((ex) => ex.id === exerciseId);
    
    if (direction === 'up') {
      return exerciseIndex > 0;
    } else {
      return exerciseIndex < block.exercises.length - 1;
    }
  };

  return {
    blocks,
    availableBlockNames,
    nextBlockName,
    workoutStats,
    canReorderExercise,
    hasMultipleBlocks: blocks.length > 1,
    isEmpty: blocks.length === 0,
  };
}