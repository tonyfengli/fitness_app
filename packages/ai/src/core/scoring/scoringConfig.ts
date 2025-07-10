/**
 * Centralized configuration for the exercise scoring system
 * All scoring weights and adjustments are defined here for easy tuning
 */

export const SCORING_CONFIG = {
  // Base scoring
  BASE_SCORE: 5.0,
  INCLUDE_EXERCISE_PRIORITY: 1.0,
  
  // Muscle scoring
  MUSCLE_TARGET_PRIMARY: 3.0,
  MUSCLE_TARGET_SECONDARY: 1.5,
  MUSCLE_LESSEN_PRIMARY: -3.0,
  MUSCLE_LESSEN_SECONDARY: -1.5,
  
  // Foundational bonus and penalties
  FOUNDATIONAL_MOVEMENT_BONUS: 0.5,
  FOUNDATIONAL_HIGH_COMPLEXITY_PENALTY: -2.0,
  FOUNDATIONAL_MODERATE_COMPLEXITY_PENALTY: -1.0,

  // Intensity scoring - kept nested due to complexity
  INTENSITY_SCORING: {
    low: {
      low_local: 1.5,
      moderate_local: 0.75,
      high_local: -1.5,
      moderate_systemic: -0.75,
      high_systemic: -1.5,
      metabolic: -1.5,
    },
    medium: {
      low_local: 0,
      moderate_local: 0,
      high_local: 0,
      moderate_systemic: 0,
      high_systemic: 0,
      metabolic: 0,
    },
    high: {
      low_local: -1.5,
      moderate_local: -0.75,
      high_local: 1.5,
      moderate_systemic: 0.75,
      high_systemic: 1.5,
      metabolic: 1.5,
    },
  },
} as const;