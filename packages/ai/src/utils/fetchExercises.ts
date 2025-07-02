import { db } from "@acme/db/client";
import { eq } from "@acme/db";
import { BusinessExercise, exercises } from "@acme/db/schema";
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
    const exerciseList = await db.query.exercises.findMany();
    
    if (!exerciseList || !Array.isArray(exerciseList)) {
      throw new ExerciseFetchError('Invalid response from database');
    }
    
    return exerciseList as Exercise[];
  } catch (error) {
    throw new ExerciseFetchError(
      'Failed to fetch exercises from database',
      error
    );
  }
}

/**
 * Fetches exercises that belong to a specific business
 * @param businessId - UUID of the business
 * @returns Promise<Exercise[]> - Exercises available to this business
 * @throws {ExerciseFetchError} If database query fails
 */
export async function fetchExercisesByBusiness(businessId: string): Promise<Exercise[]> {
  try {
    const businessExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        primaryMuscle: exercises.primaryMuscle,
        secondaryMuscles: exercises.secondaryMuscles,
        loadedJoints: exercises.loadedJoints,
        movementPattern: exercises.movementPattern,
        modality: exercises.modality,
        movementTags: exercises.movementTags,
        functionTags: exercises.functionTags,
        fatigueProfile: exercises.fatigueProfile,
        complexityLevel: exercises.complexityLevel,
        equipment: exercises.equipment,
        strengthLevel: exercises.strengthLevel,
        createdAt: exercises.createdAt,
      })
      .from(BusinessExercise)
      .innerJoin(exercises, eq(BusinessExercise.exerciseId, exercises.id))
      .where(eq(BusinessExercise.businessId, businessId));
    
    if (!businessExercises || !Array.isArray(businessExercises)) {
      throw new ExerciseFetchError('Invalid response from database');
    }
    
    return businessExercises as Exercise[];
  } catch (error) {
    throw new ExerciseFetchError(
      `Failed to fetch exercises for business ${businessId}`,
      error
    );
  }
}