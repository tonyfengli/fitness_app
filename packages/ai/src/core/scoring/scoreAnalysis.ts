import type {
  ScoredExercise,
  ScoringCriteria,
} from "../../types/scoredExercise";

/**
 * Score distribution statistics
 */
export interface ScoreDistribution {
  highest: number;
  lowest: number;
  average: number;
  total: number;
  included: number;
  maxBeforeBoost: number;
}

/**
 * Analyze score distribution for debugging and logging
 */
export function analyzeScoreDistribution(
  scoredExercises: ScoredExercise[],
  criteria: ScoringCriteria,
  maxBeforeBoost: number,
): ScoreDistribution | null {
  if (scoredExercises.length === 0) {
    console.log("📊 No exercises to analyze");
    return null;
  }

  const topScore = scoredExercises[0]!.score;
  const bottomScore = scoredExercises[scoredExercises.length - 1]!.score;
  const avgScore =
    scoredExercises.reduce((sum, ex) => sum + ex.score, 0) /
    scoredExercises.length;
  const includedCount = criteria.includeExercises?.length || 0;

  const distribution: ScoreDistribution = {
    highest: topScore,
    lowest: bottomScore,
    average: parseFloat(avgScore.toFixed(1)),
    total: scoredExercises.length,
    included: includedCount,
    maxBeforeBoost: maxBeforeBoost,
  };

  console.log("📊 Score distribution:", distribution);

  // Additional detailed logging for debugging
  if (includedCount > 0) {
    const includedExercises = scoredExercises.filter((ex) =>
      criteria.includeExercises?.includes(ex.name),
    );
    console.log(
      `🔹 Included exercises (${includedCount}):`,
      includedExercises.map((ex) => ({ name: ex.name, score: ex.score })),
    );
  }

  return distribution;
}

/**
 * Log timing information
 */
export function logScoringPerformance(
  startTime: number,
  exerciseCount: number,
): void {
  const totalTime = performance.now() - startTime;
  const timePerExercise = exerciseCount > 0 ? totalTime / exerciseCount : 0;

  console.log(
    `⏱️ TOTAL scoring time: ${totalTime.toFixed(2)}ms for ${exerciseCount} exercises`,
  );
  console.log(`⏱️ Average time per exercise: ${timePerExercise.toFixed(3)}ms`);
}
