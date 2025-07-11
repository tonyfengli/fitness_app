import type { WorkoutTemplate } from './workoutTemplate';

/**
 * Extended workout template used in filtering operations
 * Includes isFullBody flag for template selection
 */
export interface FilterWorkoutTemplate extends WorkoutTemplate {
  isFullBody?: boolean;
}

/**
 * Type guard to check if a workout template has the isFullBody property
 */
export function hasFullBodyFlag(template: WorkoutTemplate | FilterWorkoutTemplate): template is FilterWorkoutTemplate {
  return 'isFullBody' in template;
}