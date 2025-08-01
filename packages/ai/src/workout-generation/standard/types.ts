/**
 * Types for standard workout generation (two-phase LLM)
 */

import type { ScoredExercise } from "../../types/scoredExercise";

/**
 * Exercise selection from first LLM call
 */
export interface ExerciseSelection {
  clientSelections: {
    [clientId: string]: {
      clientName: string;
      preAssigned: {
        exerciseId: string;
        exerciseName: string;
        movementPattern: string;
        primaryMuscle: string;
        source: string;
      }[];
      selected: {
        exerciseId: string;
        exerciseName: string;
        movementPattern: string;
        primaryMuscle: string;
        score: number;
        isShared: boolean;
        sharedWith?: string[]; // Other client IDs sharing this exercise
      }[];
      totalExercises: number;
    };
  };
  
  sharedExercises: {
    exerciseId: string;
    exerciseName: string;
    clientIds: string[];
    averageScore: number;
  }[];
  
  selectionReasoning: string;
}

/**
 * Round organization from second LLM call
 */
export interface WorkoutRoundOrganization {
  rounds: {
    id: string;
    name: string;
    focus: string; // e.g., "Strength", "Metabolic", "Core"
    exercises: {
      [clientId: string]: {
        exerciseId: string;
        exerciseName: string;
        sets: number;
        reps: string; // e.g., "8-10", "30s", "AMRAP"
        restBetweenSets: string; // e.g., "60s", "90s"
        equipment: string[];
        notes?: string;
      }[];
    };
    roundDuration: string; // Estimated time
    equipmentRotation?: {
      station: number;
      equipment: string;
      clientRotation: string[][]; // Array of client ID arrays per rotation
    }[];
  }[];
  
  workoutSummary: {
    totalDuration: string;
    equipmentNeeded: string[];
    flowDescription: string;
  };
  
  organizationReasoning: string;
}

/**
 * Combined result from both LLM phases
 */
export interface StandardWorkoutPlan {
  exerciseSelection: ExerciseSelection;
  roundOrganization: WorkoutRoundOrganization;
  metadata: {
    templateType: string;
    clientCount: number;
    timestamp: string;
    llmModel: string;
    generationDurationMs?: number;
  };
}