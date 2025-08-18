import type { BlockConfig } from "../core/templates/types/dynamicBlockTypes";
import type { GroupScoredExercise } from "./groupContext";
import type { ScoredExercise } from "./scoredExercise";

/**
 * Represents a possible sub-group for a shared exercise
 */
export interface SubGroupPossibility {
  exerciseId: string;
  clientIds: string[];
  groupSize: number;
}

/**
 * Blueprint for a single block's group workout structure
 */
export interface GroupBlockBlueprint {
  blockId: string;
  blockConfig: BlockConfig;

  // Slot allocation based on available exercises
  slots: {
    total: number;
    targetShared: number; // Based on block's shared ratio
    actualSharedAvailable: number; // Based on quality threshold (2+ clients)
    individualPerClient: number; // Remaining slots for each client
  };

  // Candidates for LLM to select from
  sharedCandidates: {
    exercises: GroupScoredExercise[];
    minClientsRequired: number;
    subGroupPossibilities: SubGroupPossibility[];
  };

  // Individual exercise candidates per client
  individualCandidates: {
    [clientId: string]: {
      exercises: ScoredExercise[];
      slotsToFill: number;
      allFilteredExercises?: ScoredExercise[]; // All exercises that passed block filters
    };
  };
}

/**
 * Complete blueprint for group workout generation
 * Output of Phase 4, input to Phase 5 (LLM)
 */
export interface GroupWorkoutBlueprint {
  blocks: GroupBlockBlueprint[];
  validationWarnings?: string[];
}
