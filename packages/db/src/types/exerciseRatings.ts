// Exercise rating types and constants (simplified for now)
export const ExerciseRatingTypes = {
  FAVORITE: 'favorite',
} as const;

export type ExerciseRatingType = typeof ExerciseRatingTypes[keyof typeof ExerciseRatingTypes];

// Score adjustment for favorites
export const FAVORITE_SCORE_BOOST = 3.0; // Strong boost to prioritize favorites

// Maximum favorites per workout to prevent flooding
export const MAX_FAVORITES_PER_WORKOUT = 2;