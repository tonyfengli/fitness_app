// Exercise filtering utilities for cross-platform use

export interface Exercise {
  id?: string;
  name: string;
  movementPattern?: string;
  primaryMuscle?: string;
  equipment?: string;
  [key: string]: any; // Allow additional properties
}

export interface BlueprintRecommendation {
  exercise?: Exercise;
  name?: string;
  score: number;
  roundId?: string;
  reason?: string;
}

export interface CategorizedExercises {
  recommended: Array<Exercise & { reason?: string; score?: number }>;
  other: Exercise[];
}

/**
 * Filter exercises by search query
 * Searches in exercise name (case-insensitive)
 */
export function filterExercisesBySearch(
  exercises: Exercise[],
  searchQuery: string
): Exercise[] {
  if (!searchQuery.trim()) return exercises;
  
  const query = searchQuery.toLowerCase().trim();
  return exercises.filter(exercise => 
    exercise.name.toLowerCase().includes(query)
  );
}

/**
 * Filter out exercises that are already active/selected
 */
export function filterOutActiveExercises(
  exercises: Exercise[],
  activeExerciseNames: string[]
): Exercise[] {
  if (!activeExerciseNames.length) return exercises;
  
  return exercises.filter(exercise => 
    !activeExerciseNames.includes(exercise.name)
  );
}

/**
 * Categorize exercises based on blueprint recommendations
 * Returns exercises grouped into "recommended" and "other" categories
 */
export function categorizeExercisesByRecommendation(
  availableExercises: Exercise[],
  blueprintRecommendations: BlueprintRecommendation[] = [],
  options: {
    currentExerciseName?: string;
    currentRound?: string;
    maxRecommendations?: number;
  } = {}
): CategorizedExercises {
  const { currentExerciseName, currentRound, maxRecommendations = 5 } = options;
  
  let recommended: Array<Exercise & { reason?: string; score?: number }> = [];
  let other: Exercise[] = [];
  
  if (blueprintRecommendations.length > 0) {
    // Use blueprint recommendations
    const relevantRecommendations = currentRound 
      ? blueprintRecommendations.filter(rec => rec.roundId === currentRound)
      : blueprintRecommendations;
    
    recommended = relevantRecommendations.map(rec => ({
      ...rec.exercise || rec,
      name: rec.exercise?.name || rec.name || '',
      score: rec.score,
      reason: getRecommendationReason(rec.score)
    }));
    
    // Add remaining exercises to "other" category
    const recommendedNames = recommended.map(r => r.name);
    other = availableExercises.filter(exercise => 
      !recommendedNames.includes(exercise.name) && 
      exercise.name !== currentExerciseName
    );
  } else if (availableExercises.length > 0 && currentExerciseName) {
    // Fallback to similarity-based recommendations
    const result = categorizeExercisesBySimilarity(
      availableExercises,
      currentExerciseName,
      maxRecommendations
    );
    recommended = result.recommended;
    other = result.other;
  } else {
    // No recommendations available, all exercises go to "other"
    other = availableExercises.filter(ex => ex.name !== currentExerciseName);
  }
  
  return { recommended, other };
}

/**
 * Categorize exercises based on similarity to current exercise
 * Used when blueprint recommendations are not available
 */
export function categorizeExercisesBySimilarity(
  exercises: Exercise[],
  currentExerciseName: string,
  maxRecommendations: number = 5
): CategorizedExercises {
  const currentExercise = exercises.find(ex => ex.name === currentExerciseName);
  if (!currentExercise) {
    return { 
      recommended: [], 
      other: exercises.filter(ex => ex.name !== currentExerciseName) 
    };
  }
  
  const recommended: Array<Exercise & { reason?: string }> = [];
  const other: Exercise[] = [];
  
  exercises.forEach(exercise => {
    if (exercise.name === currentExerciseName) return; // Skip current
    
    const isSameMovementPattern = exercise.movementPattern === currentExercise.movementPattern;
    const isSamePrimaryMuscle = exercise.primaryMuscle === currentExercise.primaryMuscle;
    
    if (isSameMovementPattern || isSamePrimaryMuscle) {
      recommended.push({
        ...exercise,
        reason: isSameMovementPattern ? 'Similar movement' : 'Same muscle group'
      });
    } else {
      other.push(exercise);
    }
  });
  
  // Sort recommendations: movement pattern matches first
  recommended.sort((a, b) => {
    if (a.reason === 'Similar movement' && b.reason !== 'Similar movement') return -1;
    if (b.reason === 'Similar movement' && a.reason !== 'Similar movement') return 1;
    return 0;
  });
  
  // Limit recommendations
  return {
    recommended: recommended.slice(0, maxRecommendations),
    other: [...recommended.slice(maxRecommendations), ...other]
  };
}

/**
 * Get human-readable reason for recommendation score
 */
export function getRecommendationReason(score: number): string | null {
  if (score >= 8.0) return 'Perfect match';
  if (score >= 7.0) return 'Excellent choice';
  if (score >= 6.0) return 'Very compatible';
  return null; // No tag for lower scores
}

/**
 * Sort exercises by score (highest first)
 */
export function sortExercisesByScore(
  exercises: Array<Exercise & { score?: number }>
): Array<Exercise & { score?: number }> {
  return [...exercises].sort((a, b) => {
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Combined filtering function for common use cases
 */
export function getFilteredExercises(
  exercises: Exercise[],
  options: {
    searchQuery?: string;
    activeExerciseNames?: string[];
    excludeExerciseName?: string;
  } = {}
): Exercise[] {
  let filtered = exercises;
  
  // Filter out active exercises
  if (options.activeExerciseNames?.length) {
    filtered = filterOutActiveExercises(filtered, options.activeExerciseNames);
  }
  
  // Filter out specific exercise (e.g., current exercise being replaced)
  if (options.excludeExerciseName) {
    filtered = filtered.filter(ex => ex.name !== options.excludeExerciseName);
  }
  
  // Apply search filter
  if (options.searchQuery) {
    filtered = filterExercisesBySearch(filtered, options.searchQuery);
  }
  
  return filtered;
}