/**
 * Type definitions for the filtering module
 * Consolidates types from various filtering files
 */

// Level types
export type StrengthLevel = "very_low" | "low" | "moderate" | "high";
export type SkillLevel = "very_low" | "low" | "moderate" | "high";
export type IntensityLevel = "low_local" | "moderate_local" | "high_local" | 
                            "moderate_systemic" | "high_systemic" | "metabolic";

// Filter criteria interface
export interface FilterCriteria {
  strength: StrengthLevel;
  skill: SkillLevel;
  include?: string[];
  avoid?: string[];
  avoidJoints?: string[];
}

// Cascading levels configuration
export const CASCADING_LEVELS = ["very_low", "low", "moderate", "high"] as const;