import type { Exercise } from "../types";

export interface ExerciseRepository {
  findAll(): Promise<Exercise[]>;
  findByBusiness(businessId: string): Promise<Exercise[]>;
}

// This will be implemented by the actual database repository
// For now, we'll create an interface that can be mocked in tests
