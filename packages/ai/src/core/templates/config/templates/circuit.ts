import type { WorkoutTemplate } from "../../../types";

export const circuitTemplate: WorkoutTemplate = {
  id: 'circuit',
  name: 'Circuit Training',
  description: 'Time-based circuit workout with configurable work/rest intervals',
  
  // Use single-phase LLM generation like BMF
  metadata: {
    llmStrategy: "single-phase" as const,
  },
  
  // Circuit blocks will be dynamically configured based on circuit config
  // The actual round structure comes from the circuit configuration
  blocks: [
    {
      id: 'circuit_exercises',
      name: 'Circuit Exercises',
      functionTags: [], // No specific function tags for circuits
      maxExercises: 100, // Allow all available exercises
      candidateCount: 100, // Show all available exercises
      selectionStrategy: "deterministic" as const,
    }
  ],
  
  blockOrder: ['circuit_exercises']
};