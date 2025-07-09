/**
 * Client Context - represents the user's fitness profile and current state
 * Starting simple with just strength and skill, will expand as we add features
 */

export interface ExerciseRequests {
  include: string[]; // Exercise names to include
  avoid: string[];   // Exercise names to avoid
}

export interface ClientContext {
  name: string;
  strength_capacity: "very_low" | "low" | "moderate" | "high";
  skill_capacity: "very_low" | "low" | "moderate" | "high";
  primary_goal?: "mobility" | "strength" | "general_fitness" | "hypertrophy" | "burn_fat";
  intensity?: "low_local" | "moderate_local" | "high_local" | "moderate_systemic" | "high_systemic" | "metabolic";
  muscle_target?: string[]; // Array of muscles to target more in programming
  muscle_lessen?: string[]; // Array of muscles to work less in programming
  exercise_requests?: ExerciseRequests;
  avoid_joints?: string[]; // Array of joint names to avoid (for injuries/limitations)
  business_id?: string; // UUID of the business this client belongs to
}

/**
 * Create a default client context with basic fitness profile
 */
export function createDefaultClientContext(
  strengthCapacity: ClientContext["strength_capacity"] = "moderate",
  skillCapacity: ClientContext["skill_capacity"] = "moderate",
  primaryGoal: ClientContext["primary_goal"] = "general_fitness",
  intensity: ClientContext["intensity"] = "all",
  muscleTarget: string[] = [],
  muscleLessen: string[] = [],
  exerciseRequests: ExerciseRequests = { include: [], avoid: [] },
  avoidJoints: string[] = [],
  businessId?: string
): ClientContext {
  return {
    name: "Default Client",
    strength_capacity: strengthCapacity,
    skill_capacity: skillCapacity,
    primary_goal: primaryGoal,
    intensity: intensity,
    muscle_target: muscleTarget,
    muscle_lessen: muscleLessen,
    exercise_requests: exerciseRequests,
    avoid_joints: avoidJoints,
    business_id: businessId
  };
}

/**
 * Extract filtering criteria from client context
 * Maps client context to our existing filter types
 */
export function extractFilterCriteriaFromContext(context: ClientContext) {
  return {
    strength: context.strength_capacity,
    skill: context.skill_capacity,
  };
}