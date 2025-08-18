import type { ExerciseRepository } from "../../src/repositories/exerciseRepository";
import type { Exercise } from "../../src/types";

export interface MockRepositoryOptions {
  exercises?: Exercise[];
  shouldThrow?: boolean;
  errorMessage?: string;
}

/**
 * Mock exercise repository for testing
 */
export class MockExerciseRepository implements ExerciseRepository {
  private exercises: Exercise[];
  private options: MockRepositoryOptions;
  public calls: {
    findAll: number;
    findByBusiness: { businessId: string }[];
  } = {
    findAll: 0,
    findByBusiness: [],
  };

  constructor(options: MockRepositoryOptions = {}) {
    this.options = options;
    this.exercises = options.exercises || [];
  }

  async findAll(): Promise<Exercise[]> {
    this.calls.findAll++;

    if (this.options.shouldThrow) {
      throw new Error(this.options.errorMessage || "Mock repository error");
    }

    return [...this.exercises];
  }

  async findByBusiness(businessId: string): Promise<Exercise[]> {
    this.calls.findByBusiness.push({ businessId });

    if (this.options.shouldThrow) {
      throw new Error(this.options.errorMessage || "Mock repository error");
    }

    // For testing, just return all exercises
    // In a real implementation, this would filter by business
    return [...this.exercises];
  }

  setExercises(exercises: Exercise[]): void {
    this.exercises = exercises;
  }

  clear(): void {
    this.calls = {
      findAll: 0,
      findByBusiness: [],
    };
  }
}
