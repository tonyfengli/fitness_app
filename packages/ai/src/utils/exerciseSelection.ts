import type { ScoredExercise } from "../types/scoredExercise";

/**
 * Randomly selects one exercise from an array
 * @param exercises Array of exercises to select from
 * @returns Selected exercise
 */
export function randomSelect<T>(exercises: T[]): T | undefined {
  if (exercises.length === 0) return undefined;
  if (exercises.length === 1) return exercises[0];
  
  const randomIndex = Math.floor(Math.random() * exercises.length);
  return exercises[randomIndex];
}

/**
 * Performs weighted random selection from scored exercises
 * @param exercises Array of exercises to select from
 * @param count Number of exercises to select
 * @param weightFn Function to convert score to weight (default: quadratic)
 * @returns Array of selected exercises
 */
export function weightedRandomSelect(
  exercises: ScoredExercise[],
  count: number,
  weightFn: (score: number) => number = (score) => score * score
): ScoredExercise[] {
  if (exercises.length === 0 || count <= 0) return [];
  if (exercises.length <= count) return [...exercises];

  const selected: ScoredExercise[] = [];
  const remaining = [...exercises];

  while (selected.length < count && remaining.length > 0) {
    // Calculate weights for remaining exercises
    const weights = remaining.map(ex => Math.max(0.01, weightFn(ex.score)));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Select based on weighted probability
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let i = 0; i < weights.length; i++) {
      random -= weights[i] ?? 0;
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    // Add selected exercise and remove from remaining
    const selectedExercise = remaining[selectedIndex];
    if (selectedExercise) {
      selected.push(selectedExercise);
      remaining.splice(selectedIndex, 1);
    }
  }

  return selected;
}