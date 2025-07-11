import { vi } from 'vitest';
import type { Exercise } from '../../src/types';
import { mockExerciseDatabase } from './testData';

/**
 * Mock the fetchExercises module
 */
export function mockFetchExercises(exercises: Exercise[] = mockExerciseDatabase) {
  vi.mock('../../src/utils/fetchExercises', () => ({
    fetchAllExercises: vi.fn().mockResolvedValue(exercises),
    fetchExercisesByBusiness: vi.fn().mockResolvedValue(exercises),
  }));
}

/**
 * Clear all mocks
 */
export function clearAllMocks() {
  vi.clearAllMocks();
  vi.resetModules();
}