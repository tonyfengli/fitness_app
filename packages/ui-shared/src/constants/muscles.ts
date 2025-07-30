// Muscle groups with categories for better organization
export interface MuscleGroup {
  value: string;
  label: string;
  category: 'lower' | 'core' | 'upper-push' | 'upper-pull';
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  // Lower Body
  { value: 'glutes', label: 'Glutes', category: 'lower' },
  { value: 'quads', label: 'Quads', category: 'lower' },
  { value: 'hamstrings', label: 'Hamstrings', category: 'lower' },
  { value: 'calves', label: 'Calves', category: 'lower' },
  { value: 'adductors', label: 'Adductors', category: 'lower' },
  { value: 'abductors', label: 'Abductors', category: 'lower' },
  { value: 'shins', label: 'Shins', category: 'lower' },
  { value: 'tibialis_anterior', label: 'Tibialis Anterior', category: 'lower' },
  
  // Core
  { value: 'core', label: 'Core', category: 'core' },
  { value: 'lower_abs', label: 'Lower Abs', category: 'core' },
  { value: 'upper_abs', label: 'Upper Abs', category: 'core' },
  { value: 'obliques', label: 'Obliques', category: 'core' },
  
  // Upper Body - Push
  { value: 'chest', label: 'Chest', category: 'upper-push' },
  { value: 'upper_chest', label: 'Upper Chest', category: 'upper-push' },
  { value: 'lower_chest', label: 'Lower Chest', category: 'upper-push' },
  { value: 'shoulders', label: 'Shoulders', category: 'upper-push' },
  { value: 'delts', label: 'Delts', category: 'upper-push' },
  { value: 'triceps', label: 'Triceps', category: 'upper-push' },
  
  // Upper Body - Pull
  { value: 'lats', label: 'Lats', category: 'upper-pull' },
  { value: 'upper_back', label: 'Upper Back', category: 'upper-pull' },
  { value: 'lower_back', label: 'Lower Back', category: 'upper-pull' },
  { value: 'traps', label: 'Traps', category: 'upper-pull' },
  { value: 'biceps', label: 'Biceps', category: 'upper-pull' }
];

// Alphabetically sorted muscle groups
export const MUSCLE_GROUPS_ALPHABETICAL = [...MUSCLE_GROUPS].sort((a, b) => 
  a.label.localeCompare(b.label)
);

// Muscle map for quick lookups
export const MUSCLE_MAP: Record<string, string> = MUSCLE_GROUPS.reduce(
  (acc, muscle) => ({ ...acc, [muscle.value]: muscle.label }),
  {}
);

// Helper function to format muscle values to display labels
export const formatMuscleLabel = (muscleValue: string): string => {
  return MUSCLE_MAP[muscleValue] || muscleValue;
};

// Get muscles by category
export const getMusclesByCategory = (category: MuscleGroup['category']): MuscleGroup[] => {
  return MUSCLE_GROUPS.filter(muscle => muscle.category === category);
};

// Category labels for display
export const MUSCLE_CATEGORY_LABELS: Record<MuscleGroup['category'], string> = {
  'lower': 'Lower Body',
  'core': 'Core',
  'upper-push': 'Upper Body - Push',
  'upper-pull': 'Upper Body - Pull'
};