/**
 * Default workout templates
 * These match the existing hardcoded structure for backward compatibility
 */

import type { WorkoutTemplate, BlockDefinition, SMSConfig } from "../types/dynamicBlockTypes";

// Removed non-BMF templates - only BMF template remains

/**
 * Full Body BMF (Bold Movement Fitness) template
 * 4 sequential rounds with movement pattern filtering
 */
export const FULL_BODY_BMF_TEMPLATE: WorkoutTemplate = {
  id: 'full_body_bmf',
  name: 'Full Body BMF',
  description: 'Bold Movement Fitness full body workout with 4 sequential rounds',
  blocks: [
    {
      id: 'Round1',
      name: 'Round 1',
      functionTags: ['primary_strength', 'secondary_strength'],
      maxExercises: 1,
      candidateCount: 1,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge']
      }
    },
    {
      id: 'Round2',
      name: 'Round 2',
      functionTags: [],  // No function tag filters
      maxExercises: 1,  // LLM can select max 1 exercise
      candidateCount: 1,  // Show only top candidate
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['vertical_pull', 'horizontal_pull']  // Only pulling movements
      }
    },
    {
      id: 'Round3',
      name: 'Round 3',
      functionTags: [],  // No function tag filter - show everything
      maxExercises: 2,  // LLM can select max 2 exercises
      candidateCount: 8,  // Show 8 candidates
      selectionStrategy: 'randomized'
      // No movement pattern filter - show all exercises
    },
    {
      id: 'FinalRound',
      name: 'Final Round',
      functionTags: ['core', 'capacity'],  // Core or capacity exercises
      maxExercises: 2,  // LLM can select max 2 exercises
      candidateCount: 8,  // Show 8 candidates
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['Round1', 'Round2', 'Round3', 'FinalRound'],
  smsConfig: {
    checkInResponse: "BMF time! Ready to move? 💪",
    preferencePrompt: "What movement patterns feel good today? Any areas to focus on or avoid?",
    followUpPrompts: {
      sessionGoal: "What's the focus - power, endurance, or movement quality?",
      muscleTargets: "Which movement patterns do you want to emphasize - squats, hinges, pulls?",
      intensity: "How are you feeling - ready to push hard or need a moderate pace?",
      avoidance: "Any movements or joints we should be careful with?"
    },
    confirmationMessage: "Let's do this! Your BMF workout is ready. Time to move boldly!",
    priorityFields: ['muscleTargets', 'avoidance', 'intensity'],
    showDeterministicSelections: true // Show the pre-selected exercises in check-in
  }
};

/**
 * Template registry
 */
export const WORKOUT_TEMPLATES: Record<string, WorkoutTemplate> = {
  'full_body_bmf': FULL_BODY_BMF_TEMPLATE
};

/**
 * Get template by ID
 */
export function getWorkoutTemplate(templateId: string): WorkoutTemplate | null {
  return WORKOUT_TEMPLATES[templateId] || null;
}

/**
 * Get default template
 */
export function getDefaultWorkoutTemplate(): WorkoutTemplate {
  return FULL_BODY_BMF_TEMPLATE;
}