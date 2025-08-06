/**
 * Centralized configuration for the exercise scoring system
 * All scoring weights and adjustments are defined here for easy tuning
 */

export const SCORING_CONFIG = {
  // Base scoring
  BASE_SCORE: 5.0,
  INCLUDE_EXERCISE_PRIORITY: 1.0,
  
  // Shared exercise thresholds
  SHARED_EXERCISE_MIN_SCORE: 6.5,  // For strength/accessory exercises
  SHARED_EXERCISE_CORE_FINISHER_MIN_SCORE: 5.0,  // For core/capacity exercises
  
  // Muscle scoring
  MUSCLE_TARGET_PRIMARY: 3.0,
  MUSCLE_TARGET_SECONDARY: 1.5,
  MUSCLE_LESSEN_PRIMARY: -3.0,
  MUSCLE_LESSEN_SECONDARY: -1.5,
  
  // Favorite exercise boost
  FAVORITE_EXERCISE_BOOST: 2.0,

  // Intensity scoring - REMOVED: intensity no longer affects exercise scores
  // Keeping the structure for backwards compatibility but all values are 0
  INTENSITY_SCORING: {
    low: {
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
    moderate: {
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
    high: {
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
    intense: {
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
  },
} as const;