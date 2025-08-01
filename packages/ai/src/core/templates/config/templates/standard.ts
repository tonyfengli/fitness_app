import type { WorkoutTemplate } from "../../types/dynamicBlockTypes";

export const standardTemplate: WorkoutTemplate = {
  id: 'standard',
  name: 'Standard Group Workout',
  description: 'Client-pooled exercise selection with two-phase LLM generation',
  
  blocks: [
    // TODO: Add pre-assigned blocks when function tags are set up
    // For now, empty blocks array to prevent extraction errors
  ],
  
  cohesionTargets: {
    groupTarget: 0.3, // 30% of exercises shared
    strategy: 'balanced'
  },
  
  metadata: {
    llmStrategy: 'two-phase',
    totalExercisesPerClient: 8,
    preAssignedCount: 0, // Changed from 2 to 0 temporarily
    workoutFlow: 'strength-metabolic',
    exerciseRoles: {
      strength: 4,
      metabolic: 4,
      preAssigned: 0
    }
  }
};

export const standardStrengthTemplate: WorkoutTemplate = {
  ...standardTemplate,
  id: 'standard_strength',
  name: 'Standard Strength Focus',
  metadata: {
    ...standardTemplate.metadata,
    workoutFlow: 'pure-strength',
    exerciseRoles: {
      strength: 5,
      accessory: 1,
      preAssigned: 2
    }
  }
};