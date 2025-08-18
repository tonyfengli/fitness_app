import type { ScoredExercise } from "../../types/scoredExercise";

export interface OrganizedExercises {
  blockA: ScoredExercise[]; // Primary Strength
  blockB: ScoredExercise[]; // Secondary Strength
  blockC: ScoredExercise[]; // Accessory
  blockD: ScoredExercise[]; // Core & Capacity
}

export interface TemplateHandler {
  organize(exercises: ScoredExercise[]): OrganizedExercises;
}
