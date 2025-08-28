import type { WorkoutTemplate } from "../../../types";

export const circuitTemplate: WorkoutTemplate = {
  id: 'circuit',
  name: 'Circuit Training',
  description: 'Time-based circuit workout with configurable work/rest intervals',
  useTwoPhaseGeneration: true, // Use standard two-phase generation flow
  
  // Use two-phase LLM generation like standard template
  metadata: {
    llmStrategy: "two-phase" as const,
  },
  
  // Minimal configuration for circuit template
  // Future implementation will add:
  // - rounds configuration
  // - work/rest intervals
  // - exercise selection criteria
  // - circuit-specific constraints
  
  // For now, use simple block structure
  blocks: [
    {
      id: 'Round1',
      name: 'Round 1',
      functionTags: [], // No specific function tags for circuits
      maxExercises: 8, // Allow up to 8 exercises per round
      candidateCount: 15, // Show more candidates for variety
      selectionStrategy: "randomized" as const,
    }
  ],
  
  blockOrder: ['Round1']
};