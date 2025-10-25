/**
 * Utility functions for working with station exercises
 */

export interface Exercise {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  orderIndex: number;
  stationIndex?: number | null;
  custom_exercise?: any;
  repsPlanned?: number | null;
  stationExercises?: StationExercise[];
}

export interface StationExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  repsPlanned?: number | null;
}

export type StationPosition = 'primary' | 'secondary' | 'standalone';

export interface StationInfo {
  isStation: boolean;
  stationSize: number;
  position: StationPosition;
  primaryExerciseId?: string;
  allStationExerciseIds?: string[];
}

/**
 * Determine if an exercise is part of a station and its position
 */
export function getStationInfo(
  exercise: Exercise | string,
  allExercises: Exercise[]
): StationInfo {
  // Handle both exercise object and exercise ID
  const exerciseId = typeof exercise === 'string' ? exercise : exercise.id;
  const exerciseObj = typeof exercise === 'string' 
    ? allExercises.find(ex => ex.id === exerciseId)
    : exercise;
    
  if (!exerciseObj) {
    return { isStation: false, stationSize: 1, position: 'standalone' };
  }
  
  // Check if this exercise has stationExercises (it's the primary)
  if (exerciseObj.stationExercises && exerciseObj.stationExercises.length > 0) {
    return { 
      isStation: true, 
      stationSize: exerciseObj.stationExercises.length + 1,
      position: 'primary',
      primaryExerciseId: exerciseObj.id,
      allStationExerciseIds: [
        exerciseObj.id,
        ...exerciseObj.stationExercises.map(se => se.id)
      ]
    };
  }
  
  // Check if this exercise is within another's stationExercises (it's secondary)
  const parentExercise = allExercises.find(ex => 
    ex.stationExercises?.some(se => se.id === exerciseId)
  );
  
  if (parentExercise) {
    return { 
      isStation: true, 
      stationSize: parentExercise.stationExercises!.length + 1,
      position: 'secondary',
      primaryExerciseId: parentExercise.id,
      allStationExerciseIds: [
        parentExercise.id,
        ...parentExercise.stationExercises!.map(se => se.id)
      ]
    };
  }
  
  // It's a standalone exercise
  return { 
    isStation: false, 
    stationSize: 1, 
    position: 'standalone',
    primaryExerciseId: exerciseObj.id,
    allStationExerciseIds: [exerciseObj.id]
  };
}

/**
 * Check if an exercise is part of a station
 */
export function isStationExercise(
  exercise: Exercise | string,
  allExercises: Exercise[]
): boolean {
  const info = getStationInfo(exercise, allExercises);
  return info.isStation;
}

/**
 * Get all exercises at a given station (orderIndex)
 * This works with the raw data format where station exercises have the same orderIndex
 */
export function getExercisesAtStation(
  orderIndex: number,
  allExercises: Exercise[]
): Exercise[] {
  return allExercises
    .filter(ex => ex.orderIndex === orderIndex)
    .sort((a, b) => {
      // Primary exercise (null stationIndex) comes first
      if (a.stationIndex === null) return -1;
      if (b.stationIndex === null) return 1;
      return (a.stationIndex || 0) - (b.stationIndex || 0);
    });
}

/**
 * Find the next available station index for a given orderIndex
 */
export function getNextStationIndex(
  orderIndex: number,
  allExercises: Exercise[]
): number {
  const stationExercises = getExercisesAtStation(orderIndex, allExercises);
  
  if (stationExercises.length === 0) return 0;
  if (stationExercises.length === 1) return 1; // First additional exercise
  
  // Find the highest stationIndex
  const maxIndex = Math.max(
    ...stationExercises
      .map(ex => ex.stationIndex)
      .filter(idx => idx !== null)
      .map(idx => idx as number)
  );
  
  return maxIndex + 1;
}

/**
 * Convert from nested structure (with stationExercises) to flat structure
 */
export function flattenStationExercises(exercises: Exercise[]): Exercise[] {
  const flattened: Exercise[] = [];
  
  exercises.forEach(exercise => {
    // Add the primary exercise
    flattened.push({
      ...exercise,
      stationExercises: undefined // Remove nested structure
    });
    
    // Add station exercises as separate items
    if (exercise.stationExercises && exercise.stationExercises.length > 0) {
      exercise.stationExercises.forEach((stationEx, index) => {
        flattened.push({
          id: stationEx.id,
          exerciseId: stationEx.exerciseId,
          exerciseName: stationEx.exerciseName,
          orderIndex: exercise.orderIndex,
          stationIndex: index + 1,
          custom_exercise: null,
          repsPlanned: null
        });
      });
    }
  });
  
  return flattened;
}

/**
 * Convert from flat structure to nested structure (with stationExercises)
 */
export function nestStationExercises(exercises: Exercise[]): Exercise[] {
  // Group by orderIndex to find exercises that belong together in a station
  const stationGroups = new Map<number, Exercise[]>();
  
  exercises.forEach(ex => {
    const stationKey = ex.orderIndex;
    if (!stationGroups.has(stationKey)) {
      stationGroups.set(stationKey, []);
    }
    stationGroups.get(stationKey)!.push(ex);
  });
  
  // Process each station group and collect stations
  const stations: Array<{ stationIndex: number; exercise: Exercise }> = [];
  const individualExercises: Exercise[] = [];
  
  stationGroups.forEach((group, stationKey) => {
    if (stationKey === null) {
      // Exercises without stationIndex are individual exercises (not part of a station)
      group.forEach(ex => {
        individualExercises.push({
          ...ex,
          stationIndex: null
        });
      });
    } else {
      // This is a station with multiple exercises
      // Sort by stationIndex to maintain the sequence within the station
      const sorted = group.sort((a, b) => {
        const aIndex = a.stationIndex ?? 0;
        const bIndex = b.stationIndex ?? 0;
        return aIndex - bIndex;
      });
      
      // The first exercise becomes the primary
      const primary = sorted[0];
      const secondaries = sorted.slice(1);
      
      stations.push({
        stationIndex: stationKey,
        exercise: {
          ...primary,
          stationIndex: null,
          stationExercises: secondaries.map(ex => ({
            id: ex.id,
            exerciseId: ex.exerciseId!,
            exerciseName: ex.exerciseName,
            repsPlanned: ex.repsPlanned
          }))
        }
      });
    }
  });
  
  // Sort stations by their stationIndex to maintain correct order
  const sortedStations = stations
    .sort((a, b) => a.stationIndex - b.stationIndex)
    .map(s => s.exercise);
  
  // Combine individual exercises and stations, sorted by orderIndex
  const allExercises = [...individualExercises, ...sortedStations];
  const result = allExercises.sort((a, b) => a.orderIndex - b.orderIndex);
  
  return result;
}