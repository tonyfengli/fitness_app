import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { BusinessExercise, exercises } from "@acme/db/schema";

import type { ExerciseRepository } from "../repositories/exerciseRepository";
import type { Exercise } from "../types";
import { getServices } from "../services/container";

export class ExerciseFetchError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ExerciseFetchError";
  }
}

// Default implementation using the real database
class PrismaExerciseRepository implements ExerciseRepository {
  async findAll(): Promise<Exercise[]> {
    try {
      const exerciseList = await db.query.exercises.findMany();
      return exerciseList as Exercise[];
    } catch (error) {
      throw new ExerciseFetchError(
        "Failed to fetch exercises from database",
        error,
      );
    }
  }

  async findByBusiness(businessId: string): Promise<Exercise[]> {
    try {
      const businessExercises = await db.query.BusinessExercise.findMany({
        where: eq(BusinessExercise.businessId, businessId),
        with: {
          exercise: true,
        },
      });

      return businessExercises.map((be: any) => be.exercise) as Exercise[];
    } catch (error) {
      throw new ExerciseFetchError(
        `Failed to fetch exercises for business ${businessId}`,
        error,
      );
    }
  }
}

// Global repository instance (can be overridden for testing)
let repository: ExerciseRepository = new PrismaExerciseRepository();

export function setExerciseRepository(repo: ExerciseRepository): void {
  repository = repo;
}

export function getExerciseRepository(): ExerciseRepository {
  return repository;
}

/**
 * Fetches all exercises from the database
 * @returns Promise<Exercise[]> - All exercises with complete data
 * @throws {ExerciseFetchError} If database query fails
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  // Check if a repository is available in the service container (for testing)
  const services = getServices();
  if (services.exerciseRepository) {
    return services.exerciseRepository.findAll();
  }
  return repository.findAll();
}

/**
 * Fetches exercises for a specific business from the database
 * @param businessId - The ID of the business
 * @returns Promise<Exercise[]> - Exercises specific to the business
 * @throws {ExerciseFetchError} If database query fails
 */
export async function fetchExercisesByBusiness(
  businessId: string,
): Promise<Exercise[]> {
  if (!businessId) {
    throw new ExerciseFetchError("Business ID is required");
  }

  // Check if a repository is available in the service container (for testing)
  const services = getServices();
  if (services.exerciseRepository) {
    return services.exerciseRepository.findByBusiness(businessId);
  }
  return repository.findByBusiness(businessId);
}
