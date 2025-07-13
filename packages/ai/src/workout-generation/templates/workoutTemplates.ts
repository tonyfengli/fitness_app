import type { WorkoutStructure } from '../prompts/types';

export type WorkoutTemplateType = 'standard' | 'circuit' | 'full_body';

export interface WorkoutTemplateConfig extends WorkoutStructure {
  id: WorkoutTemplateType;
  name: string;
  description: string;
}

export const WORKOUT_TEMPLATES: Record<WorkoutTemplateType, WorkoutTemplateConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard Workout',
    description: 'Traditional strength training with primary, secondary, accessory, and core work',
    sections: [
      { 
        name: 'Block A', 
        description: 'Primary strength exercises',
        exerciseCount: { min: 1, max: 1 }, 
        setGuidance: '3-4 sets' 
      },
      { 
        name: 'Block B', 
        description: 'Secondary strength exercises',
        exerciseCount: { min: 2, max: 3 }, 
        setGuidance: '3 sets each' 
      },
      { 
        name: 'Block C', 
        description: 'Accessory exercises',
        exerciseCount: { min: 2, max: 3 }, 
        setGuidance: '2-3 sets each' 
      },
      { 
        name: 'Block D', 
        description: 'Core and capacity work',
        exerciseCount: { min: 2, max: 2 }, 
        setGuidance: '2-3 sets each' 
      }
    ],
    totalExerciseLimit: 8
  },
  
  circuit: {
    id: 'circuit',
    name: 'Circuit Training',
    description: 'High-intensity circuit with repeated rounds',
    sections: [
      { 
        name: 'Round 1', 
        description: 'First circuit round - perform all exercises back-to-back',
        exerciseCount: { min: 4, max: 6 }, 
        setGuidance: '45s work, 15s rest' 
      },
      { 
        name: 'Round 2', 
        description: 'Second circuit round - same exercises as Round 1',
        exerciseCount: { min: 4, max: 6 }, 
        setGuidance: '45s work, 15s rest' 
      },
      { 
        name: 'Round 3', 
        description: 'Third circuit round - same exercises as Rounds 1 & 2',
        exerciseCount: { min: 4, max: 6 }, 
        setGuidance: '45s work, 15s rest' 
      }
    ],
    totalExerciseLimit: 6 // Same exercises repeated across rounds
  },
  
  full_body: {
    id: 'full_body',
    name: 'Full Body Workout',
    description: 'Balanced full-body training with muscle group requirements',
    sections: [
      { 
        name: 'Block A', 
        description: 'Primary compound movements',
        exerciseCount: { min: 1, max: 2 }, 
        setGuidance: '3-4 sets' 
      },
      { 
        name: 'Block B', 
        description: 'Secondary movements - balance upper/lower',
        exerciseCount: { min: 2, max: 3 }, 
        setGuidance: '3 sets each' 
      },
      { 
        name: 'Block C', 
        description: 'Accessory work - target weak points',
        exerciseCount: { min: 2, max: 3 }, 
        setGuidance: '2-3 sets each' 
      },
      { 
        name: 'Block D', 
        description: 'Core and conditioning',
        exerciseCount: { min: 1, max: 2 }, 
        setGuidance: '2-3 sets each' 
      }
    ],
    totalExerciseLimit: 8
  }
};

/**
 * Get a workout template by type
 */
export function getWorkoutTemplate(templateType: WorkoutTemplateType): WorkoutTemplateConfig {
  const template = WORKOUT_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Unknown workout template type: ${templateType}`);
  }
  return template;
}

/**
 * Get the WorkoutStructure for prompt building
 */
export function getWorkoutStructure(templateType: WorkoutTemplateType): WorkoutStructure {
  const template = getWorkoutTemplate(templateType);
  return {
    sections: template.sections,
    totalExerciseLimit: template.totalExerciseLimit
  };
}