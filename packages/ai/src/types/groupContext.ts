import type { ClientContext } from "./clientContext";
import type { ScoredExercise } from "./scoredExercise";

/**
 * Settings for how much group cohesion should be enforced per block
 */
export interface GroupCohesionSettings {
  blockSettings: {
    [blockId: string]: {
      sharedRatio: number;      // 0.0-1.0 ratio of shared exercises
      enforceShared?: boolean;  // If true, must have shared exercises
    };
  };
  defaultSharedRatio: number;   // Fallback for blocks not specified
}

/**
 * Per-client preferences for group workout participation
 */
export interface ClientGroupSettings {
  [clientId: string]: {
    cohesionRatio: number;  // 0.0-1.0 (e.g., 0.6 = wants 60% shared exercises)
  };
}

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
  cohesionBonus: number;
  clientsSharing: string[];  // Client IDs who have this exercise
}

/**
 * Context for generating group workouts for multiple clients
 */
export interface GroupContext {
  // Core client data
  clients: ClientContext[];
  
  // Group workout configuration
  groupCohesionSettings: GroupCohesionSettings;
  
  // Per-client preferences
  clientGroupSettings: ClientGroupSettings;
  
  // Session identification
  sessionId: string;
  
  // Phase 2.5 output - group exercise pools per block
  groupExercisePools?: {
    [blockId: string]: GroupScoredExercise[];
  };
  
  // Metadata
  businessId: string;
  templateType?: 'workout' | 'circuit_training' | 'full_body' | 'full_body_bmf';
}