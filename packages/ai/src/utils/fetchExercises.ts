import { db } from "@acme/db/client";
import type { Exercise } from "../types";

export class ExerciseFetchError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ExerciseFetchError';
  }
}

/**
 * Fetches all exercises from the database
 * @returns Promise<Exercise[]> - All exercises with complete data
 * @throws {ExerciseFetchError} If database query fails
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  try {
    const exercises = await db.query.exercises.findMany();
    
    if (!exercises || !Array.isArray(exercises)) {
      throw new ExerciseFetchError('Invalid response from database');
    }
    
    return exercises as Exercise[];
  } catch (error) {
    throw new ExerciseFetchError(
      'Failed to fetch exercises from database',
      error
    );
  }
}