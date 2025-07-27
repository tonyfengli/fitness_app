/**
 * Default workout templates
 * These match the existing hardcoded structure for backward compatibility
 */

import type { WorkoutTemplate, BlockDefinition, SMSConfig } from "../types/dynamicBlockTypes";

/**
 * Default workout template - matches existing hardcoded structure
 */
export const DEFAULT_WORKOUT_TEMPLATE: WorkoutTemplate = {
  id: 'workout',
  name: 'Standard Workout',
  description: 'Traditional strength training workout with 4 blocks',
  blocks: [
    {
      id: 'A',
      name: 'Block A - Primary Strength',
      functionTags: ['primary_strength'],
      maxExercises: 5,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'B',
      name: 'Block B - Secondary Strength',
      functionTags: ['secondary_strength'],
      maxExercises: 8,
      selectionStrategy: 'randomized',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'C',
      name: 'Block C - Accessory',
      functionTags: ['accessory'],
      maxExercises: 8,
      selectionStrategy: 'randomized'
    },
    {
      id: 'D',
      name: 'Block D - Core & Capacity',
      functionTags: ['core', 'capacity'],
      maxExercises: 6,
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['A', 'B', 'C', 'D'],
  smsConfig: {
    checkInResponse: "You're checked in! Ready to crush some strength training?",
    preferencePrompt: "What's your priority for today's strength session? Examples: 'upper body focus', 'heavy legs', or 'core stability'.",
    followUpPrompts: {
      sessionGoal: "Are you looking to build strength, improve stability, or work on endurance today?",
      muscleTargets: "Which muscle groups do you want to focus on?",
      intensity: "How are you feeling today - ready for high intensity, moderate, or taking it easy?",
      avoidance: "Any areas we should be careful with or exercises to avoid?"
    },
    confirmationMessage: "Perfect! I've tailored your strength workout based on your preferences. See you in the gym!",
    priorityFields: ['sessionGoal', 'muscleTargets', 'intensity']
  }
};

/**
 * Full body workout template
 */
export const FULL_BODY_TEMPLATE: WorkoutTemplate = {
  id: 'full_body',
  name: 'Full Body Workout',
  description: 'Balanced full body workout',
  blocks: [
    {
      id: 'A',
      name: 'Block A - Primary Strength',
      functionTags: ['primary_strength'],
      maxExercises: 5,
      selectionStrategy: 'deterministic',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'B',
      name: 'Block B - Secondary Strength',
      functionTags: ['secondary_strength'],
      maxExercises: 8,
      selectionStrategy: 'randomized',
      movementPatternFilter: {
        include: ['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
      }
    },
    {
      id: 'C',
      name: 'Block C - Accessory',
      functionTags: ['accessory'],
      maxExercises: 8,
      selectionStrategy: 'randomized'
    },
    {
      id: 'D',
      name: 'Block D - Core & Capacity',
      functionTags: ['core', 'capacity'],
      maxExercises: 6,
      selectionStrategy: 'randomized'
    }
  ],
  blockOrder: ['A', 'B', 'C', 'D'],
  smsConfig: {
    checkInResponse: "Welcome! Ready for a full body workout?",
    preferencePrompt: "What areas do you want to focus on in today's full body session? Any specific goals?",
    followUpPrompts: {
      sessionGoal: "What's your main goal today - strength, endurance, or balanced work?",
      muscleTargets: "Any specific areas you'd like to emphasize?",
      intensity: "How's your energy level - high, moderate, or need to take it easier?",
      avoidance: "Any movements or areas we should avoid today?"
    },
    confirmationMessage: "Great! Your full body workout is ready. Let's make it a great session!",
    priorityFields: ['muscleTargets', 'intensity', 'sessionGoal']
  }
};

/**
 * Circuit training template - placeholder
 * 6 rounds, nothing else
 */
export const CIRCUIT_TRAINING_TEMPLATE: WorkoutTemplate = {
  id: 'circuit_training',
  name: 'Circuit Training',
  description: '6-round circuit workout',
  blocks: Array.from({ length: 6 }, (_, i) => ({
    id: `Round${i + 1}`,
    name: `Round ${i + 1}`,
    functionTags: ['primary_strength'],
    maxExercises: 1,
    selectionStrategy: 'randomized' as const
  })),
  blockOrder: Array.from({ length: 6 }, (_, i) => `Round${i + 1}`),
  smsConfig: {
    checkInResponse: "Let's go! Ready for some circuit training? 🔥",
    preferencePrompt: "How's your cardio feeling today? Any specific areas to target or avoid during circuits?",
    followUpPrompts: {
      sessionGoal: "Looking for strength circuits, cardio focus, or a mix?",
      intensity: "What intensity level - high energy, moderate pace, or recovery mode?",
      muscleTargets: "Any muscle groups you want to hit hard today?",
      avoidance: "Any exercises or movements to skip?"
    },
    confirmationMessage: "Awesome! Your circuit workout is set. Let's get that heart rate up!",
    priorityFields: ['intensity', 'sessionGoal', 'avoidance']
  }
};

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
  'workout': DEFAULT_WORKOUT_TEMPLATE,
  'full_body': FULL_BODY_TEMPLATE,
  'circuit_training': CIRCUIT_TRAINING_TEMPLATE,
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
  return DEFAULT_WORKOUT_TEMPLATE;
}