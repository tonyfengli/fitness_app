// Shared constants and utilities for exercise picker components

import { MUSCLE_UNIFICATION, filterExercisesBySearch } from "@acme/ui-shared";

// Types
export interface Exercise {
  id: string;
  name?: string; // Make optional for compatibility
  exerciseName: string;
  exerciseId?: string;
  orderIndex?: number;
  repsPlanned?: number | null;
  stationExercises?: Array<{
    id: string;
    exerciseId: string;
    exerciseName: string;
    repsPlanned?: number | null;
  }>;
  primaryMuscle?: string;
  movementPattern?: string;
  equipment?: string | string[];
  templateType?: string[];
  functionTags?: string[];
  movementTags?: string[];
}

export interface RoundData {
  roundName: string;
  exercises: Exercise[];
  roundType?: string;
}

export interface SelectedCategory {
  type: 'muscle' | 'movement' | 'equipment';
  value: string;
}

export interface FilterOptions {
  excludeWarmupOnly?: boolean;
  templateTypes?: string[];
  roundType?: string;
}

// Shared constants
export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
  'Quads', 'Hamstrings', 'Glutes', 'Core', 'Calves'
];

export const MOVEMENT_PATTERNS = [
  { value: 'horizontal_push', label: 'Horizontal Push' },
  { value: 'horizontal_pull', label: 'Horizontal Pull' },
  { value: 'vertical_push', label: 'Vertical Push' },
  { value: 'vertical_pull', label: 'Vertical Pull' },
  { value: 'squat', label: 'Squat' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'lunge', label: 'Lunge' },
  { value: 'core', label: 'Core' },
  { value: 'carry', label: 'Carry' },
  { value: 'isolation', label: 'Isolation' }
];

export const EQUIPMENT_OPTIONS = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bands', label: 'Bands' },
  { value: 'box', label: 'Box' },
  { value: 'bench', label: 'Bench' }
];

// Shared helper functions
export function getUnifiedMuscleGroup(primaryMuscle: string | undefined): string {
  if (!primaryMuscle) return "Other";
  
  // First check if it's already a unified muscle
  const capitalizedMuscle = primaryMuscle.charAt(0).toUpperCase() + primaryMuscle.slice(1).toLowerCase();
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) {
    return MUSCLE_UNIFICATION[capitalizedMuscle];
  }
  
  // Check various case formats
  const upperMuscle = primaryMuscle.toUpperCase();
  const lowerMuscle = primaryMuscle.toLowerCase();
  const underscoreMuscle = primaryMuscle.replace(/ /g, '_');
  
  // Try different formats
  if (MUSCLE_UNIFICATION[primaryMuscle]) return MUSCLE_UNIFICATION[primaryMuscle];
  if (MUSCLE_UNIFICATION[capitalizedMuscle]) return MUSCLE_UNIFICATION[capitalizedMuscle];
  if (MUSCLE_UNIFICATION[underscoreMuscle]) return MUSCLE_UNIFICATION[underscoreMuscle];
  
  // If not in unification map, it might already be a primary muscle
  // Capitalize it properly
  return primaryMuscle.charAt(0).toUpperCase() + primaryMuscle.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function getDrawerTitle(
  mode: string, 
  targetStation?: number, 
  roundData?: RoundData
): string {
  if (mode === 'replace') {
    return 'Replace Exercise';
  }

  if (roundData?.roundType === 'stations_round') {
    // Check if we're creating a new station
    const uniqueStations = new Set(roundData.exercises.map(ex => ex.orderIndex));
    const isNewStation = (targetStation || 0) >= uniqueStations.size;
    return isNewStation 
      ? `Create Station ${(targetStation || 0) + 1}`
      : `Add Exercise to Station ${(targetStation || 0) + 1}`;
  }
  
  return `Add Exercise to ${roundData?.roundName || 'Round'}`;
}

export function shouldShowExercise(
  exercise: Exercise,
  filterOptions: FilterOptions
): boolean {
  // Template type filtering
  if (exercise.templateType && exercise.templateType.length > 0) {
    if (filterOptions.templateTypes && filterOptions.templateTypes.length > 0) {
      const hasMatchingTemplate = filterOptions.templateTypes.some(type => 
        exercise.templateType?.includes(type)
      );
      if (!hasMatchingTemplate) return false;
    }
  }
  
  // Warmup filtering
  if (filterOptions.excludeWarmupOnly) {
    if (exercise.functionTags?.includes('warmup_only')) {
      return false;
    }
  } else {
    // If we're in warmup context, only show warmup-friendly or warmup-only exercises
    if (filterOptions.roundType === 'Warm-up') {
      return exercise.movementTags?.includes('warmup_friendly') || 
             exercise.functionTags?.includes('warmup_only');
    }
  }
  
  return true;
}

export function filterExercisesByCategory(
  exercises: Exercise[],
  category: SelectedCategory
): Exercise[] {
  if (category.type === 'muscle') {
    const unifiedMuscle = category.value;
    return exercises.filter((ex: Exercise) => 
      getUnifiedMuscleGroup(ex.primaryMuscle) === unifiedMuscle
    );
  } else if (category.type === 'movement') {
    return exercises.filter((ex: Exercise) => ex.movementPattern === category.value);
  } else if (category.type === 'equipment') {
    return exercises.filter((ex: Exercise) => {
      if (!ex.equipment) return false;
      
      if (Array.isArray(ex.equipment)) {
        return ex.equipment.some((eq: string) => 
          eq && eq.toLowerCase().trim() === category.value.toLowerCase()
        );
      } else if (typeof ex.equipment === 'string') {
        const equipmentList = ex.equipment.split(',').map(e => e.trim().toLowerCase());
        return equipmentList.includes(category.value.toLowerCase());
      }
      
      return false;
    });
  }
  
  return exercises;
}

export function filterExercises(
  exercises: Exercise[],
  searchQuery: string,
  selectedCategory: SelectedCategory | null,
  filterOptions: FilterOptions
): Exercise[] {
  // First apply basic filtering
  let filtered = exercises.filter(exercise => shouldShowExercise(exercise, filterOptions));
  
  // If there's a search query, it takes priority
  if (searchQuery) {
    filtered = filterExercisesBySearch(filtered, searchQuery);
  } else if (selectedCategory) {
    // Only apply category filter if there's no search query
    filtered = filterExercisesByCategory(filtered, selectedCategory);
  }
  
  return filtered;
}