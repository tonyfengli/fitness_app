import { afterEach, vi } from 'vitest';
import { resetServices } from '../src/services/container';
import { resetInterpretationLLM } from '../src/workout-generation/generateWorkoutFromExercises';

// Global test setup
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset any global state
  resetServices();
  resetInterpretationLLM();
});