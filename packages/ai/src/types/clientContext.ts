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
  strength_capacity: "very_low" | "low" | "moderate" | "high" | "very_high";
  skill_capacity: "very_low" | "low" | "moderate" | "high";
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
  exerciseRequests: ExerciseRequests = { include: [], avoid: [] },
  avoidJoints: string[] = [],
  businessId?: string
): ClientContext {
  return {
    name: "Default Client",
    strength_capacity: strengthCapacity,
    skill_capacity: skillCapacity,
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
    intensity: "all" as const, // LLM controlled
  };
}