/**
 * Utility functions for determining exercise count based on workout intensity
 */

/**
 * Get the number of exercises for a workout based on intensity level
 * @param intensity - The workout intensity level
 * @returns The number of exercises for the workout
 */
export function getExerciseCountFromIntensity(
  intensity: "low" | "moderate" | "high" | "intense" | undefined,
): number {
  switch (intensity) {
    case "low":
      return 4;
    case "moderate":
      return 5;
    case "high":
      return 6;
    case "intense":
      return 7;
    default:
      return 5; // Default to moderate
  }
}
