'use client';

import { useState, useCallback, useMemo } from 'react';

// Platform-agnostic exercise type
export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  movementPattern: string;
  modality: string;
  equipment?: string[];
  [key: string]: any;
}

interface ExerciseAPI {
  exercise: {
    list: {
      useQuery: () => { data?: Exercise[]; isLoading: boolean };
    };
  };
}

interface UseExerciseSelectionOptions {
  onSelect?: (exercise: Exercise) => void;
  filterByEquipment?: string[];
  filterByMuscle?: string[];
  filterByModality?: string[];
}

export function useExerciseSelection(api: ExerciseAPI, options?: UseExerciseSelectionOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  
  // Fetch exercises
  const { data: exercises = [], isLoading } = api.exercise.list.useQuery();

  // Filter exercises based on search and filters
  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((exercise) =>
        exercise.name.toLowerCase().includes(query) ||
        exercise.primaryMuscle.toLowerCase().includes(query) ||
        exercise.equipment?.some((eq) => eq.toLowerCase().includes(query))
      );
    }

    // Equipment filter
    if (options?.filterByEquipment && options.filterByEquipment.length > 0) {
      filtered = filtered.filter((exercise) =>
        exercise.equipment?.some((eq) =>
          options.filterByEquipment!.includes(eq)
        )
      );
    }

    // Muscle filter
    if (options?.filterByMuscle && options.filterByMuscle.length > 0) {
      filtered = filtered.filter((exercise) =>
        options.filterByMuscle!.includes(exercise.primaryMuscle) ||
        exercise.secondaryMuscles?.some((muscle) =>
          options.filterByMuscle!.includes(muscle)
        )
      );
    }

    // Modality filter
    if (options?.filterByModality && options.filterByModality.length > 0) {
      filtered = filtered.filter((exercise) =>
        options.filterByModality!.includes(exercise.modality)
      );
    }

    return filtered;
  }, [exercises, searchQuery, options?.filterByEquipment, options?.filterByMuscle, options?.filterByModality]);

  // Group exercises by primary muscle
  const exercisesByMuscle = useMemo(() => {
    const grouped = filteredExercises.reduce((acc, exercise) => {
      const muscle = exercise.primaryMuscle;
      if (!acc[muscle]) {
        acc[muscle] = [];
      }
      acc[muscle].push(exercise);
      return acc;
    }, {} as Record<string, Exercise[]>);

    // Sort muscle groups alphabetically
    return Object.keys(grouped)
      .sort()
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {} as Record<string, Exercise[]>);
  }, [filteredExercises]);

  // Group exercises by equipment
  const exercisesByEquipment = useMemo(() => {
    const grouped = filteredExercises.reduce((acc, exercise) => {
      const equipmentList = exercise.equipment && exercise.equipment.length > 0 
        ? exercise.equipment 
        : ['bodyweight'];
      equipmentList.forEach((equipment) => {
        if (!acc[equipment]) {
          acc[equipment] = [];
        }
        acc[equipment].push(exercise);
      });
      return acc;
    }, {} as Record<string, Exercise[]>);

    // Sort equipment alphabetically
    return Object.keys(grouped)
      .sort()
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {} as Record<string, Exercise[]>);
  }, [filteredExercises]);

  // Handle exercise selection
  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      setSelectedExercise(exercise);
      options?.onSelect?.(exercise);
    },
    [options]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedExercise(null);
  }, []);

  // Get similar exercises based on current selection
  const similarExercises = useMemo(() => {
    if (!selectedExercise) return [];

    return exercises
      .filter((exercise) => 
        exercise.id !== selectedExercise.id &&
        (exercise.primaryMuscle === selectedExercise.primaryMuscle ||
         exercise.movementPattern === selectedExercise.movementPattern ||
         exercise.equipment?.some((eq) => 
           selectedExercise.equipment?.includes(eq)
         ))
      )
      .slice(0, 5); // Limit to 5 suggestions
  }, [selectedExercise, exercises]);

  return {
    // Data
    exercises: filteredExercises,
    exercisesByMuscle,
    exercisesByEquipment,
    selectedExercise,
    similarExercises,
    
    // Actions
    searchQuery,
    setSearchQuery,
    selectExercise: handleSelectExercise,
    clearSelection,
    
    // State
    isLoading,
    totalCount: exercises.length,
    filteredCount: filteredExercises.length,
  };
}