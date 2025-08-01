import type { ClientContext } from "./clientContext";
import type { ScoredExercise } from "./scoredExercise";

// Re-export ClientContext for convenience
export type { ClientContext } from "./clientContext";

/**
 * Exercise scored for group selection with overlap tracking
 */
export interface GroupScoredExercise extends ScoredExercise {
  groupScore: number;
  clientScores: {
    clientId: string;
    individualScore: number;
    hasExercise: boolean;
  }[];
  clientsSharing: string[];  // Client IDs who have this exercise
}

/**
 * Context for generating group workouts for multiple clients
 */
export interface GroupContext {
  // Core client data
  clients: ClientContext[];
  
  // Session identification
  sessionId: string;
  
  // Phase 2.5 output - group exercise pools per block
  groupExercisePools?: {
    [blockId: string]: GroupScoredExercise[];
  };
  
  // Metadata
  businessId: string;
  templateType?: string;
}