import type { SelectOption, BlockConfig } from './types';

export const JOINT_OPTIONS: SelectOption[] = [
  { value: "ankles", label: "Ankles" },
  { value: "knees", label: "Knees" },
  { value: "hips", label: "Hips" },
  { value: "shoulders", label: "Shoulders" },
  { value: "elbows", label: "Elbows" },
  { value: "wrists", label: "Wrists" },
  { value: "neck", label: "Neck" },
  { value: "lower_back", label: "Lower Back" },
  { value: "spine", label: "Spine" },
  { value: "sacroiliac_joint", label: "Sacroiliac Joint" },
  { value: "patella", label: "Patella" },
  { value: "rotator_cuff", label: "Rotator Cuff" },
];

export const MUSCLE_OPTIONS: SelectOption[] = [
  { value: "glutes", label: "Glutes" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "calves", label: "Calves" },
  { value: "adductors", label: "Adductors" },
  { value: "abductors", label: "Abductors" },
  { value: "core", label: "Core" },
  { value: "lower_abs", label: "Lower Abs" },
  { value: "upper_abs", label: "Upper Abs" },
  { value: "obliques", label: "Obliques" },
  { value: "chest", label: "Chest" },
  { value: "upper_chest", label: "Upper Chest" },
  { value: "lower_chest", label: "Lower Chest" },
  { value: "lats", label: "Lats" },
  { value: "traps", label: "Traps" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "shoulders", label: "Shoulders" },
  { value: "delts", label: "Delts" },
  { value: "upper_back", label: "Upper Back" },
  { value: "lower_back", label: "Lower Back" },
  { value: "shins", label: "Shins" },
  { value: "tibialis_anterior", label: "Tibialis Anterior" },
];

// Mock exercise options - in a real app, this would come from the API
export const EXERCISE_OPTIONS: SelectOption[] = [
  { value: "bench_press", label: "Bench Press" },
  { value: "squat", label: "Squat" },
  { value: "deadlift", label: "Deadlift" },
  { value: "pull_up", label: "Pull-up" },
  { value: "push_up", label: "Push-up" },
  { value: "overhead_press", label: "Overhead Press" },
  { value: "barbell_row", label: "Barbell Row" },
  { value: "dumbbell_curl", label: "Dumbbell Curl" },
  { value: "tricep_extension", label: "Tricep Extension" },
  { value: "leg_press", label: "Leg Press" },
  { value: "leg_curl", label: "Leg Curl" },
  { value: "leg_extension", label: "Leg Extension" },
  { value: "calf_raise", label: "Calf Raise" },
  { value: "lat_pulldown", label: "Lat Pulldown" },
  { value: "cable_row", label: "Cable Row" },
  { value: "dumbbell_press", label: "Dumbbell Press" },
  { value: "plank", label: "Plank" },
  { value: "russian_twist", label: "Russian Twist" },
  { value: "bicycle_crunch", label: "Bicycle Crunch" },
  { value: "mountain_climber", label: "Mountain Climber" },
];

export const EXERCISE_BLOCKS: BlockConfig[] = [
  {
    id: 'A',
    name: 'Block A - Primary Strength',
    functionTags: ['primary_strength'],
    colorScheme: {
      container: 'bg-blue-50 border-blue-200',
      header: 'text-blue-800',
      selected: 'bg-blue-200 border-blue-400',
      score: 'text-blue-600',
      label: 'text-blue-700'
    }
  },
  {
    id: 'B',
    name: 'Block B - Secondary Strength',
    functionTags: ['secondary_strength'],
    colorScheme: {
      container: 'bg-green-50 border-green-200',
      header: 'text-green-800',
      selected: 'bg-green-200 border-green-400',
      score: 'text-green-600',
      label: 'text-green-700'
    }
  },
  {
    id: 'C',
    name: 'Block C - Accessory',
    functionTags: ['accessory'],
    colorScheme: {
      container: 'bg-purple-50 border-purple-200',
      header: 'text-purple-800',
      selected: 'bg-purple-200 border-purple-400',
      score: 'text-purple-600',
      label: 'text-purple-700'
    }
  },
  {
    id: 'D',
    name: 'Block D - Core & Capacity',
    functionTags: ['core', 'capacity'],
    colorScheme: {
      container: 'bg-orange-50 border-orange-200',
      header: 'text-orange-800',
      selected: 'bg-orange-200 border-orange-400',
      score: 'text-orange-600',
      label: 'text-orange-700'
    }
  }
];

// Set range matrix based on strength x intensity - same as in setCountLogic.ts
export const SET_RANGE_MATRIX: Record<string, Record<string, [number, number]>> = {
  // Very low strength
  very_low: {
    low: [14, 16],
    moderate: [16, 18],
    high: [18, 20]
  },
  // Low strength
  low: {
    low: [16, 18],
    moderate: [18, 20],
    high: [20, 22]
  },
  // Moderate strength (default)
  moderate: {
    low: [17, 19],
    moderate: [19, 22],
    high: [22, 25]
  },
  // High strength
  high: {
    low: [18, 20],
    moderate: [22, 25],
    high: [25, 27]  // capped at 27
  }
};

export const TAG_COLOR_CLASSES = {
  indigo: "bg-indigo-100 text-indigo-800",
  red: "bg-red-100 text-red-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
} as const;