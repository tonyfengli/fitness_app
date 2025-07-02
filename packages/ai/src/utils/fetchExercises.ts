import { db } from "@acme/db/client";
import type { Exercise } from "../types";

/**
 * Fetches all exercises from the database
 * @returns Promise<Exercise[]> - All exercises with complete data
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  return await db.query.exercises.findMany() as Exercise[];
}