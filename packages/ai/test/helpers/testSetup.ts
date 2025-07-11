import { setExerciseRepository } from '../../src/utils/fetchExercises';
import { setInterpretationLLM } from '../../src/workout-interpretation/interpretExercisesNode';
import { MockExerciseRepository } from './mockExerciseRepository';
import { MockLLM } from './mockLLM';
import type { Exercise } from '../../src/types';

/**
 * Set up mocks for integration tests
 */
export function setupMocks(options: {
  exercises?: Exercise[];
  llmResponse?: string;
} = {}) {
  // Set up exercise repository mock
  const mockRepo = new MockExerciseRepository({
    exercises: options.exercises
  });
  setExerciseRepository(mockRepo);
  
  // Set up LLM mock
  const mockLLM = new MockLLM({
    defaultResponse: options.llmResponse
  });
  setInterpretationLLM(mockLLM);
  
  return { mockRepo, mockLLM };
}