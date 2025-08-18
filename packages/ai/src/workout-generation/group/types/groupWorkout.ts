/**
 * Types for group workout LLM generation
 */

import type { ClientContext } from "../../../types/clientContext";
import type { GroupBlockBlueprint } from "../../../types/groupBlueprint";

/**
 * Input for shared exercise selection LLM call
 */
export interface SharedSelectionInput {
  blocks: GroupBlockBlueprint[];
  clients: ClientContext[];
  cohesionTargets: {
    overall: number; // Overall cohesion ratio target
    byClient: Record<string, number>; // Per-client targets
  };
}

/**
 * Output from shared exercise selection LLM
 */
export interface SharedExerciseSelection {
  blockId: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    groupScore: number;
    subGroups: Array<{
      clientIds: string[];
      clientNames: string[];
      sets: number;
      notes?: string; // e.g., "Use dumbbells for Tony, barbell for others"
    }>;
    reasoning: string;
  }>;
}

/**
 * Complete shared selections across all blocks
 */
export interface SharedSelectionOutput {
  selections: SharedExerciseSelection[];
  cohesionAnalysis: {
    targetMet: boolean;
    totalSharedSlots: number;
    targetSharedSlots: number;
    byClient: Record<
      string,
      {
        sharedExercises: number;
        targetExercises: number;
        percentage: number;
      }
    >;
  };
  reasoning: string;
}

/**
 * Input for individual workout LLM call
 */
export interface IndividualWorkoutInput {
  client: ClientContext;
  sharedSelections: SharedExerciseSelection[];
  individualCandidates: {
    [blockId: string]: {
      exercises: Array<{
        id: string;
        name: string;
        score: number;
      }>;
      slotsToFill: number;
    };
  };
  setCountRange: {
    min: number;
    max: number;
  };
}

/**
 * Output for individual workout
 */
export interface IndividualWorkoutOutput {
  clientId: string;
  blocks: {
    [blockId: string]: Array<{
      exercise: string;
      exerciseId: string;
      sets: number;
      isShared: boolean;
      sharedGroupId?: string; // Which sub-group they're in
    }>;
  };
  totalSets: number;
  reasoning: string;
}

/**
 * Final assembled group workout
 */
export interface GroupWorkout {
  sessionId: string;
  sharedSelections: SharedSelectionOutput;
  clientWorkouts: Record<string, IndividualWorkoutOutput>;
  metadata: {
    generatedAt: Date;
    totalClients: number;
    averageCohesion: number;
    llmCallDuration: {
      sharedSelection: number;
      individualSelections: Record<string, number>;
      total: number;
    };
  };
}
