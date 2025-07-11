/**
 * Template selector - determines which workout template to use based on client context
 */

import type { WorkoutTemplate } from "../types/dynamicBlockTypes";
import { 
  DEFAULT_WORKOUT_TEMPLATE, 
  FULL_BODY_TEMPLATE, 
  CIRCUIT_TRAINING_TEMPLATE,
  getWorkoutTemplate 
} from "./defaultTemplates";
import { logBlock } from "../../../utils/blockDebugger";

export interface TemplateSelectionCriteria {
  isFullBody?: boolean;
  workoutType?: 'standard' | 'circuit' | 'hiit' | 'strength' | 'custom';
  templateId?: string; // Direct template selection
  sessionGoal?: 'strength' | 'stability' | 'endurance' | 'power';
  duration?: 'short' | 'medium' | 'long'; // Could influence block count
}

/**
 * Select the appropriate workout template based on criteria
 */
export function selectWorkoutTemplate(criteria: TemplateSelectionCriteria): WorkoutTemplate {
  logBlock('Template Selection', {
    criteria,
    availableTemplates: ['workout', 'full_body', 'circuit_training']
  });

  // Direct template selection takes priority
  if (criteria.templateId) {
    const template = getWorkoutTemplate(criteria.templateId);
    if (template) {
      logBlock('Template Selected by ID', {
        templateId: criteria.templateId,
        templateName: template.name
      });
      return template;
    }
  }

  // Select based on workout type
  if (criteria.workoutType === 'circuit') {
    logBlock('Template Selected by Type', {
      workoutType: 'circuit',
      templateName: CIRCUIT_TRAINING_TEMPLATE.name
    });
    return CIRCUIT_TRAINING_TEMPLATE;
  }

  // Full body takes precedence over standard
  if (criteria.isFullBody) {
    logBlock('Template Selected by Full Body', {
      isFullBody: true,
      templateName: FULL_BODY_TEMPLATE.name
    });
    return FULL_BODY_TEMPLATE;
  }

  // Default to standard workout
  logBlock('Template Selected by Default', {
    templateName: DEFAULT_WORKOUT_TEMPLATE.name
  });
  return DEFAULT_WORKOUT_TEMPLATE;
}

/**
 * Create a custom template on the fly
 * This allows for dynamic template creation based on specific requirements
 */
export function createCustomTemplate(
  id: string,
  name: string,
  blockCount: number,
  options?: {
    exercisesPerBlock?: number;
    functionTags?: string[];
    requireMovementPatterns?: boolean;
  }
): WorkoutTemplate {
  const blocks = [];
  
  for (let i = 0; i < blockCount; i++) {
    blocks.push({
      id: `Block${i + 1}`,
      name: `${name} Block ${i + 1}`,
      functionTags: options?.functionTags || ['general'],
      maxExercises: options?.exercisesPerBlock || 5,
      selectionStrategy: 'randomized' as const,
      penaltyForReuse: i > 0 ? 2.0 : 0, // Penalty for all blocks except first
      constraints: options?.requireMovementPatterns ? {
        movements: {
          requireSquatHinge: true,
          requirePush: true,
          requirePull: true,
          requireLunge: false
        }
      } : undefined
    });
  }

  return {
    id,
    name,
    description: `Custom ${blockCount}-block workout`,
    blocks,
    blockOrder: blocks.map(b => b.id)
  };
}